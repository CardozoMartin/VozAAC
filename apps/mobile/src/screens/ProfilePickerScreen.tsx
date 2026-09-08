import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { UserProfile } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, spacing } from '../theme';

interface Props {
  token: string;
  onSelect: (profile: UserProfile) => void;
  onLogout: () => void;
}

/**
 * Selector de perfil (Módulo 2).
 *
 * Las tarjetas son grandes y con foto porque muchas veces es el propio chico/a
 * quien se elige a sí mismo antes de empezar.
 */
export function ProfilePickerScreen({ token, onSelect, onLogout }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const palette = paletteFor(undefined);

  useEffect(() => {
    let cancelled = false;

    api
      .profiles(token)
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los perfiles');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        <Pressable onPress={onLogout} style={[styles.logout, { borderColor: palette.border }]}>
          <Text style={{ color: palette.text }}>Salir</Text>
        </Pressable>
      </View>
    );
  }

  if (!profiles) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.accent} testID="profiles-loading" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>¿Quién va a usar el comunicador?</Text>

      {profiles.length === 0 ? (
        <Text testID="profiles-empty" style={[styles.empty, { color: palette.textMuted }]}>
          Todavía no hay perfiles cargados. Creá uno desde el modo terapeuta.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {profiles.map((profile) => (
            <Pressable
              key={profile.id}
              testID={`profile-${profile.id}`}
              accessibilityRole="button"
              accessibilityLabel={profile.name}
              onPress={() => onSelect(profile)}
              style={[
                styles.card,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
            >
              {profile.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={styles.photo} accessible={false} />
              ) : (
                <View
                  style={[styles.photo, styles.photoPlaceholder, { borderColor: palette.border }]}
                >
                  <Text style={[styles.initial, { color: palette.textMuted }]}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.name, { color: palette.text }]}>{profile.name}</Text>
              {profile.age !== null && (
                <Text style={[styles.age, { color: palette.textMuted }]}>{profile.age} años</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        testID="button-logout"
        accessibilityRole="button"
        onPress={onLogout}
        style={[styles.logout, { borderColor: palette.border }]}
      >
        <Text style={{ color: palette.textMuted }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: spacing.lg },
  list: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  card: {
    width: 170,
    borderWidth: 2,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  photo: { width: 110, height: 110, borderRadius: 55 },
  photoPlaceholder: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 44, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  age: { fontSize: 14 },
  empty: { fontSize: 16, textAlign: 'center', paddingHorizontal: spacing.lg },
  error: { fontSize: 17, textAlign: 'center', paddingHorizontal: spacing.lg },
  logout: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
