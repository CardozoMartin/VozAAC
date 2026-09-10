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
import { INVITE_CODE } from '@vozaac/shared';
import type { UserProfile } from '@vozaac/shared';
import { api } from '../api/client';
import { codeTypography, maxFormWidth, paletteFor, radius, spacing, typography } from '../theme';
import { Button } from '../components/ui';

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
  const [redeeming, setRedeeming] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
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

  /**
   * Acepta una invitación para ser responsable de un chico/a (Módulo 9, paso 3).
   *
   * Es por donde entra el segundo responsable: el padre se registra con su
   * propia cuenta, escribe el código que le pasó la madre, y desde ahí ve al
   * mismo chico/a. Se recargan los perfiles porque el que se suma recién ahora
   * aparece en la lista.
   */
  async function handleAcceptInvite() {
    const code = inviteCode.trim();
    if (code.length !== INVITE_CODE.length) return;

    setAccepting(true);
    setInviteError(null);
    try {
      await api.acceptInvite(token, code);
      setProfiles(await api.profiles(token));
      closeRedeem();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
      setInviteCode('');
    } finally {
      setAccepting(false);
    }
  }

  function closeRedeem() {
    setRedeeming(false);
    setInviteCode('');
    setInviteError(null);
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
        <Button label="Salir" variant="secondary" palette={palette} onPress={onLogout} />
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
        <Button
          testID="button-add-profile"
          label="Agregar perfil"
          accessibilityLabel="Agregar un perfil"
          palette={palette}
          onPress={() => setAdding(true)}
        />

        <Button
          testID="button-open-invite"
          label="Tengo una invitación"
          variant="secondary"
          palette={palette}
          onPress={() => setRedeeming(true)}
        />

        <Button
          testID="button-logout"
          label="Cerrar sesión"
          variant="secondary"
          palette={palette}
          onPress={onLogout}
        />
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
              <Button
                testID="button-cancel-profile"
                label="Cancelar"
                variant="secondary"
                palette={palette}
                onPress={closeAdd}
                style={styles.dialogButton}
              />

              <Button
                testID="button-create-profile"
                label="Crear"
                palette={palette}
                disabled={!newName.trim()}
                loading={creating}
                onPress={() => void handleCreate()}
                style={styles.dialogButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={redeeming} transparent animationType="fade" onRequestClose={closeRedeem}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: palette.background }]}>
            <Text style={[styles.dialogTitle, { color: palette.text }]}>Tengo una invitación</Text>
            <Text style={[styles.dialogHint, { color: palette.textMuted }]}>
              Escribí el código que te pasó quien ya está a cargo del chico/a. Vas a poder ver y
              editar su tablero igual que esa persona.
            </Text>

            <TextInput
              testID="input-invite-code"
              accessibilityLabel="Código de invitación"
              placeholder={'-'.repeat(INVITE_CODE.length)}
              placeholderTextColor={palette.textMuted}
              value={inviteCode}
              onChangeText={(value) =>
                // Se normaliza mientras se tipea: el código se dicta o llega
                // por mensaje, y quien lo escribe no tiene por qué acertar el
                // formato exacto.
                setInviteCode(
                  value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, INVITE_CODE.length),
                )
              }
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={INVITE_CODE.length}
              autoFocus
              style={[styles.codeInput, { borderColor: palette.border, color: palette.text }]}
            />

            {inviteError && (
              <Text testID="invite-error" style={[styles.error, { color: palette.danger }]}>
                {inviteError}
              </Text>
            )}

            <View style={styles.dialogActions}>
              <Button
                testID="button-cancel-invite"
                label="Cancelar"
                variant="secondary"
                palette={palette}
                onPress={closeRedeem}
                style={styles.dialogButton}
              />

              <Button
                testID="button-accept-invite"
                label="Aceptar"
                palette={palette}
                disabled={inviteCode.length !== INVITE_CODE.length}
                loading={accepting}
                onPress={() => void handleAcceptInvite()}
                style={styles.dialogButton}
              />
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
  title: { ...typography.title, textAlign: 'center', marginBottom: spacing.lg },
  list: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  // La tarjeta no es un Button: lleva foto, nombre y edad, y el chico/a la
  // toca por la foto más que por el texto. Es grande a propósito, porque
  // muchas veces es él mismo quien se elige antes de empezar.
  card: {
    width: 170,
    borderWidth: 2,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  // El radio sale del tamaño para que siga siendo un círculo si la foto
  // cambia de medida; antes era 55 fijo, que sólo funcionaba con 110 px.
  photo: { width: 110, height: 110, borderRadius: radius.pill },
  photoPlaceholder: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 44, fontWeight: '700' },
  name: { ...typography.sectionTitle, textAlign: 'center' },
  age: typography.caption,
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: maxFormWidth,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogTitle: typography.sectionTitle,
  dialogHint: { ...typography.caption, lineHeight: 20 },
  input: { borderWidth: 2, borderRadius: radius.button, padding: spacing.md, fontSize: 18 },
  codeInput: {
    borderWidth: 2,
    borderRadius: radius.button,
    padding: spacing.md,
    ...codeTypography.input,
    textAlign: 'center',
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  // Los dos botones del diálogo miden lo mismo aunque "Crear" sea más corto
  // que "Cancelar": desparejos, el ojo lee el más ancho como el importante.
  dialogButton: { minWidth: 110 },
  empty: { ...typography.body, textAlign: 'center', paddingHorizontal: spacing.lg },
  error: { ...typography.subtitle, textAlign: 'center', paddingHorizontal: spacing.lg },
});
