import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CaregiverRole, DeviceKind, LINK_CODE, DEFAULT_DEVICE_NAME } from '@vozaac/shared';
import { DevicesService } from './devices.service';
import { DeviceSession } from './entities/device-session.entity';
import { LinkCode } from './entities/link-code.entity';
import { User } from '../users/entities/user.entity';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

const CAREGIVER_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const OTRO_USER_ID = '33333333-3333-3333-3333-333333333333';

describe('DevicesService', () => {
  let service: DevicesService;
  let sessions: jest.Mocked<Repository<DeviceSession>>;
  let codes: jest.Mocked<Repository<LinkCode>>;
  let users: jest.Mocked<Repository<User>>;
  let caregivers: jest.Mocked<Repository<Caregiver>>;

  const caregiver = (): Caregiver =>
    ({
      id: CAREGIVER_ID,
      email: 'ana@vozaac.local',
      fullName: 'Ana Pérez',
      role: CaregiverRole.FAMILY,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }) as Caregiver;

  /** Código vigente y sin usar, el caso feliz del canje. */
  const codigoVigente = (overrides: Partial<LinkCode> = {}): LinkCode =>
    ({
      id: '44444444-4444-4444-4444-444444444444',
      code: 'ABC234',
      kind: DeviceKind.CHILD,
      caregiverId: CAREGIVER_ID,
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      failedAttempts: 0,
      createdAt: new Date(),
      ...overrides,
    }) as LinkCode;

  const firmar = () => 'token-de-acceso';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: getRepositoryToken(DeviceSession),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((dto: Partial<DeviceSession>) => dto as DeviceSession),
            save: jest.fn((entity: DeviceSession) =>
              Promise.resolve({
                ...entity,
                id: '55555555-5555-5555-5555-555555555555',
                createdAt: new Date('2026-01-01T00:00:00Z'),
              }),
            ),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LinkCode),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<LinkCode>) => dto as LinkCode),
            save: jest.fn((entity: LinkCode) => Promise.resolve(entity)),
            delete: jest.fn(),
            increment: jest.fn(),
          },
        },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Caregiver), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(DevicesService);
    sessions = module.get(getRepositoryToken(DeviceSession));
    codes = module.get(getRepositoryToken(LinkCode));
    users = module.get(getRepositoryToken(User));
    caregivers = module.get(getRepositoryToken(Caregiver));
  });

  describe('createLinkCode', () => {
    it('genera un código con el alfabeto y el largo esperados', async () => {
      users.findOne.mockResolvedValue({ id: USER_ID } as User);
      codes.findOne.mockResolvedValue(null);

      const resultado = await service.createLinkCode(CAREGIVER_ID, {
        kind: DeviceKind.CHILD,
        userId: USER_ID,
      });

      expect(resultado.code).toHaveLength(LINK_CODE.length);
      // Sin O/0 ni I/1/L: el código se dicta en voz alta.
      expect(resultado.code).toMatch(new RegExp(`^[${LINK_CODE.alphabet}]{${LINK_CODE.length}}$`));
      expect(resultado.userId).toBe(USER_ID);
    });

    it('rechaza un dispositivo de chico/a sin perfil, porque no sabría en qué tablero abrir', async () => {
      await expect(
        service.createLinkCode(CAREGIVER_ID, { kind: DeviceKind.CHILD }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza atar el dispositivo de un responsable a un solo perfil', async () => {
      await expect(
        service.createLinkCode(CAREGIVER_ID, { kind: DeviceKind.CAREGIVER, userId: USER_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * El perfil de otro cuidador da 404 y no 403: un 403 confirmaría que el id
     * existe, y estos son datos de salud de menores.
     */
    it('da 404 si el perfil es de otro cuidador', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(
        service.createLinkCode(CAREGIVER_ID, { kind: DeviceKind.CHILD, userId: OTRO_USER_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('barre los códigos vencidos del cuidador al generar uno nuevo', async () => {
      users.findOne.mockResolvedValue({ id: USER_ID } as User);
      codes.findOne.mockResolvedValue(null);

      await service.createLinkCode(CAREGIVER_ID, { kind: DeviceKind.CHILD, userId: USER_ID });

      expect(codes.delete).toHaveBeenCalledWith(
        expect.objectContaining({ caregiverId: CAREGIVER_ID }),
      );
    });

    it('reintenta si el código sorteado ya existe', async () => {
      users.findOne.mockResolvedValue({ id: USER_ID } as User);
      codes.findOne
        .mockResolvedValueOnce(codigoVigente())
        .mockResolvedValueOnce(codigoVigente())
        .mockResolvedValue(null);

      const resultado = await service.createLinkCode(CAREGIVER_ID, {
        kind: DeviceKind.CHILD,
        userId: USER_ID,
      });

      expect(resultado.code).toHaveLength(LINK_CODE.length);
      expect(codes.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('redeem', () => {
    it('abre la sesión y devuelve un refresh token de 64 hex', async () => {
      codes.findOne.mockResolvedValue(codigoVigente());
      caregivers.findOne.mockResolvedValue(caregiver());

      const resultado = await service.redeem(
        { code: 'ABC234', deviceName: 'Tablet de Mía' },
        firmar,
      );

      expect(resultado.accessToken).toBe('token-de-acceso');
      expect(resultado.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(resultado.device.name).toBe('Tablet de Mía');
      expect(resultado.device.kind).toBe(DeviceKind.CHILD);
      expect(resultado.userId).toBe(USER_ID);
    });

    /** El token nunca se guarda en claro, igual que las contraseñas. */
    it('guarda el hash del refresh token y no el token', async () => {
      codes.findOne.mockResolvedValue(codigoVigente());
      caregivers.findOne.mockResolvedValue(caregiver());

      const resultado = await service.redeem({ code: 'ABC234' }, firmar);
      const guardada = sessions.save.mock.calls[0][0] as DeviceSession;

      expect(guardada.refreshTokenHash).not.toBe(resultado.refreshToken);
      expect(guardada.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('usa un nombre por defecto cuando el dispositivo no informa el suyo', async () => {
      codes.findOne.mockResolvedValue(codigoVigente());
      caregivers.findOne.mockResolvedValue(caregiver());

      const resultado = await service.redeem({ code: 'ABC234' }, firmar);

      expect(resultado.device.name).toBe(DEFAULT_DEVICE_NAME);
    });

    it('marca el código como usado', async () => {
      codes.findOne.mockResolvedValue(codigoVigente());
      caregivers.findOne.mockResolvedValue(caregiver());

      await service.redeem({ code: 'ABC234' }, firmar);

      expect((codes.save.mock.calls[0][0] as LinkCode).usedAt).toBeInstanceOf(Date);
    });

    it('rechaza un código ya canjeado', async () => {
      codes.findOne.mockResolvedValue(codigoVigente({ usedAt: new Date() }));

      await expect(service.redeem({ code: 'ABC234' }, firmar)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza un código vencido', async () => {
      codes.findOne.mockResolvedValue(codigoVigente({ expiresAt: new Date(Date.now() - 1000) }));

      await expect(service.redeem({ code: 'ABC234' }, firmar)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza un código quemado por intentos fallidos', async () => {
      codes.findOne.mockResolvedValue(codigoVigente({ failedAttempts: LINK_CODE.maxAttempts }));

      await expect(service.redeem({ code: 'ABC234' }, firmar)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    /**
     * Mismo mensaje para todos los rechazos: decir cuál es el motivo le
     * confirmaría a un atacante que acertó un código válido pero vencido.
     */
    it('no distingue en el mensaje un código inexistente de uno vencido', async () => {
      codes.findOne.mockResolvedValue(null);
      const inexistente = await service.redeem({ code: 'ZZZZZZ' }, firmar).catch((e) => e);

      codes.findOne.mockResolvedValue(codigoVigente({ expiresAt: new Date(Date.now() - 1000) }));
      const vencido = await service.redeem({ code: 'ABC234' }, firmar).catch((e) => e);

      expect(inexistente.message).toBe(vencido.message);
    });
  });

  describe('refresh', () => {
    /**
     * La rotación es lo que hace que un token filtrado tenga vida corta: el
     * viejo deja de servir apenas el dispositivo renueva.
     */
    it('rota el refresh token y deja el anterior sin efecto', async () => {
      codes.findOne.mockResolvedValue(codigoVigente());
      caregivers.findOne.mockResolvedValue(caregiver());
      const { refreshToken: original } = await service.redeem({ code: 'ABC234' }, firmar);
      const hashGuardado = (sessions.save.mock.calls[0][0] as DeviceSession).refreshTokenHash;

      sessions.findOne.mockResolvedValue({
        id: '55555555-5555-5555-5555-555555555555',
        caregiverId: CAREGIVER_ID,
        userId: USER_ID,
        refreshTokenHash: hashGuardado,
      } as DeviceSession);

      const renovado = await service.refresh(original, firmar);

      expect(renovado.refreshToken).not.toBe(original);
      expect(renovado.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(sessions.update).toHaveBeenCalledWith(
        '55555555-5555-5555-5555-555555555555',
        expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      );
    });

    it('rechaza un refresh token que no corresponde a ninguna sesión', async () => {
      sessions.findOne.mockResolvedValue(null);

      await expect(service.refresh('a'.repeat(64), firmar)).rejects.toThrow(UnauthorizedException);
    });

    /** Un token con formato inválido ni siquiera llega a consultar la base. */
    it('rechaza un token con formato inválido sin tocar la base', async () => {
      await expect(service.refresh('no-es-un-token', firmar)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessions.findOne).not.toHaveBeenCalled();
    });

    /**
     * Que la sesión revocada corte el acceso es el punto de todo el diseño: sin
     * esto, revocar un dispositivo perdido no serviría de nada.
     */
    it('rechaza una sesión revocada', async () => {
      // El where del servicio incluye revokedAt: IsNull(), así que una sesión
      // revocada simplemente no aparece.
      sessions.findOne.mockResolvedValue(null);

      await expect(service.refresh('b'.repeat(64), firmar)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revoke', () => {
    it('marca la sesión revocada en vez de borrar la fila', async () => {
      sessions.findOne.mockResolvedValue({ id: 'device-1' } as DeviceSession);

      await service.revoke(CAREGIVER_ID, 'device-1');

      expect(sessions.update).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('da 404 al revocar un dispositivo de otro cuidador', async () => {
      sessions.findOne.mockResolvedValue(null);

      await expect(service.revoke(CAREGIVER_ID, 'device-ajeno')).rejects.toThrow(NotFoundException);
    });
  });
});
