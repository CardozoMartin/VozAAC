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

/**
 * Invitación de otro responsable a un chico/a (Módulo 9, paso 3).
 *
 * Reusa la forma del código de vinculación —mismo alfabeto y mismo largo,
 * porque se dicta igual— pero es otra cosa: no enrola un dispositivo, suma a
 * una persona que tiene su propia cuenta. Por eso vive más: quien invita puede
 * mandarlo por mensaje y la otra persona registrarse recién a la noche.
 */
export const INVITE_CODE = {
  length: LINK_CODE.length,
  alphabet: LINK_CODE.alphabet,
  expiresInHours: 48,
  maxAttempts: LINK_CODE.maxAttempts,
} as const;

/**
 * Alertas de pictogramas urgentes (Módulo 9, paso 4).
 *
 * Cuando el chico/a toca un pictograma marcado como urgente —"me duele", "me
 * siento mal"— les llega un aviso a sus responsables.
 */
export const URGENT_ALERT = {
  /**
   * Milisegundos extra de hold sobre un pictograma urgente, además del que ya
   * pida el filtro anti-temblor.
   *
   * Un toque accidental que despierte a alguien a las 3 AM hace que la función
   * se desactive en una semana. Pedir sostener más que en un pictograma común
   * es la barrera más barata contra eso, y reusa el mecanismo del Módulo 5 en
   * vez de sumar un diálogo de confirmación que el chico/a tendría que leer.
   */
  extraHoldMs: 700,
  /**
   * Hold mínimo de un pictograma urgente cuando el filtro anti-temblor está
   * apagado. Sin esto, en un tablero sin filtro el aviso saldría con un roce.
   */
  minHoldMs: 800,
  /**
   * Cuánto se le muestra al chico/a el "avisado ✓".
   *
   * Tiene que ver que su mensaje salió: si no, no sabe si sirvió de algo y lo
   * va a tocar diez veces.
   */
  confirmationMs: 4000,
  /** Cada cuánto la app del responsable consulta si hay alertas nuevas. */
  pollIntervalMs: 20_000,
} as const;
