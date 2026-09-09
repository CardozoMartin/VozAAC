/**
 * Límites del filtro anti-temblor (Módulo 5).
 *
 * El filtro distingue un toque intencional de uno accidental exigiendo que el
 * dedo se mantenga sobre la celda `holdToConfirmMs` milisegundos antes de
 * activarla, e ignorando toques que lleguen antes de `debounceMs` desde el
 * anterior. Los valores son configurables por usuario porque el temblor varía
 * mucho entre personas.
 */
export const TREMOR_FILTER = {
  /** Milisegundos que hay que sostener el toque para confirmarlo. */
  holdToConfirmMs: { min: 0, max: 2000, default: 300 },
  /** Ventana en la que se ignoran toques repetidos sobre la misma celda. */
  debounceMs: { min: 0, max: 2000, default: 500 },
  /** Píxeles de desplazamiento tolerados sin cancelar el toque sostenido. */
  moveTolerancePx: { min: 0, max: 60, default: 20 },
} as const;

/** Velocidad de la voz del TTS (Módulo 3 y 5). 1.0 es la velocidad nativa. */
export const SPEECH_RATE = { min: 0.5, max: 2.0, default: 1.0, step: 0.1 } as const;

/** Tono de la voz del TTS. */
export const SPEECH_PITCH = { min: 0.5, max: 2.0, default: 1.0, step: 0.1 } as const;

/** Validaciones de subida de archivos (Módulo 4). */
export const UPLOAD_LIMITS = {
  image: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  },
  audio: {
    maxSizeBytes: 2 * 1024 * 1024,
    maxDurationSeconds: 10,
    allowedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav'] as const,
  },
} as const;

/**
 * Cantidad máxima de pictogramas en la barra de frase (Módulo 3).
 *
 * No es una limitación técnica: una frase más larga que esto ya no se lee de
 * un vistazo en la barra, y para el uso AAC habitual doce símbolos sobran.
 */
export const MAX_PHRASE_LENGTH = 12;

/** Reglas del PIN que desbloquea el modo terapeuta (Módulo 2). */
export const THERAPIST_PIN = {
  length: 4,
  /** Solo dígitos: el teclado numérico es más accesible en tablet. */
  pattern: /^\d{4}$/,
} as const;

/** Largo mínimo de la contraseña del cuidador (Módulo 2). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Vinculación de dispositivos (Módulo 9).
 *
 * El código lo dicta un adulto y lo tipea otro en un teléfono, muchas veces
 * por teléfono o por mensaje. Por eso es corto y de un alfabeto sin caracteres
 * que se confundan al leerlos en voz alta: sin O/0, sin I/1/L.
 */
export const LINK_CODE = {
  length: 6,
  alphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  /**
   * Minutos que vive el código. Corto a propósito: se genera y se canjea en el
   * momento, con los dos dispositivos sobre la mesa. Si vence, se pide otro.
   */
  expiresInMinutes: 15,
  /**
   * Intentos fallidos antes de invalidar el código. Con 31^6 combinaciones el
   * riesgo real de adivinarlo es bajo, pero un código de 6 caracteres sin
   * límite de intentos es igualmente algo que no queremos dejar abierto.
   */
  maxAttempts: 5,
} as const;

/**
 * Nombre con el que se muestra un dispositivo vinculado que no informó el suyo.
 * El padre necesita reconocerlo en la lista para poder revocarlo.
 */
export const DEFAULT_DEVICE_NAME = 'Dispositivo sin nombre';
