import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { PictogramSource, URGENT_ALERT, type Alert, type Pictogram } from '@vozaac/shared';
import { PictogramCell } from '../src/components/PictogramCell';
import { AlertsScreen } from '../src/screens/AlertsScreen';
import { useUrgentAlert } from '../src/state/useUrgentAlert';
import { palettes } from '../src/theme';
import { ColorMode } from '@vozaac/shared';
import { api, ApiError } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    raiseAlert: jest.fn(),
    alerts: jest.fn(),
    acknowledgeAlert: jest.fn(),
  },
  // Sin parámetro-propiedad `readonly`: la factory de jest.mock se transpila
  // aparte y ahí ese azúcar de TypeScript no está disponible.
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const palette = palettes[ColorMode.STANDARD];

function pictograma(overrides: Partial<Pictogram> = {}): Pictogram {
  return {
    id: 'picto-1',
    text: 'me duele',
    imageUrl: 'duele.png',
    audioUrl: null,
    source: PictogramSource.CUSTOM,
    arasaacId: null,
    order: 0,
    categoryId: 'cat-1',
    isUrgent: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function alerta(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alerta-1',
    userId: 'perfil-1',
    profileName: 'Mía',
    pictogramId: 'picto-1',
    pictogramText: 'me duele',
    pictogramImageUrl: 'duele.png',
    occurredAt: '2026-03-01T02:45:00.000Z',
    acknowledgedAt: null,
    acknowledgedByName: null,
    ...overrides,
  };
}

const sinFiltro = { enabled: false, holdToConfirmMs: 300, debounceMs: 500, moveTolerancePx: 20 };
const conFiltro = { ...sinFiltro, enabled: true };

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Hold reforzado del pictograma urgente (Módulo 9, paso 4).
 *
 * Un toque accidental que despierte a alguien a las 3 AM hace que la función
 * se desactive en una semana. Esto es lo que lo evita, y por eso es lo que más
 * conviene tener cubierto.
 */
describe('PictogramCell — pictograma urgente', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderCell(picto: Pictogram, tremor: typeof sinFiltro, onPress = jest.fn()) {
    render(
      <PictogramCell
        pictogram={picto}
        color="#2F6FB0"
        palette={palette}
        onPress={onPress}
        tremor={tremor}
      />,
    );
    return onPress;
  }

  /** Sin filtro configurado, un pictograma común se activa con el toque. */
  it('el pictograma común se activa directo cuando el filtro está apagado', () => {
    const onPress = renderCell(pictograma(), sinFiltro);

    fireEvent.press(screen.getByTestId('pictogram-picto-1'));

    expect(onPress).toHaveBeenCalled();
  });

  /**
   * Sin esto, en un tablero sin filtro anti-temblor el aviso saldría con un
   * roce, que es exactamente lo que no puede pasar.
   */
  it('el urgente exige sostener aunque el filtro esté apagado', () => {
    const onPress = renderCell(pictograma({ isUrgent: true }), sinFiltro);

    fireEvent.press(screen.getByTestId('pictogram-picto-1'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('el urgente se activa al sostener el hold mínimo', () => {
    const onPress = renderCell(pictograma({ isUrgent: true }), sinFiltro);

    act(() => {
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressIn', {
        nativeEvent: { pageX: 10, pageY: 10 },
      });
      jest.advanceTimersByTime(URGENT_ALERT.minHoldMs);
    });

    expect(onPress).toHaveBeenCalled();
  });

  it('el urgente no se activa si se suelta antes del hold mínimo', () => {
    const onPress = renderCell(pictograma({ isUrgent: true }), sinFiltro);

    act(() => {
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressIn', {
        nativeEvent: { pageX: 10, pageY: 10 },
      });
      jest.advanceTimersByTime(URGENT_ALERT.minHoldMs - 200);
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressOut');
      jest.advanceTimersByTime(1000);
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  /** Con el filtro activo, el urgente pide el hold del filtro más el extra. */
  it('el urgente suma el hold extra al del filtro anti-temblor', () => {
    const onPress = renderCell(pictograma({ isUrgent: true }), conFiltro);

    act(() => {
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressIn', {
        nativeEvent: { pageX: 10, pageY: 10 },
      });
      // El hold del filtro alcanzaría para uno común, pero no para este.
      jest.advanceTimersByTime(conFiltro.holdToConfirmMs);
    });
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(URGENT_ALERT.extraHoldMs);
    });
    expect(onPress).toHaveBeenCalled();
  });

  it('el común sigue activándose con el hold normal del filtro', () => {
    const onPress = renderCell(pictograma(), conFiltro);

    act(() => {
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressIn', {
        nativeEvent: { pageX: 10, pageY: 10 },
      });
      jest.advanceTimersByTime(conFiltro.holdToConfirmMs);
    });

    expect(onPress).toHaveBeenCalled();
  });

  /** La barra enseña cuánto falta; sin ella el retardo se siente como un cuelgue. */
  it('muestra la barra de progreso mientras se sostiene el urgente', () => {
    renderCell(pictograma({ isUrgent: true }), sinFiltro);

    act(() => {
      fireEvent(screen.getByTestId('pictogram-picto-1'), 'pressIn', {
        nativeEvent: { pageX: 10, pageY: 10 },
      });
    });

    expect(screen.getByTestId('hold-progress-picto-1')).toBeTruthy();
  });
});

