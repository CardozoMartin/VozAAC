import { useState } from 'react';
import {
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
import { maxFormWidth, paletteFor, radius, spacing, typography } from '../theme';
import { Button } from '../components/ui';

interface Props {
  onLoggedIn: (token: string) => void;
  /** Abre el canje de código, para enrolar este dispositivo (Módulo 9). */
  onLinkDevice: () => void;
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
export function LoginScreen({ onLoggedIn, onLinkDevice }: Props) {
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

          <Button
            testID="button-login"
            label={isRegistering ? 'Crear cuenta' : 'Entrar'}
            palette={palette}
            disabled={!canSubmit}
            loading={loading}
            onPress={handleSubmit}
          />

          <Button
            testID="button-toggle-mode"
            label={isRegistering ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
            variant="link"
            palette={palette}
            onPress={toggleMode}
          />

          {/*
            Salida para el dispositivo del chico/a y el del otro responsable:
            no tienen cuenta propia y nunca van a tenerla, así que entran con
            el código que les dicta quien ya configuró la app.
          */}
          <Pressable
            testID="button-open-link"
            accessibilityRole="button"
            accessibilityLabel="Tengo un código de vinculación"
            onPress={onLinkDevice}
            style={styles.link}
          >
            <Text style={[styles.linkText, { color: palette.textMuted }]}>
              Tengo un código de vinculación
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  form: { width: '100%', maxWidth: maxFormWidth, gap: spacing.md },
  // El título de la app es más grande que el de una pantalla común: es lo
  // primero que se ve al abrirla y no compite con nada.
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center', marginBottom: spacing.md },
  input: { borderWidth: 2, borderRadius: radius.button, padding: spacing.md, fontSize: 18 },
  hint: { ...typography.caption, textAlign: 'center' },
  error: { ...typography.body, textAlign: 'center' },
  // La salida por código queda deliberadamente más apagada que el enlace de
  // arriba: es para el dispositivo del chico/a, no para quien viene a entrar
  // con su cuenta.
  link: { paddingVertical: spacing.sm, alignItems: 'center' },
  linkText: { ...typography.body, fontWeight: '600' },
});
