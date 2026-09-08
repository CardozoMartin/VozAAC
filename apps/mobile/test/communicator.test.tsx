import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import {
  ColorMode,
  GridSize,
  PictogramSource,
  type AccessibilitySettings,
  type Board,
} from '@vozaac/shared';
import { CommunicatorScreen } from '../src/screens/CommunicatorScreen';
import { api } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    defaultBoard: jest.fn(),
    accessibility: jest.fn(),
    logUsage: jest.fn().mockResolvedValue({ registered: 0 }),
  },
  ApiError: class ApiError extends Error {},
}));

const mockedApi = api as jest.Mocked<typeof api>;

function pictograma(id: string, text: string, order: number, categoryId: string) {
  return {
    id,
    text,
    imageUrl: `${text}.png`,
    audioUrl: null,
    source: PictogramSource.ARASAAC,
    arasaacId: null,
    order,
    categoryId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const board = {
  id: 'board-1',
  name: 'Casa',
  isDefault: true,
  userId: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  categories: [
    {
      id: 'cat-1',
      name: 'Acciones',
      color: '#4A90D9',
      icon: null,
      order: 0,
      boardId: 'board-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pictograms: [pictograma('p1', 'quiero', 0, 'cat-1'), pictograma('p2', 'jugar', 1, 'cat-1')],
    },
    {
      id: 'cat-2',
      name: 'Comidas',
      color: '#E8A33D',
      icon: null,
      order: 1,
      boardId: 'board-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pictograms: [pictograma('p3', 'agua', 0, 'cat-2')],
    },
  ],
} as Board;

const settings = {
  id: 'acc-1',
  userId: 'user-1',
  gridSize: GridSize.GRID_2X3,
  colorMode: ColorMode.STANDARD,
  tremorFilterEnabled: false,
  holdToConfirmMs: 300,
  debounceMs: 500,
  moveTolerancePx: 20,
  speechRate: 1,
  speechPitch: 1,
  voiceId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as AccessibilitySettings;

async function renderComunicador() {
  mockedApi.defaultBoard.mockResolvedValue(board);
  mockedApi.accessibility.mockResolvedValue(settings);
  // clearAllMocks borra también la implementación, y la cola de uso llama a
  // logUsage al desmontar: sin esto devolvería undefined y rompería el await.
  mockedApi.logUsage.mockResolvedValue({ registered: 0 });

  render(
    <CommunicatorScreen token="token" userId="user-1" profileName="Sofía" onExit={jest.fn()} />,
  );

  // Espera a que resuelvan tablero y configuración.
  await waitFor(() => expect(screen.getByTestId('pictogram-grid')).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CommunicatorScreen', () => {
  it('muestra los pictogramas de la primera categoría al abrir', async () => {
    await renderComunicador();

    expect(screen.getByTestId('pictogram-p1')).toBeTruthy();
    expect(screen.getByTestId('pictogram-p2')).toBeTruthy();
    // La categoría no seleccionada no se dibuja.
    expect(screen.queryByTestId('pictogram-p3')).toBeNull();
  });

  it('agrega el pictograma a la frase al tocarlo', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));

    // El texto aparece en la barra de frase, además de en su celda.
    expect(screen.getAllByText('quiero').length).toBeGreaterThan(1);
  });

  it('dice el pictograma suelto al tocarlo', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));

    expect(Speech.speak).toHaveBeenCalledWith('quiero', expect.objectContaining({ rate: 1 }));
  });

  it('vacía la frase al tocar limpiar', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));
    fireEvent.press(screen.getByTestId('pictogram-p2'));
    fireEvent.press(screen.getByTestId('button-clear'));

    expect(screen.getByText('Tocá los pictogramas para armar la frase')).toBeTruthy();
  });

  it('borra sólo el último al retroceder', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));
    fireEvent.press(screen.getByTestId('pictogram-p2'));
    fireEvent.press(screen.getByTestId('button-remove-last'));

    // 'jugar' se fue de la barra y sólo queda en su celda; 'quiero' sigue en ambas.
    expect(screen.getAllByText('jugar')).toHaveLength(1);
    expect(screen.getAllByText('quiero')).toHaveLength(2);
  });

  it('dice la frase entera al tocar hablar', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));
    fireEvent.press(screen.getByTestId('pictogram-p2'));
    fireEvent.press(screen.getByTestId('button-speak'));

    expect(Speech.speak).toHaveBeenLastCalledWith('quiero jugar', expect.anything());
  });

  it('deshabilita hablar y limpiar mientras la frase está vacía', async () => {
    await renderComunicador();

    // Sin nada que decir, los botones no deben poder activarse.
    expect(screen.getByTestId('button-speak').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('button-clear').props.accessibilityState.disabled).toBe(true);
  });

  it('cambia de categoría al tocar su tab', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('category-cat-2'));

    expect(screen.getByTestId('pictogram-p3')).toBeTruthy();
    expect(screen.queryByTestId('pictogram-p1')).toBeNull();
  });

  it('conserva la frase al cambiar de categoría', async () => {
    await renderComunicador();

    fireEvent.press(screen.getByTestId('pictogram-p1'));
    fireEvent.press(screen.getByTestId('category-cat-2'));
    fireEvent.press(screen.getByTestId('pictogram-p3'));
    fireEvent.press(screen.getByTestId('button-speak'));

    // Armar una frase cruzando categorías es el caso normal, no la excepción.
    expect(Speech.speak).toHaveBeenLastCalledWith('quiero agua', expect.anything());
  });

  it('avisa cuando no se pudo cargar el tablero', async () => {
    mockedApi.defaultBoard.mockRejectedValue(new Error('El perfil todavía no tiene tableros'));
    mockedApi.accessibility.mockResolvedValue(settings);

    render(
      <CommunicatorScreen token="token" userId="user-1" profileName="Sofía" onExit={jest.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText('El perfil todavía no tiene tableros')).toBeTruthy(),
    );
  });
});
