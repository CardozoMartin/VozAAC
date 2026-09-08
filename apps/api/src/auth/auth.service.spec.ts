import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CaregiverRole } from '@vozaac/shared';
import { AuthService } from './auth.service';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<Repository<Caregiver>>;
  let jwtService: jest.Mocked<JwtService>;

  const baseCaregiver = (): Caregiver =>
    ({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'ana@vozaac.local',
      fullName: 'Ana Pérez',
      role: CaregiverRole.THERAPIST,
      passwordHash: bcrypt.hashSync('contrasena-valida', 4),
      therapistPinHash: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }) as Caregiver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Caregiver),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Caregiver>) => dto as Caregiver),
            save: jest.fn((entity: Caregiver) => Promise.resolve(entity)),
            update: jest.fn(),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token-firmado') } },
      ],
    }).compile();

    service = module.get(AuthService);
    repository = module.get(getRepositoryToken(Caregiver));
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('crea el cuidador con la contraseña hasheada y devuelve el token', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.register({
        email: 'nueva@vozaac.local',
        password: 'contrasena-valida',
        fullName: 'Nueva Cuidadora',
      });

      expect(result.accessToken).toBe('token-firmado');
      expect(result.caregiver.email).toBe('nueva@vozaac.local');

      const saved = repository.save.mock.calls[0][0] as Caregiver;
      expect(saved.passwordHash).not.toBe('contrasena-valida');
      expect(await bcrypt.compare('contrasena-valida', saved.passwordHash)).toBe(true);
    });

    it('asigna el rol family por defecto', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.register({
        email: 'nueva@vozaac.local',
        password: 'contrasena-valida',
        fullName: 'Nueva Cuidadora',
      });

      expect((repository.save.mock.calls[0][0] as Caregiver).role).toBe(CaregiverRole.FAMILY);
    });

    it('rechaza un email ya registrado', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());

      await expect(
        service.register({
          email: 'ana@vozaac.local',
          password: 'contrasena-valida',
          fullName: 'Ana Pérez',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('devuelve el token cuando las credenciales son correctas', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());

      const result = await service.login({
        email: 'ana@vozaac.local',
        password: 'contrasena-valida',
      });

      expect(result.accessToken).toBe('token-firmado');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '11111111-1111-1111-1111-111111111111',
        email: 'ana@vozaac.local',
        role: CaregiverRole.THERAPIST,
      });
    });

    it('nunca devuelve el hash de la contraseña', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());

      const result = await service.login({
        email: 'ana@vozaac.local',
        password: 'contrasena-valida',
      });

      expect(JSON.stringify(result)).not.toContain('$2b$');
      expect(result.caregiver).not.toHaveProperty('passwordHash');
    });

    it('rechaza una contraseña incorrecta', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());

      await expect(
        service.login({ email: 'ana@vozaac.local', password: 'contrasena-mala' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza un email inexistente con el mismo mensaje que una contraseña incorrecta', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());
      const wrongPassword = await service
        .login({ email: 'ana@vozaac.local', password: 'contrasena-mala' })
        .catch((error: Error) => error.message);

      repository.findOne.mockResolvedValue(null);
      const unknownEmail = await service
        .login({ email: 'nadie@vozaac.local', password: 'contrasena-valida' })
        .catch((error: Error) => error.message);

      // Mensajes distintos permitirían enumerar qué emails están registrados.
      expect(unknownEmail).toBe(wrongPassword);
    });
  });

  describe('PIN del modo terapeuta', () => {
    it('guarda el PIN hasheado, nunca en texto plano', async () => {
      await service.setTherapistPin('11111111-1111-1111-1111-111111111111', '1234');

      const [, changes] = repository.update.mock.calls[0] as [string, Partial<Caregiver>];
      expect(changes.therapistPinHash).not.toBe('1234');
      expect(await bcrypt.compare('1234', changes.therapistPinHash as string)).toBe(true);
    });

    it('acepta el PIN correcto', async () => {
      repository.findOne.mockResolvedValue({
        ...baseCaregiver(),
        therapistPinHash: await bcrypt.hash('1234', 4),
      } as Caregiver);

      await expect(
        service.verifyTherapistPin('11111111-1111-1111-1111-111111111111', '1234'),
      ).resolves.toBe(true);
    });

    it('rechaza el PIN incorrecto', async () => {
      repository.findOne.mockResolvedValue({
        ...baseCaregiver(),
        therapistPinHash: await bcrypt.hash('1234', 4),
      } as Caregiver);

      await expect(
        service.verifyTherapistPin('11111111-1111-1111-1111-111111111111', '9999'),
      ).resolves.toBe(false);
    });

    it('avisa cuando todavía no hay PIN configurado', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());

      await expect(
        service.verifyTherapistPin('11111111-1111-1111-1111-111111111111', '1234'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('informa si el cuidador ya configuró un PIN', async () => {
      repository.findOne.mockResolvedValue(baseCaregiver());
      await expect(service.hasTherapistPin('11111111-1111-1111-1111-111111111111')).resolves.toBe(
        false,
      );

      repository.findOne.mockResolvedValue({
        ...baseCaregiver(),
        therapistPinHash: await bcrypt.hash('1234', 4),
      } as Caregiver);
      await expect(service.hasTherapistPin('11111111-1111-1111-1111-111111111111')).resolves.toBe(
        true,
      );
    });
  });
});
