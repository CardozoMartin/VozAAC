import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { UserProfile } from '@vozaac/shared';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfilePickerScreen } from './src/screens/ProfilePickerScreen';
import { CommunicatorScreen } from './src/screens/CommunicatorScreen';
import { PinGateScreen } from './src/screens/PinGateScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { AccessibilityScreen } from './src/screens/AccessibilityScreen';
import { session } from './src/state/session';
import { paletteFor } from './src/theme';

/** Dónde está parada la app dentro del perfil elegido. */
type Mode = 'communicator' | 'pin' | 'editor' | 'accessibility';

/**
 * Navegación de la app.
 *
 * Cinco pantallas encadenadas y un router sería más maquinaria de la que hace
 * falta: el flujo es lineal y no hay historial que manejar. Si el Módulo 6
 * suma pantallas de reportes conviene revisar esta decisión.
 */
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<Mode>('communicator');
  const [restoring, setRestoring] = useState(true);
  const palette = paletteFor(undefined);

  // Sesión guardada: que la familia no tenga que loguearse cada vez.
  useEffect(() => {
    session
      .load()
      .then(({ token: saved }) => setToken(saved))
      .finally(() => setRestoring(false));
  }, []);

  async function handleLoggedIn(accessToken: string) {
    await session.save(accessToken);
    setToken(accessToken);
  }

  async function handleLogout() {
    await session.clear();
    setProfile(null);
    setMode('communicator');
    setToken(null);
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
    if (!token) {
      return <LoginScreen onLoggedIn={handleLoggedIn} />;
    }
    if (!profile) {
      return (
        <ProfilePickerScreen token={token} onSelect={handleSelectProfile} onLogout={handleLogout} />
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
    if (mode === 'editor') {
      return (
        <EditorScreen
          token={token}
          userId={profile.id}
          // Al salir se vuelve al comunicador, no al selector: el editor es una
          // parada dentro de la sesión del mismo perfil.
          onExit={() => setMode('communicator')}
          onOpenAccessibility={() => setMode('accessibility')}
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
        onExit={() => setProfile(null)}
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
