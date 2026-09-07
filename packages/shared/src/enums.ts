/**
 * Rol del cuidador. Determina el alcance de lo que puede editar:
 * FAMILY edita el tablero de sus propios usuarios;
 * THERAPIST además accede a historial y reportes (Módulo 6).
 */
export enum CaregiverRole {
  FAMILY = 'family',
  THERAPIST = 'therapist',
}

/**
 * Tamaños de grilla del comunicador (Módulo 3 y 5).
 * Menos celdas = celdas más grandes = menor exigencia motriz.
 */
export enum GridSize {
  GRID_2X2 = '2x2',
  GRID_2X3 = '2x3',
  GRID_3X4 = '3x4',
  GRID_4X5 = '4x5',
}

/** Cantidad de celdas por tamaño de grilla. */
export const GRID_CELL_COUNT: Record<GridSize, number> = {
  [GridSize.GRID_2X2]: 4,
  [GridSize.GRID_2X3]: 6,
  [GridSize.GRID_3X4]: 12,
  [GridSize.GRID_4X5]: 20,
};

/** Filas y columnas por tamaño de grilla, en orden [columnas, filas]. */
export const GRID_DIMENSIONS: Record<GridSize, { columns: number; rows: number }> = {
  [GridSize.GRID_2X2]: { columns: 2, rows: 2 },
  [GridSize.GRID_2X3]: { columns: 2, rows: 3 },
  [GridSize.GRID_3X4]: { columns: 3, rows: 4 },
  [GridSize.GRID_4X5]: { columns: 4, rows: 5 },
};

/**
 * Modo de paleta de color. LOW_STIMULUS apaga saturación y contraste
 * para usuarios con hipersensibilidad visual (Módulo 5).
 */
export enum ColorMode {
  STANDARD = 'standard',
  LOW_STIMULUS = 'low_stimulus',
  HIGH_CONTRAST = 'high_contrast',
}

/** Origen del pictograma: banco ARASAAC o creado por el cuidador (Módulo 4). */
export enum PictogramSource {
  ARASAAC = 'arasaac',
  CUSTOM = 'custom',
}

/**
 * Tipo de evento registrado en RegistroDeUso (Módulo 6).
 * Distinguir el toque del pictograma del "hablar" de la frase completa
 * evita contar dos veces el mismo vocabulario en los reportes.
 */
export enum UsageEventType {
  PICTOGRAM_TAP = 'pictogram_tap',
  PHRASE_SPOKEN = 'phrase_spoken',
  PHRASE_CLEARED = 'phrase_cleared',
}
