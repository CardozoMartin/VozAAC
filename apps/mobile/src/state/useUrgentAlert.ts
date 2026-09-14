import { useCallback, useEffect, useRef, useState } from 'react';
import { URGENT_ALERT, type Pictogram } from '@vozaac/shared';
import { api } from '../api/client';

/** En qué estado está el aviso que el chico/a acaba de mandar. */
export type AlertStatus = 'idle' | 'sending' | 'sent' | 'failed';

export interface UrgentAlertState {
  status: AlertStatus;
  /** Qué se avisó, para poder mostrarlo en el cartel. */
  text: string | null;
  /** Dispara el aviso; no hace nada si el pictograma no es urgente. */
  raise: (pictogram: Pictogram) => void;
}

/**
 * Envío del aviso cuando el chico/a toca un pictograma urgente
 * (Módulo 9, paso 4).
 *
 * Lo importante acá no es el POST sino lo que ve el chico/a después. Tiene que
 * saber que su mensaje salió: si no, no sabe si sirvió de algo y lo va a tocar
 * diez veces. Por eso el estado se muestra siempre —"avisando…", "avisado ✓",
 * o el error— y no sólo cuando algo falla.
 *
 * El cartel se limpia solo a los pocos segundos. Dejarlo fijo taparía la
 * grilla, y el chico/a sigue queriendo comunicar otras cosas después de avisar
 * que le duele algo.
 */
export function useUrgentAlert(token: string, userId: string): UrgentAlertState {
  const [status, setStatus] = useState<AlertStatus>('idle');
  const [text, setText] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  /** Vuelve a 'idle' después de un rato, para no tapar la grilla. */
  const limpiarLuego = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (cancelled.current) return;
      setStatus('idle');
      setText(null);
    }, URGENT_ALERT.confirmationMs);
  }, []);

  const raise = useCallback(
    (pictogram: Pictogram) => {
      if (!pictogram.isUrgent) return;

      setStatus('sending');
      setText(pictogram.text);

      // El momento del toque lo pone el dispositivo y no el servidor: si el
      // aviso sale con demora —sin señal, o la app en segundo plano— lo que
      // importa es cuándo el chico/a lo tocó.
      const occurredAt = new Date().toISOString();

      api
        .raiseAlert(token, userId, pictogram.id, occurredAt)
        .then(() => {
          if (cancelled.current) return;
          setStatus('sent');
          limpiarLuego();
        })
        .catch(() => {
          if (cancelled.current) return;
          // Se le dice que no salió en vez de fingir que sí. Un "avisado ✓"
          // falso es peor que nada: el chico/a se queda esperando ayuda que
          // nadie pidió.
          setStatus('failed');
          limpiarLuego();
        });
    },
    [token, userId, limpiarLuego],
  );

  return { status, text, raise };
}
