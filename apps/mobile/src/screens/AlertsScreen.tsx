import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { URGENT_ALERT, type Alert } from '@vozaac/shared';
import { api } from '../api/client';
import type { PushStatus } from '../state/usePushRegistration';
import { paletteFor, radius, spacing, touchTarget, typography } from '../theme';

interface Props {
  token: string;
  onExit: () => void;
  /**
   * Si este dispositivo va a recibir los avisos por push.
   *
   * Se muestra porque un responsable que cree que le van a sonar y no le suenan
   * está peor que uno que sabe que tiene que entrar a mirar.
   */
  pushStatus?: PushStatus;
}

/**
 * Qué decirle al adulto según cómo quedó el registro de push.
 *
 * Sólo se avisa cuando hay algo que él pueda entender o resolver: el caso
 * 'ready' no dice nada, porque "vas a recibir avisos" es lo que ya espera.
 */
function avisoDePush(status: PushStatus | undefined): string | null {
  switch (status) {
    case 'denied':
      return 'Las notificaciones están desactivadas para VozAAC. Los avisos van a aparecer acá, pero el teléfono no va a sonar.';
    case 'unsupported':
      return 'En esta versión de prueba el teléfono no suena: los avisos aparecen acá al abrir la pantalla.';
    case 'failed':
      return 'No se pudo activar el aviso sonoro en este dispositivo. Los avisos igual aparecen acá.';
    default:
      return null;
  }
}

/**
 * Bandeja de alertas del responsable (Módulo 9, paso 4).
 *
 * Junta las alertas de todos los chicos/as a cargo en una sola lista: cuando
 * suena, lo primero que el responsable necesita saber es qué pasó, y recién
 * después de cuál de sus hijos.
 *
 * Consulta cada veinte segundos en vez de recibir push. Es a propósito: así
 * funciona en Expo Go, sin development build ni credenciales, y el circuito
 * queda probado entero para sumarle push encima sin rehacer nada.
 */
export function AlertsScreen({ token, onExit, pushStatus }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const palette = paletteFor(undefined);
  const cancelled = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api.alerts(token);
      if (!cancelled.current) {
        setAlerts(data);
        setError(null);
      }
    } catch (err) {
      if (!cancelled.current) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los avisos');
      }
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cancelled.current = false;
    void cargar();

    const timer = setInterval(() => void cargar(), URGENT_ALERT.pollIntervalMs);
    return () => {
      cancelled.current = true;
      clearInterval(timer);
    };
  }, [cargar]);

  /**
   * Marca la alerta como atendida.
   *
   * Se actualiza la lista con lo que devuelve la API y no con lo que se
   * asume: si otro responsable la atendió primero, el nombre que corresponde
   * mostrar es el suyo y no el propio.
   */
  async function atender(alertId: string) {
    try {
      const actualizada = await api.acknowledgeAlert(token, alertId);
      setAlerts((previas) =>
        previas.map((alerta) => (alerta.id === alertId ? actualizada : alerta)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar el aviso');
    }
  }

  const pendientes = alerts.filter((alerta) => !alerta.acknowledgedAt).length;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>
          Avisos{pendientes > 0 ? ` (${pendientes})` : ''}
        </Text>
        <Pressable
          testID="button-alerts-exit"
          accessibilityRole="button"
          onPress={onExit}
          style={[styles.secondary, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Volver</Text>
        </Pressable>
      </View>

      {error && (
        <Text testID="alerts-error" style={[styles.error, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      {avisoDePush(pushStatus) && (
        <Text
          testID="push-status"
          style={[styles.pushAviso, { color: palette.textMuted, borderColor: palette.border }]}
        >
          {avisoDePush(pushStatus)}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator testID="loading-alerts" size="large" />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(alerta) => alerta.id}
          ListEmptyComponent={
            <Text testID="alerts-empty" style={{ color: palette.textMuted }}>
              No hay avisos. Acá van a aparecer cuando el chico/a toque un pictograma urgente.
            </Text>
          }
          renderItem={({ item }) => {
            const atendida = Boolean(item.acknowledgedAt);
            return (
              <View
                testID={`alert-${item.id}`}
                style={[
                  styles.row,
                  {
                    // La pendiente lleva el borde de alerta; la atendida se
                    // apaga para que la vista salte a lo que falta mirar.
                    borderColor: atendida ? palette.border : palette.danger,
                    borderWidth: atendida ? 1 : 3,
                    opacity: atendida ? 0.7 : 1,
                  },
                ]}
              >
                {item.pictogramImageUrl && (
                  <Image
                    source={{ uri: item.pictogramImageUrl }}
                    style={styles.image}
                    resizeMode="contain"
                    accessible={false}
                  />
                )}

                <View style={styles.info}>
                  <Text style={[styles.text, { color: palette.text }]}>{item.pictogramText}</Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {item.profileName} · {formatearMomento(item.occurredAt)}
                  </Text>
                  {atendida && (
                    <Text
                      testID={`alert-ack-${item.id}`}
                      style={[styles.meta, { color: palette.textMuted }]}
                    >
                      Visto por {item.acknowledgedByName ?? 'alguien'}
                    </Text>
                  )}
                </View>

                {!atendida && (
                  <Pressable
                    testID={`button-ack-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Marcar como visto: ${item.pictogramText}`}
                    onPress={() => void atender(item.id)}
                    style={[styles.ack, { backgroundColor: palette.accent }]}
                  >
                    <Text style={styles.ackText}>Lo vi</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

/**
 * Momento del aviso en formato corto.
 *
 * Lo de hoy va sólo con la hora, que es lo que el responsable necesita leer de
 * un vistazo; lo anterior lleva la fecha para no confundirse de día.
 */
function formatearMomento(iso: string): string {
  const fecha = new Date(iso);
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  const esHoy =
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear();

  return esHoy ? hora : `${fecha.toLocaleDateString('es-AR')} ${hora}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: typography.title,
  row: {
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  image: { width: 56, height: 56 },
  info: { flex: 1, gap: spacing.xs },
  // El texto del pictograma es lo que el responsable lee de un vistazo a las
  // 3 AM, así que va un escalón por encima del cuerpo del resto de la fila.
  text: typography.sectionTitle,
  meta: typography.caption,
  ack: {
    borderRadius: radius.buttonSmall,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  ackText: { color: '#FFFFFF', ...typography.button },
  pushAviso: {
    ...typography.caption,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  error: typography.body,
  secondary: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
});
