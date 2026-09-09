import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

/** Largo mínimo de contraseña que acepta la API. */
const MIN_PASSWORD = 8;

/**
 * Login y registro del adulto responsable (Módulo 2).
 *
 * Las dos cosas en una pantalla y no en dos: es la primera pantalla de la app,
 * y quien la abre por primera vez no tiene por qué adivinar dónde se crea la
 * cuenta. Alcanza con alternar.
 *
 * Sólo se registra el adulto —madre, padre, terapeuta—. El chico/a nunca tiene
 * credenciales: quien usa un comunicador AAC muchas veces no lee ni escribe, y
 * pedirle una contraseña sería ponerle una barrera de texto delante de su
 * propia voz. Entra tocando su foto en el selector de perfiles.
 */
export function LoginScreen({ onLoggedIn }: Props) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const palette = paletteFor(undefined);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const { accessToken } = isRegistering
        ? await api.register(email.trim(), password, fullName.trim())
        : await api.login(email.trim(), password);
      onLoggedIn(accessToken);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isRegistering
            ? 'No se pudo crear la cuenta'
            : 'No se pudo iniciar sesión',
      );
    } finally {
      setLoading(false);
    }
  }

  /** Alterna entre entrar y registrarse, sin arrastrar el error del otro modo. */
  function toggleMode() {
    setIsRegistering((previous) => !previous);
    setError(null);
  }

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (!isRegistering || (fullName.trim().length > 0 && password.length >= MIN_PASSWORD)) &&
    !loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        testID="login-screen"
      >
        <View style={styles.form}>
          <Text style={[styles.title, { color: palette.text }]}>VozAAC</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {isRegistering
              ? 'Creá tu cuenta para configurar el comunicador'
              : 'Ingresá con tu cuenta de cuidador o terapeuta'}
          </Text>

          {isRegistering && (
            <TextInput
              testID="input-fullname"
              accessibilityLabel="Nombre y apellido"
              placeholder="Nombre y apellido"
              placeholderTextColor={palette.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
          )}

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

          {isRegistering && (
            <Text style={[styles.hint, { color: palette.textMuted }]}>
              La contraseña necesita al menos {MIN_PASSWORD} caracteres.
            </Text>
          )}

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
            style={[
              styles.button,
              { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.5 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" testID="login-loading" />
            ) : (
              <Text style={styles.buttonText}>{isRegistering ? 'Crear cuenta' : 'Entrar'}</Text>
            )}
          </Pressable>

          <Pressable
            testID="button-toggle-mode"
            accessibilityRole="button"
            accessibilityLabel={isRegistering ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
            onPress={toggleMode}
            style={styles.link}
          >
            <Text style={[styles.linkText, { color: palette.accent }]}>
              {isRegistering ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  form: { width: '100%', maxWidth: 420, gap: spacing.md },
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: spacing.md },
  input: { borderWidth: 2, borderRadius: 12, padding: spacing.md, fontSize: 18 },
  hint: { fontSize: 13, textAlign: 'center' },
  error: { fontSize: 15, textAlign: 'center' },
  button: { borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  link: { paddingVertical: spacing.sm, alignItems: 'center' },
  linkText: { fontSize: 16, fontWeight: '600' },
});
