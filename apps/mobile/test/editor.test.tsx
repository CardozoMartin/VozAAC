import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PictogramSource, type Category, type Pictogram } from '@vozaac/shared';
import { useEditorDraft } from '../src/state/useEditorDraft';
import { api } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    createPictogram: jest.fn().mockResolvedValue({}),
    updatePictogram: jest.fn().mockResolvedValue({}),
    deletePictogram: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const category = { id: 'cat-1', name: 'Comidas', boardId: 'board-1' } as Category;

function pictograma(id: string, text: string): Pictogram {
  return {
    id,
    text,
    imageUrl: `${text}.png`,
    audioUrl: null,
    source: PictogramSource.CUSTOM,
    arasaacId: null,
    order: 0,
    categoryId: 'cat-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.createPictogram.mockResolvedValue({} as Pictogram);
  mockedApi.updatePictogram.mockResolvedValue({} as Pictogram);
  mockedApi.deletePictogram.mockResolvedValue(undefined);
});

describe('useEditorDraft', () => {
  it('arranca con los pictogramas que ya existen y sin cambios pendientes', () => {
    const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

    expect(result.current.pictograms).toHaveLength(1);
    expect(result.current.hasChanges).toBe(false);
  });

  describe('el borrador no toca el servidor hasta guardar', () => {
    it('agregar no escribe nada', () => {
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));

      expect(result.current.visible).toHaveLength(1);
      expect(result.current.hasChanges).toBe(true);
      // Lo central del Módulo 4: el comunicador no ve el cambio todavía.
      expect(mockedApi.createPictogram).not.toHaveBeenCalled();
    });

    it('editar no escribe nada', () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.edit('p1', { text: 'agua fría' }));

      expect(result.current.pictograms[0].text).toBe('agua fría');
      expect(mockedApi.updatePictogram).not.toHaveBeenCalled();
    });

    it('borrar no escribe nada', () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.remove('p1'));

      expect(mockedApi.deletePictogram).not.toHaveBeenCalled();
    });
  });

  describe('borrado', () => {
    it('marca el pictograma pero lo sigue mostrando en el listado', () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.remove('p1'));

      // Sigue en la lista, tachado, para poder deshacer.
      expect(result.current.pictograms).toHaveLength(1);
      expect(result.current.pictograms[0].deleted).toBe(true);
      // Pero ya no cuenta como parte del tablero.
      expect(result.current.visible).toHaveLength(0);
    });

    it('permite deshacer el borrado antes de guardar', () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.remove('p1'));
      act(() => result.current.restore('p1'));

      expect(result.current.visible).toHaveLength(1);
    });

    it('descarta sin dejar rastro un pictograma que nunca se guardó', () => {
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));
      const key = result.current.pictograms[0].key;
      act(() => result.current.remove(key));

      // No hay nada que borrar en el servidor, así que se va del borrador.
      expect(result.current.pictograms).toHaveLength(0);
    });
  });

  describe('descartar', () => {
    it('vuelve al estado del servidor', () => {
      const original = [pictograma('p1', 'agua')];
      const { result } = renderHook(() => useEditorDraft(original, category));

      act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));
      act(() => result.current.edit('p1', { text: 'cambiado' }));
      act(() => result.current.reset(original));

      expect(result.current.pictograms).toHaveLength(1);
      expect(result.current.pictograms[0].text).toBe('agua');
      expect(result.current.hasChanges).toBe(false);
    });
  });

  describe('guardar', () => {
    it('crea los pictogramas nuevos', async () => {
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.createPictogram).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ text: 'pan', categoryId: 'cat-1' }),
      );
    });

    it('conserva el origen ARASAAC al crear', async () => {
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: 'pelota', imageUrl: 'arasaac.png', arasaacId: 2248 }));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.createPictogram).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ source: 'arasaac', arasaacId: 2248 }),
      );
    });

    it('actualiza los editados', async () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.edit('p1', { text: 'agua fría' }));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.updatePictogram).toHaveBeenCalledWith(
        'token',
        'p1',
        expect.objectContaining({ text: 'agua fría' }),
      );
    });

    it('borra los marcados', async () => {
      const { result } = renderHook(() => useEditorDraft([pictograma('p1', 'agua')], category));

      act(() => result.current.remove('p1'));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.deletePictogram).toHaveBeenCalledWith('token', 'p1');
      // Un borrado no debe además intentar actualizarlo.
      expect(mockedApi.updatePictogram).not.toHaveBeenCalled();
    });

    it('no toca los pictogramas que no cambiaron', async () => {
      const { result } = renderHook(() =>
        useEditorDraft([pictograma('p1', 'agua'), pictograma('p2', 'pan')], category),
      );

      act(() => result.current.edit('p1', { text: 'agua fría' }));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.updatePictogram).toHaveBeenCalledTimes(1);
    });

    it('recorta los espacios del texto al guardar', async () => {
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: '  pan  ', imageUrl: 'pan.png' }));
      await act(async () => {
        await result.current.save('token');
      });

      expect(mockedApi.createPictogram).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ text: 'pan' }),
      );
    });

    it('deja de estar ocupado aunque falle el guardado', async () => {
      mockedApi.createPictogram.mockRejectedValue(new Error('sin conexión'));
      const { result } = renderHook(() => useEditorDraft([], category));

      act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));
      await act(async () => {
        await result.current.save('token').catch(() => undefined);
      });

      // Si saving quedara en true, el botón de guardar no volvería nunca.
      await waitFor(() => expect(result.current.saving).toBe(false));
      // Y los cambios siguen ahí para poder reintentar.
      expect(result.current.hasChanges).toBe(true);
    });
  });

  it('no agrega nada si no hay categoría seleccionada', () => {
    const { result } = renderHook(() => useEditorDraft([], null));

    act(() => result.current.add({ text: 'pan', imageUrl: 'pan.png' }));

    expect(result.current.pictograms).toHaveLength(0);
  });
});
