import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DeviceKind, LINK_CODE } from '@vozaac/shared';
import type { LinkCodeResponse, LinkedDevice, UserProfile } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, radius, spacing, touchTarget, typography } from '../theme';
import { Button, CodeDisplay } from '../components/ui';

interface Props {
  token: string;
  /** Perfiles del cuidador; se elige a cuál se ata un dispositivo de chico/a. */
  profiles: UserProfile[];
  onExit: () => void;
}

/**
 * Dispositivos vinculados, en el celular del cuidador (Módulo 9).
 *
 * Desde acá se genera el código para enrolar otro dispositivo y se corta el
 * acceso de uno que ya no corresponde. Lo segundo importa más que lo primero:
 * un dispositivo perdido con una sesión que no vence es un problema, y esta
 * pantalla es la única forma de cerrarlo.
 */
export function DevicesScreen({ token, profiles, onExit }: Props) {
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [codigo, setCodigo] = useState<LinkCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const palette = paletteFor(undefined);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await api.linkedDevices(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los dispositivos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function generar(kind: DeviceKind, userId?: string) {
    setGenerating(true);
    setError(null);
    try {
      setCodigo(await api.createLinkCode(token, { kind, ...(userId ? { userId } : {}) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código');
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Revocar pide confirmación: en el dispositivo del chico/a esto lo deja sin
   * comunicador hasta que alguien lo vuelva a vincular, y no hay forma de
   * deshacerlo desde acá.
   */
  function confirmarRevocar(device: LinkedDevice) {
    Alert.alert(
      'Desvincular dispositivo',
      `${device.name} va a dejar de tener acceso. Para volver a usarlo hay que vincularlo de nuevo con un código.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desvincular', style: 'destructive', onPress: () => void revocar(device.id) },
      ],
    );
  }

  async function revocar(deviceId: string) {
    try {
      await api.revokeDevice(token, deviceId);
      setDevices((previos) => previos.filter((device) => device.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular');
    }
  }

  function nombreDePerfil(userId: string | null): string {
    if (!userId) return 'Todos los perfiles';
    return profiles.find((perfil) => perfil.id === userId)?.name ?? 'Perfil eliminado';
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Dispositivos</Text>
        <Button
          testID="button-devices-exit"
          label="Volver"
          variant="secondary"
          palette={palette}
          onPress={onExit}
        />
      </View>

      {codigo ? (
        <View style={styles.codeSection}>
          <CodeDisplay
            testID="link-code-panel"
            valueTestID="link-code-value"
            code={codigo.code}
            label="Escribí este código en el otro dispositivo"
            hint={`Vence en ${LINK_CODE.expiresInMinutes} minutos y se usa una sola vez.`}
            palette={palette}
          />
          <Button
            testID="button-code-done"
            label="Listo"
            palette={palette}
            onPress={() => {
              setCodigo(null);
              void cargar();
            }}
          />
        </View>
      ) : (
        <View style={styles.generators}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Vincular un dispositivo
          </Text>

          {profiles.map((perfil) => (
            <Pressable
              key={perfil.id}
              testID={`button-link-child-${perfil.id}`}
              accessibilityRole="button"
              disabled={generating}
              onPress={() => void generar(DeviceKind.CHILD, perfil.id)}
              style={[styles.generatorRow, { borderColor: palette.border }]}
            >
              <Text style={[styles.generatorText, { color: palette.text }]}>
                Dispositivo de {perfil.name}
              </Text>
              <Text style={[styles.generatorHint, { color: palette.textMuted }]}>
                Abre directo en su tablero
              </Text>
            </Pressable>
          ))}

          <Pressable
            testID="button-link-caregiver"
            accessibilityRole="button"
            disabled={generating}
            onPress={() => void generar(DeviceKind.CAREGIVER)}
            style={[styles.generatorRow, { borderColor: palette.border }]}
          >
            <Text style={[styles.generatorText, { color: palette.text }]}>
              Dispositivo de otro responsable
            </Text>
            <Text style={[styles.generatorHint, { color: palette.textMuted }]}>
              Ve todos los perfiles y recibe los avisos
            </Text>
          </Pressable>

          {generating && <ActivityIndicator testID="generating-code" />}
        </View>
      )}

      {error && (
        <Text testID="devices-error" style={[styles.error, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      <Text style={[styles.sectionTitle, { color: palette.text }]}>Vinculados</Text>

      {loading ? (
        <ActivityIndicator testID="loading-devices" size="large" />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(device) => device.id}
          ListEmptyComponent={
            <Text testID="devices-empty" style={{ color: palette.textMuted }}>
              Todavía no vinculaste ningún dispositivo.
            </Text>
          }
          renderItem={({ item }) => (
            <View
              testID={`device-${item.id}`}
              style={[styles.deviceRow, { borderColor: palette.border }]}
            >
              <View style={styles.deviceInfo}>
                <Text style={[styles.deviceName, { color: palette.text }]}>{item.name}</Text>
                <Text style={[styles.deviceMeta, { color: palette.textMuted }]}>
                  {item.kind === DeviceKind.CHILD ? 'Chico/a' : 'Responsable'} ·{' '}
                  {nombreDePerfil(item.userId)}
                </Text>
              </View>
              <Button
                testID={`button-revoke-${item.id}`}
                label="Desvincular"
                accessibilityLabel={`Desvincular ${item.name}`}
                variant="danger"
                palette={palette}
                onPress={() => confirmarRevocar(item)}
              />
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
  sectionTitle: typography.subtitle,
  generators: { gap: spacing.sm },
  codeSection: { gap: spacing.md },
  // La fila del generador no usa Button porque lleva dos líneas —qué es y a
  // quién le sirve—, y Button es de una etiqueta sola a propósito.
  generatorRow: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  generatorText: typography.subtitle,
  generatorHint: typography.caption,
  deviceRow: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  deviceInfo: { flex: 1, gap: spacing.xs },
  deviceName: typography.subtitle,
  deviceMeta: typography.caption,
  error: typography.body,
});
