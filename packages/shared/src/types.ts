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
  /** Si tocarlo avisa a los responsables (Módulo 9, paso 4). */
  isUrgent: boolean;
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

/**
 * Un responsable de un chico/a, como se ve en la pantalla donde se administran
 * (Módulo 9, paso 3).
 *
 * Todos los responsables pueden lo mismo, así que acá no hay rol ni permisos:
 * `relationship` es sólo una etiqueta para distinguir quién es quién.
 */
export interface ProfileCaregiverInfo {
  id: string;
  caregiverId: string;
  fullName: string;
  email: string;
  relationship: string | null;
  /** Si es el cuidador que está mirando, para no ofrecerle quitarse a sí mismo. */
  isSelf: boolean;
  createdAt: string;
}

/** Invitación recién generada, tal como se le muestra a quien invita. */
export interface InviteCodeResponse {
  code: string;
  userId: string;
  /** Nombre del chico/a, para que quien invita confirme que es el correcto. */
  profileName: string;
  relationship: string | null;
  expiresAt: string;
}

/** Lo que recibe quien acepta una invitación. */
export interface AcceptInviteResponse {
  userId: string;
  profileName: string;
  relationship: string | null;
}

/**
 * Aviso que dispara un pictograma urgente (Módulo 9, paso 4).
 *
 * Guarda el texto además del id del pictograma: si el terapeuta lo borra o lo
 * renombra después, el responsable tiene que poder seguir leyendo qué avisó el
 * chico/a esa noche.
 */
export interface Alert {
  id: string;
  userId: string;
  profileName: string;
  pictogramId: string | null;
  pictogramText: string;
  pictogramImageUrl: string | null;
  occurredAt: string;
  /** Cuándo alguien la marcó como vista, o null si sigue pendiente. */
  acknowledgedAt: string | null;
  /** Quién la marcó como vista, para que los demás sepan que ya fue atendida. */
  acknowledgedByName: string | null;
}

/** Resultado de una búsqueda en el banco ARASAAC (Módulo 4). */
export interface ArasaacPictogram {
  id: number;
  text: string;
  imageUrl: string;
}

/**
 * Lo que manda un dispositivo para poder recibir avisos push (Módulo 9, paso 5).
 *
 * El token lo emite Expo y corresponde a la instalación de la app en ese
 * teléfono: cambia si la reinstalan, así que la app lo reenvía en cada arranque
 * y el backend hace upsert en vez de fallar por duplicado.
 */
export interface RegisterPushTokenRequest {
  /** Token de Expo, con forma `ExponentPushToken[...]`. */
  token: string;
  /** Para saber si el problema es de una plataforma cuando algo no llega. */
  platform: 'ios' | 'android' | 'web';
}

/**
 * Resultado del envío de un aviso, para que el que dispara sepa si llegó.
 *
 * No se usa para decidir nada en la app del chico/a —el aviso ya quedó
 * guardado y el polling lo va a mostrar igual— pero sirve para diagnosticar
 * por qué una familia no recibe nada.
 */
export interface PushDeliveryReport {
  /** Dispositivos a los que se intentó mandar. */
  attempted: number;
  /** Cuántos aceptó Expo. */
  accepted: number;
  /** Tokens que Expo rechazó por muertos y se dieron de baja. */
  removed: number;
}
