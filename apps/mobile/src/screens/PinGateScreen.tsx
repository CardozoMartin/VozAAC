import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { THERAPIST_PIN } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, spacing } from '../theme';

interface Props {
  token: string;
  onUnlocked: () => void;
  onCancel: () => void;
}

/**
 * PIN que protege el modo terapeuta (Módulo 2, usado acá por el Módulo 4).
 *
 * No es una segunda autenticación: es la barrera para que el chico/a no entre
 * al editor sin querer mientras usa el comunicador. Por eso un PIN incorrecto
 * no cierra la sesión, sólo no abre la puerta.
 */
export function PinGateScreen({ token, onUnlocked, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const palette = paletteFor(undefined);

  async function handleSubmit() {
    setChecking(true);
    setError(null);
    try {
      const { valid } = await api.verifyPin(token, pin);
      if (valid) {
        onUnlocked();
      } else {
        setError('PIN incorrecto');
        setPin('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el PIN');
    } finally {
      setChecking(false);
    }
  }

  const canSubmit = pin.length === THERAPIST_PIN.length && !checking;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>Modo terapeuta</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]}>
        Ingresá el PIN de {THERAPIST_PIN.length} dígitos
      </Text>

      <TextInput
        testID="input-pin"
        accessibilityLabel="PIN"
        value={pin}
        onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, THERAPIST_PIN.length))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={THERAPIST_PIN.length}
        style={[styles.input, { borderColor: palette.border, color: palette.text }]}
      />

      {error && (
        <Text testID="pin-error" style={[styles.error, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          testID="button-pin-cancel"
          accessibilityRole="button"
          onPress={onCancel}
          style={[styles.secondary, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Cancelar</Text>
        </Pressable>

        <Pressable
          testID="button-pin-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[
            styles.primary,
            { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.5 },
          ]}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" testID="pin-checking" />
          ) : (
            <Text style={styles.primaryText}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 16 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    width: 220,
  },
  error: { fontSize: 15 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: { borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
