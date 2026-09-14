import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Palette } from '../../theme';
import { radius, spacing, touchTarget, typography } from '../../theme';

/**
 * Variantes de botón.
 *
 * Son cuatro porque son las cuatro que las pantallas ya usaban, no porque un
 * sistema de diseño suela tener cuatro: `primary` es la acción de la
 * pantalla, `secondary` la que la acompaña —volver, cancelar—, `danger` la
 * que destruye algo, y `link` la que no parece un botón pero lo es, como
 * "Ya tengo cuenta".
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

interface Props {
  label: string;
  onPress: () => void;
  palette: Palette;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Muestra un spinner en lugar del texto y bloquea el botón. */
  loading?: boolean;
  testID?: string;
  /**
   * Etiqueta para el lector de pantalla, cuando el texto visible no alcanza
   * para entender qué hace el botón fuera de su contexto —"Lo vi" no dice
   * de qué aviso—.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Botón de la app.
 *
 * Existe porque el mismo botón estaba escrito una vez por pantalla: sólo
 * entre las diez pantallas había ciento veintidós Pressables, cada uno con su
 * padding, su radio y su tamaño de texto. Además de verse distinto, cada
 * copia decidía por su cuenta si declaraba `accessibilityState` o si el
 * disabled se veía con opacidad 0.4 o 0.5.
 *
 * Dos cosas que el componente garantiza y que antes dependían de que quien
 * escribía la pantalla se acordara:
 *
 * El alto mínimo de 44 px, que es la restricción de accesibilidad que no se
 * negocia. Antes salía del padding vertical, así que un botón de texto corto
 * podía quedar por debajo sin que nadie lo notara.
 *
 * El `accessibilityState`, que es lo que hace que el lector de pantalla anuncie
 * un botón como deshabilitado en vez de dejar que alguien lo toque esperando
 * que pase algo.
 */
export function Button({
  label,
  onPress,
  palette,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
  accessibilityLabel,
  style,
}: Props) {
  // Un botón cargando no se puede tocar: sin esto, dos toques seguidos mandan
  // dos veces la misma invitación o el mismo perfil.
  const isBlocked = disabled || loading;
  const colors = colorsFor(variant, palette);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isBlocked }}
      disabled={isBlocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'link' && styles.link,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: variant === 'primary' || variant === 'link' ? 0 : 1,
          // El bloqueado se atenúa siempre igual; antes había pantallas con
          // 0.4 y otras con 0.5 para el mismo estado.
          opacity: isBlocked ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} testID={testID ? `${testID}-loading` : undefined} />
      ) : (
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Colores de cada variante.
 *
 * `primary` es la única que se rellena: en una pantalla tiene que haber una
 * sola acción que pese más que las demás, y si se rellenaran dos el chico/a o
 * el adulto no sabría cuál es la que se espera que toque.
 */
function colorsFor(variant: ButtonVariant, palette: Palette) {
  switch (variant) {
    case 'primary':
      return { background: palette.accent, border: 'transparent', text: '#FFFFFF' };
    case 'danger':
      return { background: 'transparent', border: palette.danger, text: palette.danger };
    case 'link':
      return { background: 'transparent', border: 'transparent', text: palette.accent };
    case 'secondary':
    default:
      return { background: 'transparent', border: palette.border, text: palette.text };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    // El alto mínimo va acá y no en el padding: así se cumple aunque la
    // etiqueta sea "Ir" y el padding no alcance para llegar a 44.
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El link no tiene caja, así que tampoco lleva el padding horizontal que
  // separaría su texto del borde que no existe.
  link: { paddingHorizontal: 0 },
  label: typography.button,
});
