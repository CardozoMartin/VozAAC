import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../theme';
import { codeTypography, radius, spacing } from '../../theme';

interface Props {
  /** El código a mostrar, de seis caracteres. */
  code: string;
  /** Qué hacer con el código: "Escribí este código en el otro dispositivo". */
  label: string;
  /** Cuánto dura y cuántas veces se usa. */
  hint: string;
  palette: Palette;
  testID?: string;
  /** testID del texto del código, que es lo que las pruebas leen. */
  valueTestID?: string;
}

/**
 * El panel donde se muestra un código de vinculación.
 *
 * Aparece en dispositivos y en responsables, y hasta ahora estaba escrito dos
 * veces con el mismo dibujo pero distinto tamaño de letra y distinto
 * espaciado, más otras dos variantes en las pantallas donde el código se
 * escribe en vez de leerse.
 *
 * Que sea un componente no es sólo prolijidad: este código se dicta en voz
 * alta desde el otro lado de la habitación, muchas veces por teléfono, y el
 * tamaño y el espaciado entre letras son lo que hace que quien escucha no
 * confunda un carácter. El alfabeto ya evita O/0 y I/1/L por la misma razón;
 * el tratamiento visual es la otra mitad de esa decisión, y conviene que no
 * dependa de qué pantalla lo esté mostrando.
 *
 * El código se lee de a un carácter para el lector de pantalla: de corrido,
 * "K7M2P9" se anuncia como una palabra impronunciable.
 */
export function CodeDisplay({ code, label, hint, palette, testID, valueTestID }: Props) {
  return (
    <View
      testID={testID}
      style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>

      <Text
        testID={valueTestID}
        accessibilityLabel={code.split('').join(' ')}
        style={[styles.code, { color: palette.text }]}
      >
        {code}
      </Text>

      <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { fontSize: 15, textAlign: 'center' },
  code: codeTypography.display,
  hint: { fontSize: 14, textAlign: 'center' },
});
