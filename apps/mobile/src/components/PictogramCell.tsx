import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pictogram } from '@vozaac/shared';
import type { Palette } from '../theme';
import { spacing } from '../theme';

interface Props {
  pictogram: Pictogram;
  /** Color de la categoría, que se usa como borde (convención Fitzgerald Key). */
  color: string;
  palette: Palette;
  onPress: (pictogram: Pictogram) => void;
  /**
   * Props del filtro anti-temblor (Módulo 5). Se aceptan desde ahora para que
   * el Módulo 5 no tenga que reescribir la grilla: hoy el toque es directo.
   */
  holdToConfirmMs?: number;
  debounceMs?: number;
  moveTolerancePx?: number;
}

/**
 * Una celda de la grilla.
 *
 * El área táctil ocupa toda la celda —no sólo la imagen— porque la puntería
 * fina no se puede dar por supuesta.
 */
export function PictogramCell({ pictogram, color, palette, onPress }: Props) {
  return (
    <Pressable
      testID={`pictogram-${pictogram.id}`}
      accessibilityRole="button"
      accessibilityLabel={pictogram.text}
      onPress={() => onPress(pictogram)}
      style={({ pressed }) => [
        styles.cell,
        {
          borderColor: color,
          backgroundColor: palette.surface,
          // Respuesta visual inmediata: confirma el toque a quien no oye el TTS.
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: pictogram.imageUrl }}
          style={styles.image}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={2}>
        {pictogram.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    margin: spacing.xs,
    borderWidth: 3,
    borderRadius: 12,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  text: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
