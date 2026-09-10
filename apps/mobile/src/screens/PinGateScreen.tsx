import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { THERAPIST_PIN } from '@vozaac/shared';
import { api } from '../api/client';
import { codeTypography, paletteFor, radius, spacing, typography } from '../theme';
import { Button } from '../components/ui';

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
        <Button
          testID="button-pin-cancel"
          label="Cancelar"
          variant="secondary"
          palette={palette}
          onPress={onCancel}
          style={styles.action}
        />

        <Button
          testID="button-pin-submit"
          label="Entrar"
          palette={palette}
          disabled={pin.length !== THERAPIST_PIN.length}
          loading={checking}
          onPress={handleSubmit}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: typography.title,
  subtitle: typography.body,
  input: {
    borderWidth: 2,
    borderRadius: radius.button,
    padding: spacing.md,
    ...codeTypography.input,
    textAlign: 'center',
    width: 220,
  },
  error: typography.body,
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  // Los dos botones miden lo mismo: "Entrar" es más corto que "Cancelar", y
  // desparejos el ojo leería el de cancelar como la acción principal.
  action: { minWidth: 130 },
});
