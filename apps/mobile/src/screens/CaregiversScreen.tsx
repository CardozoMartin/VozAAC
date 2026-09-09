import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { INVITE_CODE } from '@vozaac/shared';
import type { InviteCodeResponse, ProfileCaregiverInfo } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, spacing } from '../theme';

interface Props {
  token: string;
  userId: string;
  profileName: string;
  onExit: () => void;
}

/**
 * Quiénes están a cargo del chico/a (Módulo 9, paso 3).
 *
 * Desde acá se suma a la madre, al padre, a un hermano o a la maestra, y se
 * quita a quien ya no corresponde. Todos pueden lo mismo: ver el tablero,
 * editarlo y sumar a otro. No hay dueño ni invitados, así que la lista no
 * muestra roles — la etiqueta ("Mamá", "Hermano") es sólo para distinguir
 * quién es quién.
 */
export function CaregiversScreen({ token, userId, profileName, onExit }: Props) {
  const [caregivers, setCaregivers] = useState<ProfileCaregiverInfo[]>([]);
  const [invite, setInvite] = useState<InviteCodeResponse | null>(null);
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const palette = paletteFor(undefined);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCaregivers(await api.profileCaregivers(token, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los responsables');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function invitar() {
    setInviting(true);
    setError(null);
    try {
      setInvite(await api.inviteCaregiver(token, userId, relationship.trim() || undefined));
      setRelationship('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la invitación');
    } finally {
      setInviting(false);
    }
  }

  /**
   * Quitar pide confirmación: esa persona deja de ver al chico/a, y para
   * volver hace falta una invitación nueva.
   */
  function confirmarQuitar(responsable: ProfileCaregiverInfo) {
    const propio = responsable.isSelf;
    Alert.alert(
      propio ? 'Dejar de ser responsable' : 'Quitar responsable',
      propio
        ? `Vas a dejar de ver a ${profileName}. Para volver, alguien te tiene que invitar de nuevo.`
        : `${responsable.fullName} va a dejar de ver a ${profileName}. Para volver, hay que invitarlo de nuevo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: propio ? 'Dejar' : 'Quitar',
          style: 'destructive',
          onPress: () => void quitar(responsable),
        },
      ],
    );
  }

  async function quitar(responsable: ProfileCaregiverInfo) {
    try {
      await api.removeCaregiver(token, userId, responsable.caregiverId);
      // Si se quitó a sí mismo ya no puede ver este perfil, así que se sale
      // en vez de dejarlo mirando una pantalla que va a dar error.
      if (responsable.isSelf) {
        onExit();
        return;
      }
      setCaregivers((previos) =>
        previos.filter((item) => item.caregiverId !== responsable.caregiverId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar al responsable');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Responsables</Text>
        <Pressable
          testID="button-caregivers-exit"
          accessibilityRole="button"
          onPress={onExit}
          style={[styles.secondary, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Volver</Text>
        </Pressable>
      </View>

      <Text style={[styles.subtitle, { color: palette.textMuted }]}>
        Quiénes pueden ver y editar el tablero de {profileName}.
      </Text>

      {invite ? (
        <View
          testID="invite-panel"
          style={[
            styles.invitePanel,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.inviteLabel, { color: palette.textMuted }]}>
            Pasale este código a quien quieras sumar
          </Text>
          <Text testID="invite-code-value" style={[styles.code, { color: palette.text }]}>
            {invite.code}
          </Text>
          <Text style={[styles.inviteHint, { color: palette.textMuted }]}>
            Tiene que crear su cuenta en la app y escribirlo. Vence en {INVITE_CODE.expiresInHours}{' '}
            horas y se usa una sola vez.
          </Text>
          <Pressable
            testID="button-invite-done"
            accessibilityRole="button"
            onPress={() => {
              setInvite(null);
              void cargar();
            }}
            style={[styles.primary, { backgroundColor: palette.accent }]}
          >
            <Text style={styles.primaryText}>Listo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.inviteForm, { borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Sumar a alguien</Text>
          <TextInput
            testID="input-relationship"
            accessibilityLabel="Parentesco"
            value={relationship}
            onChangeText={setRelationship}
            placeholder="Mamá, Papá, Hermano, Maestra… (opcional)"
            placeholderTextColor={palette.textMuted}
            maxLength={60}
            style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          />
          <Pressable
            testID="button-invite"
            accessibilityRole="button"
            accessibilityState={{ disabled: inviting }}
            disabled={inviting}
            onPress={() => void invitar()}
            style={[
              styles.primary,
              { backgroundColor: palette.accent, opacity: inviting ? 0.5 : 1 },
            ]}
          >
            {inviting ? (
              <ActivityIndicator color="#FFFFFF" testID="inviting" />
            ) : (
              <Text style={styles.primaryText}>Generar invitación</Text>
            )}
          </Pressable>
        </View>
      )}

      {error && (
        <Text testID="caregivers-error" style={[styles.error, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator testID="loading-caregivers" size="large" />
      ) : (
        <FlatList
          data={caregivers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              testID={`caregiver-${item.caregiverId}`}
              style={[styles.row, { borderColor: palette.border }]}
            >
              <View style={styles.info}>
                <Text style={[styles.name, { color: palette.text }]}>
                  {item.fullName}
                  {item.isSelf ? ' (vos)' : ''}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {item.relationship ? `${item.relationship} · ` : ''}
                  {item.email}
                </Text>
              </View>
              {/*
                Con un solo responsable no se ofrece quitarlo: el perfil
                quedaría sin nadie que pueda verlo, y la API lo rechaza igual.
              */}
              {caregivers.length > 1 && (
                <Pressable
                  testID={`button-remove-${item.caregiverId}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.isSelf ? 'Dejar de ser responsable' : `Quitar a ${item.fullName}`
                  }
                  onPress={() => confirmarQuitar(item)}
                  style={[styles.remove, { borderColor: palette.danger }]}
                >
                  <Text style={{ color: palette.danger }}>{item.isSelf ? 'Salir' : 'Quitar'}</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 15 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  inviteForm: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  input: { borderWidth: 1, borderRadius: 10, padding: spacing.md, fontSize: 16 },
  invitePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteLabel: { fontSize: 15, textAlign: 'center' },
  code: { fontSize: 40, fontWeight: '800', letterSpacing: 8 },
  inviteHint: { fontSize: 14, textAlign: 'center' },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  info: { flex: 1, gap: spacing.xs },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14 },
  remove: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: { fontSize: 15 },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primary: {
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
