import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceKind, LINK_CODE } from '@vozaac/shared';
import type { DeviceAuthResponse, LinkedDevice, UserProfile } from '@vozaac/shared';
import { LinkDeviceScreen } from '../src/screens/LinkDeviceScreen';
import { DevicesScreen } from '../src/screens/DevicesScreen';
import { withSession, resetRenovacion } from '../src/api/authenticated';
import { session } from '../src/state/session';
import { api, ApiError } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    profiles: jest.fn(),
    createLinkCode: jest.fn(),
    redeemLinkCode: jest.fn(),
    refreshSession: jest.fn(),
    linkedDevices: jest.fn(),
    revokeDevice: jest.fn(),
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

function perfil(id: string, name: string): UserProfile {
  return {
    id,
    name,
    birthDate: null,
    photoUrl: null,
    caregiverId: 'cuidador-1',
    age: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function dispositivo(overrides: Partial<LinkedDevice> = {}): LinkedDevice {
  return {
    id: 'device-1',
    name: 'Tablet de Mía',
    kind: DeviceKind.CHILD,
    userId: 'perfil-1',
    lastSeenAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetRenovacion();
  await AsyncStorage.clear();
});

/**
 * Renovación automática de la sesión (Módulo 9).
 *
 * Este es el bloqueante que resuelve el módulo: sin esto, una vez por semana
 * el celular del chico/a lo dejaría en el login, y él no puede resolverlo.
 */
describe('withSession', () => {
  it('devuelve el resultado sin renovar cuando el token sirve', async () => {
    const llamada = jest.fn().mockResolvedValue('datos');

    const resultado = await withSession('token-vigente', llamada);

    expect(resultado).toBe('datos');
    expect(mockedApi.refreshSession).not.toHaveBeenCalled();
  });

  it('ante un 401 renueva la sesión y reintenta una vez', async () => {
    await session.saveDevice({
      token: 'token-vencido',
      refreshToken: 'refresh-1',
      deviceKind: DeviceKind.CHILD,
      profileId: 'perfil-1',
    });
    mockedApi.refreshSession.mockResolvedValue({
      accessToken: 'token-nuevo',
      refreshToken: 'refresh-2',
    });
    const llamada = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Sesión vencida', 401))
      .mockResolvedValue('datos');

    const resultado = await withSession('token-vencido', llamada);

    expect(resultado).toBe('datos');
    expect(llamada).toHaveBeenCalledTimes(2);
    // El reintento va con el token nuevo, no con el vencido.
    expect(llamada).toHaveBeenLastCalledWith('token-nuevo');
  });

  it('guarda el par de tokens renovado para el próximo arranque', async () => {
    await session.saveDevice({
      token: 'token-vencido',
      refreshToken: 'refresh-1',
      deviceKind: DeviceKind.CHILD,
      profileId: 'perfil-1',
    });
    mockedApi.refreshSession.mockResolvedValue({
      accessToken: 'token-nuevo',
      refreshToken: 'refresh-2',
    });
    const llamada = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Sesión vencida', 401))
      .mockResolvedValue('datos');

    await withSession('token-vencido', llamada);

    const guardada = await session.load();
    expect(guardada.token).toBe('token-nuevo');
    expect(guardada.refreshToken).toBe('refresh-2');
  });

  /**
   * Sin refresh token no hay nada que renovar: es el dispositivo de un
   * cuidador que hizo login y tiene que volver a entrar.
   */
  it('sin refresh token avisa que la sesión se perdió', async () => {
    await session.save('token-vencido');
    const onSessionLost = jest.fn();
    const llamada = jest.fn().mockRejectedValue(new ApiError('Sesión vencida', 401));

    await expect(withSession('token-vencido', llamada, onSessionLost)).rejects.toThrow(ApiError);

    expect(onSessionLost).toHaveBeenCalled();
    expect(mockedApi.refreshSession).not.toHaveBeenCalled();
  });

  /**
   * El cuidador revocó este dispositivo: el refresh token tampoco sirve, así
   * que se limpia lo guardado para que el próximo arranque caiga en el login.
   */
  it('si la renovación falla limpia la sesión guardada', async () => {
    await session.saveDevice({
      token: 'token-vencido',
      refreshToken: 'refresh-revocado',
      deviceKind: DeviceKind.CHILD,
      profileId: 'perfil-1',
    });
    mockedApi.refreshSession.mockRejectedValue(new ApiError('Sesión revocada', 401));
    const onSessionLost = jest.fn();
    const llamada = jest.fn().mockRejectedValue(new ApiError('Sesión vencida', 401));

    await expect(withSession('token-vencido', llamada, onSessionLost)).rejects.toThrow(ApiError);

    expect(onSessionLost).toHaveBeenCalled();
    expect((await session.load()).token).toBeNull();
  });

  /** Un error de red no es sesión vencida: renovar no arreglaría nada. */
  it('no renueva ante un error que no sea 401', async () => {
    const llamada = jest.fn().mockRejectedValue(new ApiError('Sin conexión', 0));

    await expect(withSession('token', llamada)).rejects.toThrow(ApiError);
    expect(mockedApi.refreshSession).not.toHaveBeenCalled();
  });

  /**
   * El backend rota el refresh token en cada uso, así que dos renovaciones
   * simultáneas invalidarían la segunda y cerrarían la sesión sin motivo.
   */
  it('comparte una sola renovación entre llamadas simultáneas', async () => {
    await session.saveDevice({
      token: 'token-vencido',
      refreshToken: 'refresh-1',
      deviceKind: DeviceKind.CHILD,
      profileId: 'perfil-1',
    });
    mockedApi.refreshSession.mockResolvedValue({
      accessToken: 'token-nuevo',
      refreshToken: 'refresh-2',
    });
    const nueva = () =>
      jest.fn().mockRejectedValueOnce(new ApiError('Sesión vencida', 401)).mockResolvedValue('ok');

    await Promise.all([
      withSession('token-vencido', nueva()),
      withSession('token-vencido', nueva()),
      withSession('token-vencido', nueva()),
    ]);

    expect(mockedApi.refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('LinkDeviceScreen', () => {
  const canje = (): DeviceAuthResponse => ({
    accessToken: 'token',
    refreshToken: 'refresh',
    caregiver: {
      id: 'cuidador-1',
      email: 'ana@vozaac.local',
      fullName: 'Ana',
      role: 'family' as never,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    device: dispositivo(),
    profile: perfil('perfil-1', 'Mía'),
  });

  it('canjea el código y entrega la sesión del dispositivo', async () => {
    mockedApi.redeemLinkCode.mockResolvedValue(canje());
    const onLinked = jest.fn();
    render(<LinkDeviceScreen onLinked={onLinked} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'ABC234');
    fireEvent.changeText(screen.getByTestId('input-device-name'), 'Tablet de Mía');
    fireEvent.press(screen.getByTestId('button-link-submit'));

    await waitFor(() => expect(onLinked).toHaveBeenCalled());
    expect(mockedApi.redeemLinkCode).toHaveBeenCalledWith('ABC234', 'Tablet de Mía');
  });

  /** El código se dicta por teléfono: quien lo tipea no acierta el formato. */
  it('normaliza a mayúsculas y descarta separadores mientras se tipea', () => {
    render(<LinkDeviceScreen onLinked={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'abc-234');

    expect(screen.getByTestId('input-link-code').props.value).toBe('ABC234');
  });

  it('no deja enviar un código incompleto', () => {
    render(<LinkDeviceScreen onLinked={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'AB');
    fireEvent.press(screen.getByTestId('button-link-submit'));

    expect(mockedApi.redeemLinkCode).not.toHaveBeenCalled();
  });

  it('recorta el código al largo esperado', () => {
    render(<LinkDeviceScreen onLinked={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'ABCDEFGHIJ');

    expect(screen.getByTestId('input-link-code').props.value).toHaveLength(LINK_CODE.length);
  });

  it('manda el nombre en blanco como ausente, para que la API ponga el suyo', async () => {
    mockedApi.redeemLinkCode.mockResolvedValue(canje());
    render(<LinkDeviceScreen onLinked={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'ABC234');
    fireEvent.press(screen.getByTestId('button-link-submit'));

    await waitFor(() => expect(mockedApi.redeemLinkCode).toHaveBeenCalledWith('ABC234', undefined));
  });

  /**
   * El código queda quemado aunque el canje falle, así que reintentarlo no
   * sirve: limpiarlo evita que alguien lo tipee de nuevo creyendo que se
   * equivocó al escribir.
   */
  it('muestra el error y limpia el código', async () => {
    mockedApi.redeemLinkCode.mockRejectedValue(new ApiError('El código no es válido', 401));
    render(<LinkDeviceScreen onLinked={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-link-code'), 'ABC234');
    fireEvent.press(screen.getByTestId('button-link-submit'));

    await waitFor(() => expect(screen.getByTestId('link-error')).toBeTruthy());
    expect(screen.getByTestId('input-link-code').props.value).toBe('');
  });
});

describe('DevicesScreen', () => {
  it('lista los dispositivos vinculados', async () => {
    mockedApi.linkedDevices.mockResolvedValue([dispositivo()]);
    render(<DevicesScreen token="tok" profiles={[perfil('perfil-1', 'Mía')]} onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('device-device-1')).toBeTruthy());
    expect(screen.getByText('Tablet de Mía')).toBeTruthy();
  });

  it('avisa cuando todavía no hay ninguno', async () => {
    mockedApi.linkedDevices.mockResolvedValue([]);
    render(<DevicesScreen token="tok" profiles={[]} onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('devices-empty')).toBeTruthy());
  });

  it('genera y muestra el código para el dispositivo de un chico/a', async () => {
    mockedApi.linkedDevices.mockResolvedValue([]);
    mockedApi.createLinkCode.mockResolvedValue({
      code: 'ABC234',
      kind: DeviceKind.CHILD,
      expiresAt: '2026-01-01T00:15:00.000Z',
      userId: 'perfil-1',
    });
    render(<DevicesScreen token="tok" profiles={[perfil('perfil-1', 'Mía')]} onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('devices-empty')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-link-child-perfil-1'));

    await waitFor(() => expect(screen.getByTestId('link-code-value')).toBeTruthy());
    expect(screen.getByTestId('link-code-value').props.children).toBe('ABC234');
    expect(mockedApi.createLinkCode).toHaveBeenCalledWith('tok', {
      kind: DeviceKind.CHILD,
      userId: 'perfil-1',
    });
  });

  /** El de un responsable no se ata a un perfil: ve todos los del cuidador. */
  it('genera el código de un responsable sin perfil atado', async () => {
    mockedApi.linkedDevices.mockResolvedValue([]);
    mockedApi.createLinkCode.mockResolvedValue({
      code: 'XYZ789',
      kind: DeviceKind.CAREGIVER,
      expiresAt: '2026-01-01T00:15:00.000Z',
      userId: null,
    });
    render(<DevicesScreen token="tok" profiles={[]} onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('devices-empty')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-link-caregiver'));

    await waitFor(() =>
      expect(mockedApi.createLinkCode).toHaveBeenCalledWith('tok', { kind: DeviceKind.CAREGIVER }),
    );
  });

  it('muestra el error si no se pueden cargar los dispositivos', async () => {
    mockedApi.linkedDevices.mockRejectedValue(new ApiError('Sin conexión', 0));
    render(<DevicesScreen token="tok" profiles={[]} onExit={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('devices-error')).toBeTruthy());
  });
});
