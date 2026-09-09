import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { UserProfile } from '@vozaac/shared';
import { LoginScreen } from '../src/screens/LoginScreen';
import { ProfilePickerScreen } from '../src/screens/ProfilePickerScreen';
import { api } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    login: jest.fn(),
    register: jest.fn(),
    profiles: jest.fn(),
    createProfile: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
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

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('entra con email y contraseña', async () => {
    mockedApi.login.mockResolvedValue({ accessToken: 'tok' } as never);
    const onLoggedIn = jest.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.changeText(screen.getByTestId('input-email'), 'ana@ejemplo.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'contrasena-valida');
    fireEvent.press(screen.getByTestId('button-login'));

    await waitFor(() => {
      expect(mockedApi.login).toHaveBeenCalledWith('ana@ejemplo.com', 'contrasena-valida');
      expect(onLoggedIn).toHaveBeenCalledWith('tok');
    });
  });

  it('no pide el nombre para entrar, sólo para registrarse', () => {
    render(<LoginScreen onLoggedIn={jest.fn()} />);

    expect(screen.queryByTestId('input-fullname')).toBeNull();

    fireEvent.press(screen.getByTestId('button-toggle-mode'));

    expect(screen.getByTestId('input-fullname')).toBeTruthy();
  });

  it('registra al adulto responsable y lo deja adentro', async () => {
    mockedApi.register.mockResolvedValue({ accessToken: 'tok-nuevo' } as never);
    const onLoggedIn = jest.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.press(screen.getByTestId('button-toggle-mode'));
    fireEvent.changeText(screen.getByTestId('input-fullname'), 'Ana Pérez');
    fireEvent.changeText(screen.getByTestId('input-email'), 'ana@ejemplo.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'contrasena-valida');
    fireEvent.press(screen.getByTestId('button-login'));

    await waitFor(() => {
      expect(mockedApi.register).toHaveBeenCalledWith(
        'ana@ejemplo.com',
        'contrasena-valida',
        'Ana Pérez',
      );
      // Registrarse deja la sesión abierta: pedir el login después sería un
      // paso de más para algo que ya se validó.
      expect(onLoggedIn).toHaveBeenCalledWith('tok-nuevo');
    });
  });

  it('no deja registrarse con una contraseña que la API va a rechazar', () => {
    render(<LoginScreen onLoggedIn={jest.fn()} />);

    fireEvent.press(screen.getByTestId('button-toggle-mode'));
    fireEvent.changeText(screen.getByTestId('input-fullname'), 'Ana');
    fireEvent.changeText(screen.getByTestId('input-email'), 'ana@ejemplo.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'corta');

    fireEvent.press(screen.getByTestId('button-login'));

    expect(mockedApi.register).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor', async () => {
    mockedApi.login.mockRejectedValue(new Error('Email o contraseña incorrectos'));
    render(<LoginScreen onLoggedIn={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-email'), 'ana@ejemplo.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'mala');
    fireEvent.press(screen.getByTestId('button-login'));

    expect(await screen.findByText('Email o contraseña incorrectos')).toBeTruthy();
  });

  it('limpia el error al cambiar de modo', async () => {
    mockedApi.login.mockRejectedValue(new Error('Email o contraseña incorrectos'));
    render(<LoginScreen onLoggedIn={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('input-email'), 'ana@ejemplo.com');
    fireEvent.changeText(screen.getByTestId('input-password'), 'mala');
    fireEvent.press(screen.getByTestId('button-login'));
    await screen.findByTestId('login-error');

    fireEvent.press(screen.getByTestId('button-toggle-mode'));

    // El error del login no tiene sentido arrastrado al formulario de registro.
    expect(screen.queryByTestId('login-error')).toBeNull();
  });
});

describe('ProfilePickerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deja crear el primer perfil cuando no hay ninguno', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    mockedApi.createProfile.mockResolvedValue(perfil('u1', 'Mateo'));

    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);
    await screen.findByTestId('profiles-empty');

    fireEvent.press(screen.getByTestId('button-add-profile'));
    fireEvent.changeText(screen.getByTestId('input-profile-name'), 'Mateo');
    fireEvent.press(screen.getByTestId('button-create-profile'));

    await waitFor(() => {
      expect(mockedApi.createProfile).toHaveBeenCalledWith('tok', { name: 'Mateo' });
    });

    // Aparece en la lista sin recargar la pantalla.
    expect(await screen.findByTestId('profile-u1')).toBeTruthy();
  });

  it('recorta los espacios del nombre', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    mockedApi.createProfile.mockResolvedValue(perfil('u1', 'Mateo'));

    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);
    await screen.findByTestId('profiles-empty');

    fireEvent.press(screen.getByTestId('button-add-profile'));
    fireEvent.changeText(screen.getByTestId('input-profile-name'), '  Mateo  ');
    fireEvent.press(screen.getByTestId('button-create-profile'));

    await waitFor(() => {
      expect(mockedApi.createProfile).toHaveBeenCalledWith('tok', { name: 'Mateo' });
    });
  });

  it('no crea un perfil sin nombre', async () => {
    mockedApi.profiles.mockResolvedValue([]);

    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);
    await screen.findByTestId('profiles-empty');

    fireEvent.press(screen.getByTestId('button-add-profile'));
    fireEvent.press(screen.getByTestId('button-create-profile'));

    expect(mockedApi.createProfile).not.toHaveBeenCalled();
  });

  it('avisa si el perfil no se pudo crear', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    mockedApi.createProfile.mockRejectedValue(new Error('No se pudo conectar con el servidor'));

    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);
    await screen.findByTestId('profiles-empty');

    fireEvent.press(screen.getByTestId('button-add-profile'));
    fireEvent.changeText(screen.getByTestId('input-profile-name'), 'Mateo');
    fireEvent.press(screen.getByTestId('button-create-profile'));

    expect(await screen.findByTestId('create-profile-error')).toBeTruthy();
  });

  it('elige un perfil existente', async () => {
    mockedApi.profiles.mockResolvedValue([perfil('u1', 'Mateo')]);
    const onSelect = jest.fn();

    render(<ProfilePickerScreen token="tok" onSelect={onSelect} onLogout={jest.fn()} />);

    fireEvent.press(await screen.findByTestId('profile-u1'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
  });
});