/**
 * Estado del aviso.
 *
 * El chico/a tiene que ver que su mensaje salió: si no, no sabe si sirvió de
 * algo y lo va a tocar diez veces.
 */
describe('useUrgentAlert', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no avisa por un pictograma que no es urgente', () => {
    const { result } = renderHook(() => useUrgentAlert('tok', 'perfil-1'));

    act(() => result.current.raise(pictograma()));

    expect(mockedApi.raiseAlert).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('manda el aviso y muestra el avisado', async () => {
    mockedApi.raiseAlert.mockResolvedValue(alerta());
    const { result } = renderHook(() => useUrgentAlert('tok', 'perfil-1'));

    act(() => result.current.raise(pictograma({ isUrgent: true })));

    expect(result.current.status).toBe('sending');
    await waitFor(() => expect(result.current.status).toBe('sent'));
    expect(result.current.text).toBe('me duele');
    expect(mockedApi.raiseAlert).toHaveBeenCalledWith(
      'tok',
      'perfil-1',
      'picto-1',
      expect.any(String),
    );
  });

  /**
   * Un "avisado ✓" falso es peor que nada: el chico/a se queda esperando ayuda
   * que nadie pidió.
   */
  it('avisa que no salió si la API falla', async () => {
    mockedApi.raiseAlert.mockRejectedValue(new ApiError('Sin conexión', 0));
    const { result } = renderHook(() => useUrgentAlert('tok', 'perfil-1'));

    act(() => result.current.raise(pictograma({ isUrgent: true })));

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  /** El cartel se limpia solo: dejarlo fijo taparía la grilla. */
  it('vuelve a idle después de mostrar la confirmación', async () => {
    mockedApi.raiseAlert.mockResolvedValue(alerta());
    const { result } = renderHook(() => useUrgentAlert('tok', 'perfil-1'));

    act(() => result.current.raise(pictograma({ isUrgent: true })));
    await waitFor(() => expect(result.current.status).toBe('sent'));

    act(() => {
      jest.advanceTimersByTime(URGENT_ALERT.confirmationMs);
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.text).toBeNull();
  });
});

describe('AlertsScreen', () => {
  it('lista los avisos con el nombre del chico/a', async () => {
    mockedApi.alerts.mockResolvedValue([alerta()]);
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('alert-alerta-1')).toBeTruthy());
    expect(screen.getByText('me duele')).toBeTruthy();
  });

  it('avisa cuando no hay ninguno', async () => {
    mockedApi.alerts.mockResolvedValue([]);
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('alerts-empty')).toBeTruthy());
  });

  it('cuenta los pendientes en el título', async () => {
    mockedApi.alerts.mockResolvedValue([
      alerta(),
      alerta({ id: 'alerta-2', acknowledgedAt: '2026-03-01T03:00:00.000Z' }),
    ]);
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Avisos (1)')).toBeTruthy());
  });

  it('marca un aviso como visto', async () => {
    mockedApi.alerts.mockResolvedValue([alerta()]);
    mockedApi.acknowledgeAlert.mockResolvedValue(
      alerta({ acknowledgedAt: '2026-03-01T03:00:00.000Z', acknowledgedByName: 'Ana Pérez' }),
    );
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('button-ack-alerta-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-ack-alerta-1'));

    await waitFor(() => expect(screen.getByTestId('alert-ack-alerta-1')).toBeTruthy());
    expect(screen.getByText('Visto por Ana Pérez')).toBeTruthy();
  });

  /**
   * Con varios responsables importa: si la madre ya fue a ver al chico/a, el
   * padre necesita saberlo para no salir corriendo también.
   */
  it('muestra quién atendió el aviso y no ofrece atenderlo de nuevo', async () => {
    mockedApi.alerts.mockResolvedValue([
      alerta({ acknowledgedAt: '2026-03-01T03:00:00.000Z', acknowledgedByName: 'Ana Pérez' }),
    ]);
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Visto por Ana Pérez')).toBeTruthy());
    expect(screen.queryByTestId('button-ack-alerta-1')).toBeNull();
  });

  it('muestra el error si no se pueden cargar', async () => {
    mockedApi.alerts.mockRejectedValue(new ApiError('Sin conexión', 0));
    render(<AlertsScreen token="tok" onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('alerts-error')).toBeTruthy());
  });
});
