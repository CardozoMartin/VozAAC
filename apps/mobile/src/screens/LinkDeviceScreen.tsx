import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LINK_CODE } from '@vozaac/shared';
import type { DeviceAuthResponse } from '@vozaac/shared';
import { api } from '../api/client';
import { paletteFor, spacing } from '../theme';

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

  const canSubmit = code.length === LINK_CODE.length && !linking;

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
        <Pressable
          testID="button-link-cancel"
          accessibilityRole="button"
          onPress={onCancel}
          style={[styles.secondary, { borderColor: palette.border }]}
        >
          <Text style={{ color: palette.textMuted }}>Volver</Text>
        </Pressable>

        <Pressable
          testID="button-link-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[
            styles.primary,
            { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.5 },
          ]}
        >
          {linking ? (
            <ActivityIndicator color="#FFFFFF" testID="linking" />
          ) : (
            <Text style={styles.primaryText}>Vincular</Text>
          )}
        </Pressable>
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
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', maxWidth: 380 },
  codeInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 32,
    letterSpacing: 10,
    textAlign: 'center',
    width: 280,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    width: 280,
  },
  error: { fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  primary: {
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
