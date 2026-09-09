import { useCallback, useMemo, useState } from 'react';
import type { Category, Pictogram } from '@vozaac/shared';
import { api, type NewPictogram } from '../api/client';

/** Un pictograma del borrador: puede existir en el servidor o no todavía. */
export interface DraftPictogram {
  /** Id del servidor, o null si se agregó en esta sesión de edición. */
  id: string | null;
  /** Clave estable para React, incluso antes de tener id del servidor. */
  key: string;
  text: string;
  imageUrl: string;
  audioUrl: string | null;
  arasaacId: number | null;
  categoryId: string;
  /** Si tocarlo avisa a los responsables (Módulo 9, paso 4). */
  isUrgent: boolean;
  /** Marcado para borrar al guardar; se sigue mostrando tachado hasta entonces. */
  deleted: boolean;
  /** Cambió respecto de lo que hay en el servidor. */
  dirty: boolean;
}

let temporaryKey = 0;

function toDraft(pictogram: Pictogram): DraftPictogram {
  return {
    id: pictogram.id,
    key: pictogram.id,
    text: pictogram.text,
    imageUrl: pictogram.imageUrl,
    audioUrl: pictogram.audioUrl,
    arasaacId: pictogram.arasaacId,
    categoryId: pictogram.categoryId,
    isUrgent: pictogram.isUrgent,
    deleted: false,
    dirty: false,
  };
}

/**
 * Borrador del editor (Módulo 4).
 *
 * Los cambios se acumulan acá y no se escriben hasta "Guardar cambios". Es lo
 * que pide el Doc y es importante de verdad: el terapeuta suele editar el
 * tablero con el chico/a al lado, y ver los pictogramas desaparecer y
 * reaparecer mientras tanto sería confuso para quien está usando el
 * comunicador.
 *
 * Descartar es simplemente volver a cargar: nada se escribió.
 */
export function useEditorDraft(initial: Pictogram[], category: Category | null) {
  const [pictograms, setPictograms] = useState<DraftPictogram[]>(() => initial.map(toDraft));
  const [saving, setSaving] = useState(false);

  const reset = useCallback((fresh: Pictogram[]) => {
    setPictograms(fresh.map(toDraft));
  }, []);

  const add = useCallback(
    (input: { text: string; imageUrl: string; audioUrl?: string | null; arasaacId?: number }) => {
      if (!category) return;
      temporaryKey += 1;
      setPictograms((current) => [
        ...current,
        {
          id: null,
          key: `nuevo-${temporaryKey}`,
          text: input.text,
          imageUrl: input.imageUrl,
          audioUrl: input.audioUrl ?? null,
          arasaacId: input.arasaacId ?? null,
          categoryId: category.id,
          // Nada avisa por defecto: el terapeuta marca a mano el puñado que
          // corresponde, o las notificaciones se vuelven ruido.
          isUrgent: false,
          deleted: false,
          dirty: true,
        },
      ]);
    },
    [category],
  );

  const edit = useCallback((key: string, changes: Partial<DraftPictogram>) => {
    setPictograms((current) =>
      current.map((p) => (p.key === key ? { ...p, ...changes, dirty: true } : p)),
    );
  }, []);

  /**
   * Marca para borrar, o descarta directamente si nunca llegó al servidor.
   */
  const remove = useCallback((key: string) => {
    setPictograms((current) =>
      current
        // Uno que sólo existe en el borrador se va sin dejar rastro.
        .filter((p) => !(p.key === key && p.id === null))
        .map((p) => (p.key === key ? { ...p, deleted: true, dirty: true } : p)),
    );
  }, []);

  /** Deshace el borrado de un pictograma que todavía no se guardó. */
  const restore = useCallback((key: string) => {
    setPictograms((current) => current.map((p) => (p.key === key ? { ...p, deleted: false } : p)));
  }, []);

  const hasChanges = useMemo(() => pictograms.some((p) => p.dirty), [pictograms]);

  /** Lo que ve el comunicador si se guardara ahora. */
  const visible = useMemo(() => pictograms.filter((p) => !p.deleted), [pictograms]);

  /**
   * Escribe el borrador en el servidor.
   *
   * Se hace en orden —borrados, ediciones, altas— y no en paralelo: si dos
   * pictogramas intercambian nombres, hacerlo a la vez chocaría contra el
   * índice único de (categoría, texto).
   */
  const save = useCallback(
    async (token: string) => {
      setSaving(true);
      try {
        for (const pictogram of pictograms) {
          if (!pictogram.dirty) continue;

          if (pictogram.deleted && pictogram.id) {
            await api.deletePictogram(token, pictogram.id);
            continue;
          }

          const payload: NewPictogram = {
            text: pictogram.text.trim(),
            imageUrl: pictogram.imageUrl,
            categoryId: pictogram.categoryId,
            audioUrl: pictogram.audioUrl,
            isUrgent: pictogram.isUrgent,
          };

          if (pictogram.id) {
            await api.updatePictogram(token, pictogram.id, payload);
          } else {
            await api.createPictogram(token, {
              ...payload,
              ...(pictogram.arasaacId
                ? { source: 'arasaac' as NewPictogram['source'], arasaacId: pictogram.arasaacId }
                : {}),
            });
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [pictograms],
  );

  return { pictograms, visible, add, edit, remove, restore, reset, save, hasChanges, saving };
}
