import { act, renderHook } from '@testing-library/react-native';
import { MAX_PHRASE_LENGTH, PictogramSource, type Pictogram } from '@vozaac/shared';
import { usePhrase } from '../src/state/usePhrase';

function pictograma(id: string, text: string): Pictogram {
  return {
    id,
    text,
    imageUrl: `${text}.png`,
    audioUrl: null,
    source: PictogramSource.ARASAAC,
    arasaacId: null,
    order: 0,
    categoryId: 'cat-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('usePhrase', () => {
  it('arranca vacía', () => {
    const { result } = renderHook(() => usePhrase());

    expect(result.current.pictograms).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.text).toBe('');
  });

  it('agrega pictogramas en el orden en que se tocan', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => result.current.add(pictograma('1', 'quiero')));
    act(() => result.current.add(pictograma('2', 'agua')));

    expect(result.current.text).toBe('quiero agua');
    expect(result.current.isEmpty).toBe(false);
  });

  it('permite repetir el mismo pictograma', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => result.current.add(pictograma('1', 'más')));
    act(() => result.current.add(pictograma('1', 'más')));

    // "más más" es una frase válida: repetir no es un error a corregir.
    expect(result.current.pictograms).toHaveLength(2);
    expect(result.current.text).toBe('más más');
  });

  it('borra sólo el último al retroceder', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => result.current.add(pictograma('1', 'quiero')));
    act(() => result.current.add(pictograma('2', 'pan')));
    act(() => result.current.removeLast());

    expect(result.current.text).toBe('quiero');
  });

  it('no falla al retroceder con la frase vacía', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => result.current.removeLast());

    expect(result.current.pictograms).toEqual([]);
  });

  it('deja de agregar al llegar al tope de la barra', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => {
      for (let i = 0; i < MAX_PHRASE_LENGTH + 3; i += 1) {
        result.current.add(pictograma(String(i), `palabra${i}`));
      }
    });

    // Más allá del tope la barra ya no se lee de un vistazo.
    expect(result.current.pictograms).toHaveLength(MAX_PHRASE_LENGTH);
  });

  it('vacía la frase al limpiar', () => {
    const { result } = renderHook(() => usePhrase());

    act(() => result.current.add(pictograma('1', 'quiero')));
    act(() => result.current.add(pictograma('2', 'jugar')));
    act(() => result.current.clear());

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.text).toBe('');
  });
});
