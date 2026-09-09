import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DeviceKind } from '@vozaac/shared';
import type { DeviceAuthResponse, UserProfile } from '@vozaac/shared';
import { LoginScreen } from './src/screens/LoginScreen';
import { LinkDeviceScreen } from './src/screens/LinkDeviceScreen';
import { DevicesScreen } from './src/screens/DevicesScreen';
import { ProfilePickerScreen } from './src/screens/ProfilePickerScreen';
import { CommunicatorScreen } from './src/screens/CommunicatorScreen';
import { PinGateScreen } from './src/screens/PinGateScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { AccessibilityScreen } from './src/screens/AccessibilityScreen';
import { session } from './src/state/session';
import { withSession } from './src/api/authenticated';
import { api } from './src/api/client';
import { paletteFor } from './src/theme';

/** Dónde está parada la app dentro del perfil elegido. */
type Mode = 'communicator' | 'pin' | 'editor' | 'accessibility' | 'devices';

/**
 * Navegación de la app.
 *
 * Un router sería más maquinaria de la que hace falta: el flujo es lineal y no
 * hay historial que manejar. Si el Módulo 6 suma pantallas de reportes conviene
 * revisar esta decisión.
 */
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [mode, setMode] = useState<Mode>('communicator');
  const [restoring, setRestoring] = useState(true);
  const [linking, setLinking] = useState(false);
  /**
   * Para qué se vinculó este dispositivo, o null si acá se hizo login.
   *
   * En un dispositivo de chico/a esto cambia dos cosas: la app no ofrece
   * cerrar sesión —él no podría volver a entrar— y no muestra el selector de
   * perfiles, porque su perfil ya quedó fijado al vincularlo.
   */
  const [deviceKind, setDeviceKind] = useState<DeviceKind | null>(null);
  const palette = paletteFor(undefined);

  const esDispositivoDeChico = deviceKind === DeviceKind.CHILD;

  /**
   * Cierra la sesión y vuelve al login.
   *
   * Es también lo que se ejecuta cuando la sesión se pierde sin remedio: un
   * cuidador revocó este dispositivo, o el token venció sin refresh token con
   * el cual renovarlo.
   */
  const cerrarSesion = useCallback(async () => {
    await session.clear();
    setProfile(null);
    setProfiles([]);
    setDeviceKind(null);
    setMode('communicator');
    setToken(null);
  }, []);

  /**
   * Sesión guardada: que la familia no tenga que loguearse cada vez.
   *
   * Se restaura también el perfil elegido, no sólo el token. Para un chico/a
   * que usa siempre el mismo dispositivo, cada toque de más entre abrir la app
   * y su tablero es un toque entre él y su voz.
   *
   * En un dispositivo vinculado (Módulo 9) `withSession` renueva el access
   * token vencido antes de que nadie note nada: por eso este arranque no
   * vuelve al login una vez por semana como pasaría con el JWT solo.
   */
  useEffect(() => {
    let cancelled = false;

    async function restaurar() {
      const guardada = await session.load();
      if (cancelled || !guardada.token) {
        if (!cancelled) setRestoring(false);
        return;
      }

      setToken(guardada.token);
      setDeviceKind(guardada.deviceKind);

      try {
        const lista = await withSession(guardada.token, (t) => api.profiles(t));
        if (!cancelled) {
          setProfiles(lista);
          const elegido = lista.find((perfil) => perfil.id === guardada.profileId);
          // Si el perfil ya no existe —lo borraron desde otro dispositivo— se
          // cae al selector, que es lo correcto y no un error.
          if (elegido) setProfile(elegido);
        }
      } catch {
        // Sin red se muestra el selector, que ya sabe volver a pedir los
        // perfiles y mostrar el error. Con la sesión revocada, withSession ya
        // limpió lo guardado y el próximo arranque cae en el login.
      }

      if (!cancelled) setRestoring(false);
    }

    void restaurar();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoggedIn(accessToken: string) {
    await session.save(accessToken);
    setToken(accessToken);
  }

  /**
   * Termina el enrolamiento de un dispositivo (Módulo 9).
   *
   * En el del chico/a el perfil viene resuelto en la misma respuesta del
   * canje, así que la app abre directo en su tablero: ni selector ni pantalla
   * de carga entre él y su voz.
   */
  async function handleLinked(respuesta: DeviceAuthResponse) {
    await session.saveDevice({
      token: respuesta.accessToken,
      refreshToken: respuesta.refreshToken,
      deviceKind: respuesta.device.kind,
      profileId: respuesta.profile?.id ?? null,
    });

    setToken(respuesta.accessToken);
    setDeviceKind(respuesta.device.kind);
    setProfile(respuesta.profile);
    setProfiles(respuesta.profile ? [respuesta.profile] : []);
    setMode('communicator');
    setLinking(false);
  }

  async function handleSelectProfile(selected: UserProfile) {
    await session.saveProfile(selected.id);
    setProfile(selected);
    setMode('communicator');
  }

  function renderContent() {
    if (restoring) {
      return <ActivityIndicator style={styles.centered} size="large" testID="restoring-session" />;
    }
    if (linking) {
      return <LinkDeviceScreen onLinked={handleLinked} onCancel={() => setLinking(false)} />;
    }
    if (!token) {
      return <LoginScreen onLoggedIn={handleLoggedIn} onLinkDevice={() => setLinking(true)} />;
    }
    if (!profile) {
      return (
        <ProfilePickerScreen
          token={token}
          onSelect={handleSelectProfile}
          onLogout={() => void cerrarSesion()}
        />
      );
    }
    if (mode === 'pin') {
      return (
        <PinGateScreen
          token={token}
          onUnlocked={() => setMode('editor')}
          onCancel={() => setMode('communicator')}
        />
      );
    }
    if (mode === 'devices') {
      return (
        <DevicesScreen
          token={token}
          profiles={profiles.length > 0 ? profiles : [profile]}
          onExit={() => setMode('editor')}
        />
      );
    }
    if (mode === 'editor') {
      return (
        <EditorScreen
          token={token}
          userId={profile.id}
          // Al salir se vuelve al comunicador, no al selector: el editor es una
          // parada dentro de la sesión del mismo perfil.
          onExit={() => setMode('communicator')}
          onOpenAccessibility={() => setMode('accessibility')}
          onOpenDevices={() => setMode('devices')}
        />
      );
    }
    if (mode === 'accessibility') {
      return (
        <AccessibilityScreen
          token={token}
          userId={profile.id}
          // Vuelve al editor y no al comunicador: se entra desde ahí, y el PIN
          // ya se validó una sola vez para todo el modo terapeuta.
          onExit={() => setMode('editor')}
        />
      );
    }
    return (
      <CommunicatorScreen
        token={token}
        userId={profile.id}
        profileName={profile.name}
        // En el dispositivo del chico/a no hay salida al selector: su perfil
        // quedó fijado al vincularlo, y una puerta de salida que él no sabe
        // deshacer sólo lo dejaría afuera de su comunicador.
        onExit={esDispositivoDeChico ? undefined : () => setProfile(null)}
        onOpenEditor={() => setMode('pin')}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar style="auto" />
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
});
