import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GRID_DIMENSIONS, GridSize, type Pictogram } from '@vozaac/shared';
import { PictogramCell } from './PictogramCell';
import type { Palette } from '../theme';
import { spacing } from '../theme';

interface Props {
  pictograms: Pictogram[];
  gridSize: GridSize;
  color: string;
  palette: Palette;
  onSelect: (pictogram: Pictogram) => void;
}

/**
 * Grilla de pictogramas, con el tamaño que configuró el terapeuta (Módulo 5).
 *
 * Se arma con filas de Views y no con FlatList numColumns porque las celdas
 * tienen que repartirse el alto disponible: menos celdas significa celdas más
 * grandes, que es justamente el sentido de poder elegir 2x2 en vez de 4x5.
 *
 * Los pictogramas que no entran en la página quedan fuera por ahora; la
 * paginación llega con el editor del Módulo 4.
 */
export function PictogramGrid({ pictograms, gridSize, color, palette, onSelect }: Props) {
  const { columns, rows } = GRID_DIMENSIONS[gridSize];

  const grid = useMemo(() => {
    const visible = pictograms.slice(0, columns * rows);
    return Array.from({ length: rows }, (_, row) =>
      visible.slice(row * columns, row * columns + columns),
    );
  }, [pictograms, columns, rows]);

  if (pictograms.length === 0) {
    return (
      <View style={styles.empty} testID="grid-empty">
        <Text style={[styles.emptyText, { color: palette.textMuted }]}>
          Esta categoría todavía no tiene pictogramas
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid} testID="pictogram-grid">
      {grid.map((rowItems, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {rowItems.map((pictogram) => (
            <PictogramCell
              key={pictogram.id}
              pictogram={pictogram}
              color={color}
              palette={palette}
              onPress={onSelect}
            />
          ))}
          {/* Rellena la última fila para que las celdas no se estiren de más. */}
          {rowItems.length < columns &&
            Array.from({ length: columns - rowItems.length }, (_, index) => (
              <View key={`hueco-${index}`} style={styles.filler} />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, padding: spacing.xs },
  row: { flex: 1, flexDirection: 'row' },
  filler: { flex: 1, margin: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { fontSize: 18, textAlign: 'center' },
});
