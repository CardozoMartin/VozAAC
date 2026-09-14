import { useCallback, useState } from 'react';
import { MAX_PHRASE_LENGTH, type Pictogram } from '@vozaac/shared';

/**
 * La frase que se va armando al tocar pictogramas (Módulo 3).
 *
 * Guarda los pictogramas enteros y no sólo su texto porque la barra muestra
 * las imágenes: para quien todavía no lee, la frase escrita no dice nada.
 */
export function usePhrase() {
  const [pictograms, setPictograms] = useState<Pictogram[]>([]);

  const add = useCallback((pictogram: Pictogram) => {
    setPictograms((current) => {
      // Pasado el tope la barra deja de leerse de un vistazo, así que se
      // ignora el toque en vez de seguir agregando fuera de la vista.
      if (current.length >= MAX_PHRASE_LENGTH) return current;
      // Se permite repetir el mismo pictograma: "quiero más más" es una frase válida.
      return [...current, pictogram];
    });
  }, []);

  /** Borra el último, que es lo que espera quien se equivocó al tocar. */
  const removeLast = useCallback(() => {
    setPictograms((current) => current.slice(0, -1));
  }, []);

  const clear = useCallback(() => setPictograms([]), []);

  const text = pictograms.map((pictogram) => pictogram.text).join(' ');

  return { pictograms, add, removeLast, clear, text, isEmpty: pictograms.length === 0 };
}
