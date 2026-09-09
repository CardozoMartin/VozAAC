import { useCallback, useEffect, useRef } from 'react';
import { TREMOR_FILTER } from '@vozaac/shared';

export interface TremorFilterOptions {
  enabled: boolean;
  /** Milisegundos que hay que sostener el toque para confirmarlo. */
  holdToConfirmMs: number;
  /** Ventana en la que se ignora un toque que llega pegado al anterior. */
  debounceMs: number;
  /** Píxeles de desplazamiento tolerados sin cancelar el toque sostenido. */
  moveTolerancePx: number;
}

/** Posición del dedo, en coordenadas de pantalla. */
export interface TouchPoint {
  x: number;
  y: number;
}

export interface TremorFilterHandlers {
  onPressIn: (point?: TouchPoint) => void;
  onPressOut: () => void;
  onTouchMove: (point: TouchPoint) => void;
  /** Toque directo, para cuando el filtro está apagado. */
  onPress: () => void;
}

/**
 * Filtro anti-temblor (Módulo 5).
 *
 * Distingue un toque intencional de uno accidental con tres reglas que se
 * combinan:
 *
 * 1. **Hold to confirm** — el dedo tiene que quedarse `holdToConfirmMs` sobre
 *    la celda. Un roce al pasar la mano no llega a cumplirlo.
 * 2. **Debounce** — un toque que llega antes de `debounceMs` desde la última
 *    activación se descarta. Es el rebote del temblor: la mano vuelve a caer
 *    sobre la misma celda sin que la persona haya querido repetir.
 * 3. **Tolerancia de movimiento** — si el dedo se corre más de
 *    `moveTolerancePx` mientras sostiene, se cancela. Ahí ya no es un toque
 *    sino un arrastre, y quien tiembla no apunta dos veces al mismo lugar.
 *
 * La activación ocurre al cumplirse el hold y no al levantar el dedo. Importa:
 * el chico/a recibe la respuesta —voz e imagen— mientras todavía está tocando,
 * que es lo que enseña la relación entre el gesto y su efecto. Esperar al
 * `onPressOut` haría que soltar tarde pareciera que la app no responde.
 *
 * Con el filtro apagado el toque es directo, sin timers: la mayoría de los
 * chicos/as no lo necesita y agregar 300 ms de latencia a todos sería peor.
 */
export function useTremorFilter(
  options: TremorFilterOptions,
  onConfirm: () => void,
): TremorFilterHandlers {
  const { enabled, holdToConfirmMs, debounceMs, moveTolerancePx } = options;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<TouchPoint | null>(null);
  const lastConfirmAt = useRef(0);
  /**
   * Si hay un toque en curso. Va aparte del timer porque el timer se limpia al
   * confirmar y con hold en 0 nunca llega a existir, así que no sirve para
   * saber si el dedo sigue apoyado.
   */
  const pressing = useRef(false);

  // En refs y no en el closure del timer: el callback se crea al empezar el
  // toque, y para cuando se dispara el pictograma pudo haber cambiado.
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // El origen sobrevive a la cancelación: onTouchMove sigue llegando
    // mientras el dedo no se levante, y sin origen no podría medir nada. Lo
    // limpia onPressIn al empezar el toque siguiente.
    pressing.current = false;
  }, []);

  // Un pictograma que se desmonta mientras el dedo lo sostiene —cambio de tab,
  // o el terapeuta que lo borró— no debe activarse igual medio segundo después.
  useEffect(() => cancel, [cancel]);

  /**
   * ¿Pasó suficiente tiempo desde la última activación?
   *
   * Se mide contra la activación anterior y no contra el toque anterior: lo
   * que molesta es que la frase reciba dos pictogramas, no que el dedo rebote.
   */
  const passesDebounce = useCallback(() => {
    if (debounceMs <= 0) return true;
    return Date.now() - lastConfirmAt.current >= debounceMs;
  }, [debounceMs]);

  const confirm = useCallback(() => {
    if (!passesDebounce()) {
      cancel();
      return;
    }
    lastConfirmAt.current = Date.now();
    cancel();
    confirmRef.current();
  }, [cancel, passesDebounce]);

  const onPressIn = useCallback(
    (point?: TouchPoint) => {
      if (!enabled) return;

      // Antes de fijar el origen: cancel() limpia el estado del toque previo.
      cancel();
      startPoint.current = point ?? null;
      pressing.current = true;

      // Con hold en 0 el filtro sigue aplicando debounce y tolerancia, pero
      // sin la espera. Es la configuración de quien tiene rebote y no temblor.
      if (holdToConfirmMs <= 0) {
        confirm();
        return;
      }

      timer.current = setTimeout(confirm, holdToConfirmMs);
    },
    [enabled, holdToConfirmMs, cancel, confirm],
  );

  const onTouchMove = useCallback(
    (point: TouchPoint) => {
      if (!enabled || !pressing.current) return;

      const origin = startPoint.current;
      if (!origin) return;

      const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      if (distance > moveTolerancePx) {
        cancel();
      }
    },
    [enabled, moveTolerancePx, cancel],
  );

  // Levantar el dedo antes de tiempo cancela: el toque fue demasiado corto
  // para ser intencional. Es la regla que descarta el roce accidental.
  const onPressOut = useCallback(() => {
    if (!enabled) return;
    cancel();
    startPoint.current = null;
  }, [enabled, cancel]);

  // Con el filtro apagado el Pressable dispara esto y el toque pasa derecho.
  const onPress = useCallback(() => {
    if (enabled) return;
    confirmRef.current();
  }, [enabled]);

  return { onPressIn, onPressOut, onTouchMove, onPress };
}

/** Opciones del filtro a partir de la configuración del usuario. */
export function tremorOptionsFrom(
  settings: {
    tremorFilterEnabled?: boolean;
    holdToConfirmMs?: number;
    debounceMs?: number;
    moveTolerancePx?: number;
  } | null,
): TremorFilterOptions {
  return {
    enabled: settings?.tremorFilterEnabled ?? false,
    holdToConfirmMs: settings?.holdToConfirmMs ?? TREMOR_FILTER.holdToConfirmMs.default,
    debounceMs: settings?.debounceMs ?? TREMOR_FILTER.debounceMs.default,
    moveTolerancePx: settings?.moveTolerancePx ?? TREMOR_FILTER.moveTolerancePx.default,
  };
}
