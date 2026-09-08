import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { UserProfile } from '@vozaac/shared';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfilePickerScreen } from './src/screens/ProfilePickerScreen';
import { CommunicatorScreen } from './src/screens/CommunicatorScreen';
import { session } from './src/state/session';
import { paletteFor } from './src/theme';

/**
 * Navegación de la app.
 *
 * Con tres pantallas encadenadas —login, selector de perfil, comunicador— un
 * router sería más maquinaria de la que hace falta. Cuando llegue el editor
 * del Módulo 4 conviene revisar esta decisión.
 */
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
    setToken(null);
  }

  async function handleSelectProfile(selected: UserProfile) {
    await session.saveProfile(selected.id);
    setProfile(selected);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar style="auto" />
      {restoring ? (
        <ActivityIndicator style={styles.centered} size="large" testID="restoring-session" />
      ) : !token ? (
        <LoginScreen onLoggedIn={handleLoggedIn} />
      ) : !profile ? (
        <ProfilePickerScreen token={token} onSelect={handleSelectProfile} onLogout={handleLogout} />
      ) : (
        <CommunicatorScreen
          token={token}
          userId={profile.id}
          profileName={profile.name}
          onExit={() => setProfile(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
});
