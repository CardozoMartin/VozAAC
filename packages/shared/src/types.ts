import type { CaregiverRole, ColorMode, GridSize, PictogramSource, UsageEventType } from './enums';

/** Forma en que las entidades viajan por la API (sin campos internos ni hashes). */

export interface Caregiver {
  id: string;
  email: string;
  fullName: string;
  role: CaregiverRole;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  birthDate: string | null;
  photoUrl: string | null;
  caregiverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  isDefault: boolean;
  userId: string;
  categories?: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  boardId: string;
  pictograms?: Pictogram[];
  createdAt: string;
  updatedAt: string;
}

export interface Pictogram {
  id: string;
  text: string;
  imageUrl: string;
  audioUrl: string | null;
  source: PictogramSource;
  arasaacId: number | null;
  order: number;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessibilitySettings {
  id: string;
  userId: string;
  gridSize: GridSize;
  colorMode: ColorMode;
  tremorFilterEnabled: boolean;
  holdToConfirmMs: number;
  debounceMs: number;
  moveTolerancePx: number;
  speechRate: number;
  speechPitch: number;
  voiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageLog {
  id: string;
  userId: string;
  pictogramId: string | null;
  eventType: UsageEventType;
  phraseText: string | null;
  occurredAt: string;
}

/** Fila del reporte de pictogramas más usados (Módulo 6). */
export interface PictogramUsageStat {
  pictogramId: string;
  text: string;
  imageUrl: string;
  count: number;
}

/** Punto de la serie de evolución de vocabulario en el tiempo (Módulo 6). */
export interface VocabularyGrowthPoint {
  date: string;
  distinctPictograms: number;
  totalTaps: number;
}
