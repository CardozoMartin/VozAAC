import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const palette = paletteFor(undefined);

  /**
   * Crea el perfil y lo agrega a la lista sin recargar todo.
   *
   * El backend le deja un tablero con vocabulario inicial, así que el chico/a
   * puede empezar a comunicarse apenas se crea: una grilla vacía no le serviría
   * ni a él ni al cuidador, que no tendría de dónde agarrarse para entender
   * cómo se arma un tablero.
   */
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.createProfile(token, { name });
      setProfiles((current) =>
        [...(current ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName('');
      setAdding(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el perfil');
    } finally {
      setCreating(false);
    }
  }

  function closeAdd() {
    setAdding(false);
    setNewName('');
    setCreateError(null);
  }

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
          Todavía no hay perfiles. Creá el primero para empezar a usar el comunicador.
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

      <View style={styles.footer}>
        <Pressable
          testID="button-add-profile"
          accessibilityRole="button"
          accessibilityLabel="Agregar un perfil"
          onPress={() => setAdding(true)}
          style={[styles.addButton, { backgroundColor: palette.accent }]}
        >
          <Text style={styles.addButtonText}>Agregar perfil</Text>
        </Pressable>

        <Pressable
          testID="button-logout"
          accessibilityRole="button"
          onPress={onLogout}
          style={[styles.logout, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <Modal visible={adding} transparent animationType="fade" onRequestClose={closeAdd}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: palette.background }]}>
            <Text style={[styles.dialogTitle, { color: palette.text }]}>Nuevo perfil</Text>
            <Text style={[styles.dialogHint, { color: palette.textMuted }]}>
              El tablero arranca con un vocabulario inicial que después se edita desde el modo
              terapeuta.
            </Text>

            <TextInput
              testID="input-profile-name"
              accessibilityLabel="Nombre del chico o chica"
              placeholder="Nombre"
              placeholderTextColor={palette.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="words"
              autoFocus
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />

            {createError && (
              <Text testID="create-profile-error" style={[styles.error, { color: palette.danger }]}>
                {createError}
              </Text>
            )}

            <View style={styles.dialogActions}>
              <Pressable
                testID="button-cancel-profile"
                accessibilityRole="button"
                onPress={closeAdd}
                style={[styles.dialogButton, { borderColor: palette.border, borderWidth: 1 }]}
              >
                <Text style={{ color: palette.text }}>Cancelar</Text>
              </Pressable>

              <Pressable
                testID="button-create-profile"
                accessibilityRole="button"
                accessibilityState={{ disabled: !newName.trim() || creating }}
                disabled={!newName.trim() || creating}
                onPress={() => void handleCreate()}
                style={[
                  styles.dialogButton,
                  {
                    backgroundColor: palette.accent,
                    opacity: !newName.trim() || creating ? 0.5 : 1,
                  },
                ]}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" testID="creating-profile" />
                ) : (
                  <Text style={styles.addButtonText}>Crear</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  addButton: { borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  dialogTitle: { fontSize: 22, fontWeight: '700' },
  dialogHint: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 2, borderRadius: 12, padding: spacing.md, fontSize: 18 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  dialogButton: {
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 110,
    alignItems: 'center',
  },
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
