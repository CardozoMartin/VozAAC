import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { INVITE_CODE } from '@vozaac/shared';
import type { InviteCodeResponse, ProfileCaregiverInfo } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, radius, spacing, typography } from '../theme';
import { Button, CodeDisplay } from '../components/ui';

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
        <Button
          testID="button-caregivers-exit"
          label="Volver"
          variant="secondary"
          palette={palette}
          onPress={onExit}
        />
      </View>

      <Text style={[styles.subtitle, { color: palette.textMuted }]}>
        Quiénes pueden ver y editar el tablero de {profileName}.
      </Text>

      {invite ? (
        <View style={styles.inviteSection}>
          <CodeDisplay
            testID="invite-panel"
            valueTestID="invite-code-value"
            code={invite.code}
            label="Pasale este código a quien quieras sumar"
            hint={`Tiene que crear su cuenta en la app y escribirlo. Vence en ${INVITE_CODE.expiresInHours} horas y se usa una sola vez.`}
            palette={palette}
          />
          <Button
            testID="button-invite-done"
            label="Listo"
            palette={palette}
            onPress={() => {
              setInvite(null);
              void cargar();
            }}
          />
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
          <Button
            testID="button-invite"
            label="Generar invitación"
            palette={palette}
            loading={inviting}
            onPress={() => void invitar()}
          />
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
                <Button
                  testID={`button-remove-${item.caregiverId}`}
                  label={item.isSelf ? 'Salir' : 'Quitar'}
                  accessibilityLabel={
                    item.isSelf ? 'Dejar de ser responsable' : `Quitar a ${item.fullName}`
                  }
                  variant="danger"
                  palette={palette}
                  onPress={() => confirmarQuitar(item)}
                />
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
  title: typography.title,
  subtitle: typography.body,
  sectionTitle: typography.subtitle,
  inviteForm: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  inviteSection: { gap: spacing.md },
  input: { borderWidth: 1, borderRadius: radius.buttonSmall, padding: spacing.md, fontSize: 16 },
  row: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  info: { flex: 1, gap: spacing.xs },
  name: typography.subtitle,
  meta: typography.caption,
  error: typography.body,
});
