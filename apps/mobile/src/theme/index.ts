import { ColorMode } from '@vozaac/shared';

/**
 * Paletas del comunicador.
 *
 * LOW_STIMULUS baja saturación y contraste para chicos/as con
 * hipersensibilidad visual; HIGH_CONTRAST hace lo contrario, para baja visión.
 * El Módulo 5 deja elegir cuál usar; acá quedan definidas las tres.
 */
export const palettes = {
  [ColorMode.STANDARD]: {
    background: '#FFFFFF',
    surface: '#F4F6F8',
    text: '#1B2733',
    textMuted: '#5A6B7B',
    border: '#D3DCE3',
    accent: '#2F6FB0',
    danger: '#C0453B',
  },
  [ColorMode.LOW_STIMULUS]: {
    background: '#EDEAE4',
    surface: '#E2DED6',
    text: '#3D3A34',
    textMuted: '#6B665E',
    border: '#CDC7BC',
    accent: '#6E7F73',
    danger: '#9A6A62',
  },
  [ColorMode.HIGH_CONTRAST]: {
    background: '#000000',
    surface: '#141414',
    text: '#FFFFFF',
    textMuted: '#D0D0D0',
    border: '#FFFFFF',
    accent: '#FFD400',
    danger: '#FF6B5E',
  },
} as const;

export type Palette = (typeof palettes)[ColorMode];

export function paletteFor(mode: ColorMode | undefined): Palette {
  return palettes[mode ?? ColorMode.STANDARD];
}

/**
 * En modo bajo estímulo el color propio de cada categoría se atenúa: el borde
 * sigue distinguiendo las categorías, pero sin saturación fuerte.
 */
export function categoryColor(color: string, mode: ColorMode | undefined): string {
  return mode === ColorMode.LOW_STIMULUS ? '#9AA39C' : color;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24 } as const;
