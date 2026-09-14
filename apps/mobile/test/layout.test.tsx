import { GRID_CELL_COUNT, GridSize } from '@vozaac/shared';
import { gridDimensionsFor } from '../src/state/useLayout';

/**
 * Disposición de la grilla según la orientación.
 *
 * La app dejó de estar fijada en horizontal para que funcione en el celular
 * que la familia ya tiene, y no sólo en una tablet. Lo que estos tests
 * protegen es que rotar no cambie cuánto vocabulario se ve: el terapeuta
 * eligió cuántos pictogramas mostrar, y la orientación es del dispositivo.
 */
describe('gridDimensionsFor', () => {
  const tamaños = Object.values(GridSize);

  it('conserva la cantidad de celdas en las dos orientaciones', () => {
    for (const size of tamaños) {
      const horizontal = gridDimensionsFor(size, true);
      const vertical = gridDimensionsFor(size, false);

      expect(horizontal.columns * horizontal.rows).toBe(GRID_CELL_COUNT[size]);
      expect(vertical.columns * vertical.rows).toBe(GRID_CELL_COUNT[size]);
    }
  });

  it('pone el lado largo en horizontal cuando la pantalla es apaisada', () => {
    for (const size of tamaños) {
      const { columns, rows } = gridDimensionsFor(size, true);
      expect(columns).toBeGreaterThanOrEqual(rows);
    }
  });

  it('pone el lado largo en vertical cuando la pantalla es alta', () => {
    for (const size of tamaños) {
      const { columns, rows } = gridDimensionsFor(size, false);
      expect(rows).toBeGreaterThanOrEqual(columns);
    }
  });

  it('transpone la 3x4: doce celdas en las dos orientaciones', () => {
    // En la tablet apaisada, cuatro columnas; en el celular vertical, tres
    // columnas y cuatro filas, que deja celdas más cuadradas.
    expect(gridDimensionsFor(GridSize.GRID_3X4, true)).toEqual({ columns: 4, rows: 3 });
    expect(gridDimensionsFor(GridSize.GRID_3X4, false)).toEqual({ columns: 3, rows: 4 });
  });

  it('deja la 2x2 igual, que es simétrica', () => {
    expect(gridDimensionsFor(GridSize.GRID_2X2, true)).toEqual({ columns: 2, rows: 2 });
    expect(gridDimensionsFor(GridSize.GRID_2X2, false)).toEqual({ columns: 2, rows: 2 });
  });

  it('en vertical nunca deja más columnas que filas, ni con la grilla más grande', () => {
    // La 4x5 es la que más sufre en un celular angosto: cinco columnas darían
    // celdas finitas, imposibles de acertar con poca puntería fina.
    const { columns, rows } = gridDimensionsFor(GridSize.GRID_4X5, false);

    expect(columns).toBe(4);
    expect(rows).toBe(5);
  });
});
