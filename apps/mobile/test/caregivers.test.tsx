import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { INVITE_CODE } from '@vozaac/shared';
import type { ProfileCaregiverInfo, UserProfile } from '@vozaac/shared';
import { CaregiversScreen } from '../src/screens/CaregiversScreen';
import { ProfilePickerScreen } from '../src/screens/ProfilePickerScreen';
import { api, ApiError } from '../src/api/client';

jest.mock('../src/api/client', () => ({
  api: {
    profiles: jest.fn(),
    createProfile: jest.fn(),
    profileCaregivers: jest.fn(),
    inviteCaregiver: jest.fn(),
    acceptInvite: jest.fn(),
    removeCaregiver: jest.fn(),
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

function responsable(overrides: Partial<ProfileCaregiverInfo> = {}): ProfileCaregiverInfo {
  return {
    id: 'link-1',
    caregiverId: 'cuidador-1',
    fullName: 'Ana Pérez',
    email: 'ana@vozaac.local',
    relationship: 'Mamá',
    isSelf: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CaregiversScreen', () => {
  const render_ = () =>
    render(<CaregiversScreen token="tok" userId="perfil-1" profileName="Mía" onExit={jest.fn()} />);

  it('lista a los responsables con su etiqueta y su email', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([
      responsable(),
      responsable({
        id: 'link-2',
        caregiverId: 'cuidador-2',
        fullName: 'Juan Gómez',
        email: 'juan@vozaac.local',
        relationship: 'Papá',
        isSelf: false,
      }),
    ]);
    render_();

    await waitFor(() => expect(screen.getByTestId('caregiver-cuidador-1')).toBeTruthy());
    expect(screen.getByText('Papá · juan@vozaac.local')).toBeTruthy();
  });

  /** Para que nadie se confunda de fila al quitar a alguien. */
  it('marca cuál de los responsables es uno mismo', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([responsable()]);
    render_();

    await waitFor(() => expect(screen.getByText('Ana Pérez (vos)')).toBeTruthy());
  });

  it('genera la invitación con el parentesco tipeado', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([responsable()]);
    mockedApi.inviteCaregiver.mockResolvedValue({
      code: 'ABC234',
      userId: 'perfil-1',
      profileName: 'Mía',
      relationship: 'Papá',
      expiresAt: '2026-01-03T00:00:00.000Z',
    });
    render_();

    await waitFor(() => expect(screen.getByTestId('button-invite')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('input-relationship'), 'Papá');
    fireEvent.press(screen.getByTestId('button-invite'));

    await waitFor(() => expect(screen.getByTestId('invite-code-value')).toBeTruthy());
    expect(mockedApi.inviteCaregiver).toHaveBeenCalledWith('tok', 'perfil-1', 'Papá');
    expect(screen.getByTestId('invite-code-value').props.children).toBe('ABC234');
  });

  it('permite invitar sin poner parentesco', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([responsable()]);
    mockedApi.inviteCaregiver.mockResolvedValue({
      code: 'XYZ789',
      userId: 'perfil-1',
      profileName: 'Mía',
      relationship: null,
      expiresAt: '2026-01-03T00:00:00.000Z',
    });
    render_();

    await waitFor(() => expect(screen.getByTestId('button-invite')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-invite'));

    await waitFor(() =>
      expect(mockedApi.inviteCaregiver).toHaveBeenCalledWith('tok', 'perfil-1', undefined),
    );
  });

  /**
   * Con un solo responsable, quitarlo dejaría el perfil sin nadie que pueda
   * verlo. La API lo rechaza; la app directamente no lo ofrece.
   */
  it('no ofrece quitar cuando hay un solo responsable', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([responsable()]);
    render_();

    await waitFor(() => expect(screen.getByTestId('caregiver-cuidador-1')).toBeTruthy());
    expect(screen.queryByTestId('button-remove-cuidador-1')).toBeNull();
  });

  it('ofrece quitar cuando hay más de uno', async () => {
    mockedApi.profileCaregivers.mockResolvedValue([
      responsable(),
      responsable({ id: 'link-2', caregiverId: 'cuidador-2', isSelf: false }),
    ]);
    render_();

    await waitFor(() => expect(screen.getByTestId('button-remove-cuidador-2')).toBeTruthy());
  });

  it('muestra el error si no se pueden cargar', async () => {
    mockedApi.profileCaregivers.mockRejectedValue(new ApiError('Sin conexión', 0));
    render_();

    await waitFor(() => expect(screen.getByTestId('caregivers-error')).toBeTruthy());
  });
});

/**
 * Canje de la invitación, que vive en el selector de perfiles.
 *
 * Es por donde entra el segundo responsable: se registra con su propia cuenta,
 * todavía no ve ningún perfil, y lo único que tiene es el código.
 */
describe('ProfilePickerScreen — aceptar invitación', () => {
  it('acepta el código y recarga los perfiles', async () => {
    mockedApi.profiles.mockResolvedValueOnce([]).mockResolvedValueOnce([perfil('perfil-1', 'Mía')]);
    mockedApi.acceptInvite.mockResolvedValue({
      userId: 'perfil-1',
      profileName: 'Mía',
      relationship: 'Papá',
    });
    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('profiles-empty')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-open-invite'));
    fireEvent.changeText(screen.getByTestId('input-invite-code'), 'ABC234');
    fireEvent.press(screen.getByTestId('button-accept-invite'));

    await waitFor(() => expect(screen.getByTestId('profile-perfil-1')).toBeTruthy());
    expect(mockedApi.acceptInvite).toHaveBeenCalledWith('tok', 'ABC234');
  });

  /** El código llega por mensaje o dictado: el formato no puede importar. */
  it('normaliza el código mientras se tipea', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('button-open-invite')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-open-invite'));
    fireEvent.changeText(screen.getByTestId('input-invite-code'), 'abc-234');

    expect(screen.getByTestId('input-invite-code').props.value).toBe('ABC234');
  });

  it('no deja aceptar un código incompleto', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('button-open-invite')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-open-invite'));
    fireEvent.changeText(screen.getByTestId('input-invite-code'), 'AB');
    fireEvent.press(screen.getByTestId('button-accept-invite'));

    expect(mockedApi.acceptInvite).not.toHaveBeenCalled();
  });

  it('recorta el código al largo esperado', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('button-open-invite')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-open-invite'));
    fireEvent.changeText(screen.getByTestId('input-invite-code'), 'ABCDEFGHIJ');

    expect(screen.getByTestId('input-invite-code').props.value).toHaveLength(INVITE_CODE.length);
  });

  it('muestra el error y limpia el código si la invitación no sirve', async () => {
    mockedApi.profiles.mockResolvedValue([]);
    mockedApi.acceptInvite.mockRejectedValue(new ApiError('La invitación no es válida', 401));
    render(<ProfilePickerScreen token="tok" onSelect={jest.fn()} onLogout={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('button-open-invite')).toBeTruthy());
    fireEvent.press(screen.getByTestId('button-open-invite'));
    fireEvent.changeText(screen.getByTestId('input-invite-code'), 'ABC234');
    fireEvent.press(screen.getByTestId('button-accept-invite'));

    await waitFor(() => expect(screen.getByTestId('invite-error')).toBeTruthy());
    expect(screen.getByTestId('input-invite-code').props.value).toBe('');
  });
});
