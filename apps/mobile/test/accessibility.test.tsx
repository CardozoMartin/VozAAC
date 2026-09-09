import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  ColorMode,
  GridSize,
  SPEECH_RATE,
  TREMOR_FILTER,
  type AccessibilitySettings,
} from '@vozaac/shared';
import { AccessibilityScreen } from '../src/screens/AccessibilityScreen';
import { api } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    accessibility: jest.fn(),
    updateAccessibility: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const mockedApi = api as jest.Mocked<typeof api>;

const settings: AccessibilitySettings = {
  id: 'cfg-1',
  userId: 'user-1',
  gridSize: GridSize.GRID_2X3,
  colorMode: ColorMode.STANDARD,
  tremorFilterEnabled: false,
  holdToConfirmMs: TREMOR_FILTER.holdToConfirmMs.default,
  debounceMs: TREMOR_FILTER.debounceMs.default,
  moveTolerancePx: TREMOR_FILTER.moveTolerancePx.default,
  speechRate: SPEECH_RATE.default,
  speechPitch: 1,
  voiceId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Renderiza la pantalla y espera a que termine de cargar la configuración. */
async function renderScreen(overrides: Partial<AccessibilitySettings> = {}) {
  const cargada = { ...settings, ...overrides };
  mockedApi.accessibility.mockResolvedValue(cargada);
  mockedApi.updateAccessibility.mockImplementation((_token, _userId, changes) =>
    Promise.resolve({ ...cargada, ...changes } as AccessibilitySettings),
  );

  render(<AccessibilityScreen token="t" userId="user-1" onExit={jest.fn()} />);
  await screen.findByTestId('accessibility-screen');
}

describe('AccessibilityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guarda el tamaño de grilla al elegirlo', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('grid-3x4'));

    await waitFor(() => {
      expect(mockedApi.updateAccessibility).toHaveBeenCalledWith('t', 'user-1', {
        gridSize: GridSize.GRID_3X4,
      });
    });
  });

  it('guarda el modo bajo estímulo', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('color-low_stimulus'));

    await waitFor(() => {
      expect(mockedApi.updateAccessibility).toHaveBeenCalledWith('t', 'user-1', {
        colorMode: ColorMode.LOW_STIMULUS,
      });
    });
  });

  it('esconde los controles del filtro mientras está apagado', async () => {
    await renderScreen({ tremorFilterEnabled: false });

    // Los milisegundos no significan nada si el filtro no corre; mostrarlos
    // sólo daría opciones que no hacen efecto.
    expect(screen.queryByTestId('tremor-controls')).toBeNull();
  });

  it('muestra los controles al encender el filtro', async () => {
    await renderScreen({ tremorFilterEnabled: false });

    fireEvent(screen.getByTestId('switch-tremor'), 'valueChange', true);

    await screen.findByTestId('tremor-controls');
    expect(mockedApi.updateAccessibility).toHaveBeenCalledWith('t', 'user-1', {
      tremorFilterEnabled: true,
    });
  });

  it('sube el tiempo de sostenido de a un paso', async () => {
    await renderScreen({ tremorFilterEnabled: true, holdToConfirmMs: 300 });

    fireEvent.press(screen.getByTestId('hold-mas'));

    await waitFor(() => {
      expect(mockedApi.updateAccessibility).toHaveBeenCalledWith('t', 'user-1', {
        holdToConfirmMs: 350,
      });
    });
  });

  it('no deja pasar el máximo que acepta la API', async () => {
    await renderScreen({
      tremorFilterEnabled: true,
      holdToConfirmMs: TREMOR_FILTER.holdToConfirmMs.max,
    });

    fireEvent.press(screen.getByTestId('hold-mas'));

    // El botón está deshabilitado en el tope: nunca se manda un valor que el
    // DTO rechazaría con un 400.
    expect(mockedApi.updateAccessibility).not.toHaveBeenCalled();
  });

  it('no baja de la velocidad mínima', async () => {
    await renderScreen({ speechRate: SPEECH_RATE.min });

    fireEvent.press(screen.getByTestId('velocidad-menos'));

    expect(mockedApi.updateAccessibility).not.toHaveBeenCalled();
  });

  it('redondea la velocidad en vez de arrastrar el error del punto flotante', async () => {
    await renderScreen({ speechRate: 1.0 });

    fireEvent.press(screen.getByTestId('velocidad-mas'));

    await waitFor(() => {
      // 1.0 + 0.1 da 1.1 y no 1.1000000000000001.
      expect(mockedApi.updateAccessibility).toHaveBeenCalledWith('t', 'user-1', {
        speechRate: 1.1,
      });
    });
  });

  it('avisa si el cambio no se pudo guardar', async () => {
    await renderScreen();
    mockedApi.updateAccessibility.mockRejectedValueOnce(new Error('Sin conexión'));

    fireEvent.press(screen.getByTestId('grid-2x2'));

    expect(await screen.findByText('Sin conexión')).toBeTruthy();
  });
});
