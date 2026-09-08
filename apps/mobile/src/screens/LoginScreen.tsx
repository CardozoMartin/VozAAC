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
import { api } from '../api/client';
import { paletteFor, spacing } from '../theme';

interface Props {
  onLoggedIn: (token: string) => void;
}

/** Login del cuidador o terapeuta (Módulo 2). */
export function LoginScreen({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const palette = paletteFor(undefined);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const { accessToken } = await api.login(email.trim(), password);
      onLoggedIn(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <View style={styles.form}>
        <Text style={[styles.title, { color: palette.text }]}>VozAAC</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Ingresá con tu cuenta de cuidador o terapeuta
        </Text>

        <TextInput
          testID="input-email"
          accessibilityLabel="Email"
          placeholder="Email"
          placeholderTextColor={palette.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />

        <TextInput
          testID="input-password"
          accessibilityLabel="Contraseña"
          placeholder="Contraseña"
          placeholderTextColor={palette.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />

        {error && (
          <Text testID="login-error" style={[styles.error, { color: palette.danger }]}>
            {error}
          </Text>
        )}

        <Pressable
          testID="button-login"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.button, { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.5 }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" testID="login-loading" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  form: { width: '100%', maxWidth: 420, gap: spacing.md },
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: spacing.md },
  input: { borderWidth: 2, borderRadius: 12, padding: spacing.md, fontSize: 18 },
  error: { fontSize: 15, textAlign: 'center' },
  button: { borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
});
