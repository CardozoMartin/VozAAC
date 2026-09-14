import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { LINK_CODE } from '@vozaac/shared';
import type { DeviceAuthResponse } from '@vozaac/shared';
import { api } from '../api/client';
import { codeTypography, paletteFor, radius, spacing, typography } from '../theme';
import { Button } from '../components/ui';

interface Props {
  onLinked: (respuesta: DeviceAuthResponse) => void;
  onCancel: () => void;
}

/**
 * Canje del código de vinculación, en el dispositivo que se está enrolando
 * (Módulo 9).
 *
 * Se ve una sola vez en la vida del dispositivo: después de esto la sesión no
 * vuelve a pedirse nunca, ni siquiera al reiniciar. Es el patrón de Netflix o
 * Spotify Connect, y por eso vale la pena que esta pantalla sea clara aunque
 * casi nadie la vea dos veces.
 *
 * El nombre del dispositivo se pide acá y no después: es lo que el cuidador va
 * a leer en su lista cuando tenga que decidir cuál revocar, y "Tablet de Mía"
 * le sirve y "Dispositivo sin nombre" no.
 */
export function LinkDeviceScreen({ onLinked, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const palette = paletteFor(undefined);

  async function handleSubmit() {
    setLinking(true);
    setError(null);
    try {
      const respuesta = await api.redeemLinkCode(code, deviceName.trim() || undefined);
      onLinked(respuesta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular el dispositivo');
      // El código quedó quemado igual —sirve una sola vez—, así que se limpia
      // para que nadie lo reintente creyendo que fue un error de tipeo.
      setCode('');
    } finally {
      setLinking(false);
    }
  }

  /**
   * Normaliza mientras se tipea: mayúsculas y sin espacios ni guiones.
   *
   * Quien tipea está escuchando el código dictado por teléfono, así que puede
   * escribirlo de cualquier forma. La API también normaliza, pero corregirlo
   * acá deja ver en pantalla exactamente lo que se va a enviar.
   */
  function handleCodeChange(value: string) {
    setCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, LINK_CODE.length),
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <Text style={[styles.title, { color: palette.text }]}>Vincular este dispositivo</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]}>
        Pedile el código a quien configuró la app y escribilo acá. Se usa una sola vez.
      </Text>

      <TextInput
        testID="input-link-code"
        accessibilityLabel="Código de vinculación"
        value={code}
        onChangeText={handleCodeChange}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={LINK_CODE.length}
        placeholder={'-'.repeat(LINK_CODE.length)}
        placeholderTextColor={palette.textMuted}
        style={[styles.codeInput, { borderColor: palette.border, color: palette.text }]}
      />

      <TextInput
        testID="input-device-name"
        accessibilityLabel="Nombre del dispositivo"
        value={deviceName}
        onChangeText={setDeviceName}
        placeholder="Nombre del dispositivo (opcional)"
        placeholderTextColor={palette.textMuted}
        maxLength={120}
        style={[styles.nameInput, { borderColor: palette.border, color: palette.text }]}
      />

      {error && (
        <Text testID="link-error" style={[styles.error, { color: palette.danger }]}>
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          testID="button-link-cancel"
          label="Volver"
          variant="secondary"
          palette={palette}
          onPress={onCancel}
          style={styles.action}
        />

        <Button
          testID="button-link-submit"
          label="Vincular"
          palette={palette}
          disabled={code.length !== LINK_CODE.length}
          loading={linking}
          onPress={handleSubmit}
          style={styles.action}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center', maxWidth: 380 },
  codeInput: {
    borderWidth: 2,
    borderRadius: radius.button,
    padding: spacing.md,
    ...codeTypography.input,
    textAlign: 'center',
    width: 280,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.md,
    fontSize: 16,
    width: 280,
  },
  error: { ...typography.body, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { minWidth: 130 },
});
