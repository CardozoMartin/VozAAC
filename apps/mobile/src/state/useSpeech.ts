import { useCallback } from 'react';
import * as Speech from 'expo-speech';
import type { AccessibilitySettings } from '@vozaac/shared';

/**
 * Síntesis de voz (Módulo 3), con la velocidad y el tono que configuró el
 * terapeuta (Módulo 5).
 *
 * El idioma va fijo en es-AR: los usuarios son chicos/as argentinos, y la voz
 * del dispositivo en otro español suena ajena. Si el motor no la tiene, cae
 * solo a la variante regional más cercana.
 */
export function useSpeech(settings: AccessibilitySettings | null) {
  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // Cortar lo anterior evita que dos frases se pisen si tocan rápido.
      Speech.stop();
      Speech.speak(text, {
        language: 'es-AR',
        rate: settings?.speechRate ?? 1,
        pitch: settings?.speechPitch ?? 1,
        voice: settings?.voiceId ?? undefined,
      });
    },
    [settings],
  );

  const stop = useCallback(() => Speech.stop(), []);

  return { speak, stop };
}
