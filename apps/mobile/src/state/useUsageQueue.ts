import { useCallback, useEffect, useRef } from 'react';
import { UsageEventType } from '@vozaac/shared';
import { api, type UsageEvent } from '../api/client';

/** Cada cuántos milisegundos se vacía la cola. */
const FLUSH_INTERVAL_MS = 15_000;

/**
 * Cola de eventos de uso (Módulo 3 los genera, el Módulo 6 los reporta).
 *
 * Los eventos se acumulan y se mandan en lote cada tanto en vez de uno por
 * toque: un chico/a puede tocar decenas de pictogramas por minuto, y una
 * request por toque castigaría batería y red.
 *
 * Si el envío falla, los eventos vuelven a la cola. Con eso el modo offline
 * del Módulo 7 sólo tiene que agregarle persistencia en disco.
 */
export function useUsageQueue(token: string | null, userId: string | null) {
  const queue = useRef<UsageEvent[]>([]);

  const flush = useCallback(async () => {
    if (!token || !userId || queue.current.length === 0) return;

    const pending = queue.current;
    queue.current = [];
    try {
      await api.logUsage(token, userId, pending);
    } catch {
      // Sin conexión: se reencolan adelante para no perder el orden temporal.
      queue.current = [...pending, ...queue.current];
    }
  }, [token, userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // Al desmontar se intenta un último envío para no perder la sesión en curso.
      void flush();
    };
  }, [flush]);

  const record = useCallback((event: Omit<UsageEvent, 'occurredAt'>) => {
    // El momento se sella acá y no en el servidor: es cuando realmente pasó.
    queue.current.push({ ...event, occurredAt: new Date().toISOString() });
  }, []);

  const recordTap = useCallback(
    (pictogramId: string, text: string) =>
      record({
        eventType: UsageEventType.PICTOGRAM_TAP,
        pictogramId,
        pictogramTextSnapshot: text,
      }),
    [record],
  );

  const recordSpoken = useCallback(
    (phraseText: string) => record({ eventType: UsageEventType.PHRASE_SPOKEN, phraseText }),
    [record],
  );

  const recordCleared = useCallback(
    () => record({ eventType: UsageEventType.PHRASE_CLEARED }),
    [record],
  );

  return { recordTap, recordSpoken, recordCleared, flush };
}
