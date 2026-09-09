import type {
  CaregiverRole,
  ColorMode,
  DeviceKind,
  GridSize,
  PictogramSource,
  UsageEventType,
} from './enums';

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

/** Respuesta del login y del registro (Módulo 2). */
export interface AuthResponse {
  accessToken: string;
  caregiver: Caregiver;
}

/**
 * Respuesta al canjear un código de vinculación (Módulo 9).
 *
 * Trae el refresh token además del de acceso: este dispositivo tiene que poder
 * renovar su sesión solo, sin que nadie vuelva a escribir una contraseña.
 */
export interface DeviceAuthResponse extends AuthResponse {
  refreshToken: string;
  device: LinkedDevice;
  /** Perfil al que quedó atado el dispositivo, si se vinculó a uno. */
  profile: UserProfile | null;
}

/** Par de tokens que devuelve /auth/refresh. */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Código de vinculación recién generado, tal como se le muestra al adulto. */
export interface LinkCodeResponse {
  code: string;
  kind: DeviceKind;
  expiresAt: string;
  /** Perfil al que va a quedar atado el dispositivo; null para un responsable. */
  userId: string | null;
}

/**
 * Dispositivo vinculado, como aparece en la lista desde la que el cuidador
 * revoca accesos (Módulo 9).
 */
export interface LinkedDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  userId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

/** Contenido del JWT. `sub` es el id del cuidador, por convención de JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: CaregiverRole;
}

/**
 * Perfil de niño/a tal como lo ve el selector de perfiles (Módulo 2).
 * Incluye la edad ya calculada para que la app no tenga que derivarla.
 */
export interface UserProfile extends User {
  age: number | null;
}

/** Resultado de una búsqueda en el banco ARASAAC (Módulo 4). */
export interface ArasaacPictogram {
  id: number;
  text: string;
  imageUrl: string;
}
