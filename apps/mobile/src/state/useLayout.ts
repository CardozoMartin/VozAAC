import { useWindowDimensions } from 'react-native';
import { GRID_DIMENSIONS, GridSize } from '@vozaac/shared';

/** A partir de acá la pantalla se considera una tablet. */
const TABLET_MIN_SIDE = 600;

export interface Layout {
  /** El lado más largo está en horizontal. */
  isLandscape: boolean;
  /** El lado corto supera el umbral de tablet. */
  isTablet: boolean;
  /** Alcanza el espacio para la barra de frase completa y sus botones. */
  isCompact: boolean;
}

/**
 * Formato de la pantalla (Módulo 5).
 *
 * useWindowDimensions y no Dimensions.get: el segundo lee una sola vez y no se
 * entera cuando el dispositivo rota, que es justo lo que necesitamos saber
 * ahora que la app no está fijada en horizontal.
 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);

  return {
    isLandscape: width > height,
    isTablet: shortSide >= TABLET_MIN_SIDE,
    // Un celular en vertical: poco ancho para repartir entre pictogramas y
    // botones en una misma fila.
    isCompact: shortSide < TABLET_MIN_SIDE && height > width,
  };
}

/**
 * Filas y columnas efectivas para la pantalla actual.
 *
 * La configuración guarda "3x4" como intención del terapeuta —doce celdas—, no
 * como una disposición literal. En una pantalla alta y angosta esas doce
 * celdas entran mejor como 3 columnas × 4 filas que como 4 × 3: las celdas
 * quedan más cuadradas, y una celda cuadrada es más fácil de acertar que una
 * finita y alta, que es de lo que se trata todo el Módulo 5.
 *
 * Por eso en vertical se pone el lado mayor como filas y el menor como
 * columnas, y en horizontal al revés. La cantidad de celdas no cambia nunca:
 * el terapeuta eligió cuántos pictogramas mostrar, y rotar el dispositivo no
 * debería agregar ni sacar vocabulario.
 */
export function gridDimensionsFor(
  gridSize: GridSize,
  isLandscape: boolean,
): { columns: number; rows: number } {
  const { columns, rows } = GRID_DIMENSIONS[gridSize];
  const [larger, smaller] = columns >= rows ? [columns, rows] : [rows, columns];

  return isLandscape
    ? { columns: larger, rows: smaller }
    : { columns: smaller, rows: larger };
}
