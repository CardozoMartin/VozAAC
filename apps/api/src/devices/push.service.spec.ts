import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from './push.service';
import { PushToken } from './entities/push-token.entity';
import { ProfileCaregiver } from '../users/entities/profile-caregiver.entity';

const MADRE_ID = '11111111-1111-1111-1111-111111111111';
const PADRE_ID = '22222222-2222-2222-2222-222222222222';
const HERMANA_ID = '33333333-3333-3333-3333-333333333333';
const PERFIL_ID = '44444444-4444-4444-4444-444444444444';
const SESION_DEL_CHICO = '55555555-5555-5555-5555-555555555555';

/**
 * Lo que se prueba acá es a quién le llega el aviso, que es la regla del
 * Módulo 9 con la que no se puede fallar en las dos direcciones: si notifica de
 * menos, la familia no se entera de que el chico/a se siente mal; si notifica
 * al propio dispositivo del chico/a, le devuelve su propio aviso como si
 * alguien le estuviera hablando.
 *
 * El POST a Expo se sustituye por un doble: no queremos pegarle a un servicio
 * externo en los tests, y lo que importa verificar es a qué tokens se arma el
 * mensaje, no que Expo conteste.
 */
describe('PushService', () => {
  let service: PushService;
  let tokens: jest.Mocked<Repository<PushToken>>;
  let links: jest.Mocked<Repository<ProfileCaregiver>>;
  /** Lotes que el servicio intentó mandar, para poder mirarlos. */
  let enviados: { to: string; title: string; body: string }[][];

  const pushToken = (overrides: Partial<PushToken> = {}): PushToken =>
    ({
      id: 'x',
      token: 'ExponentPushToken[madre]',
      platform: 'android',
      caregiverId: MADRE_ID,
      deviceSessionId: null,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as PushToken;

  const vinculo = (caregiverId: string): ProfileCaregiver =>
    ({ id: 'v', userId: PERFIL_ID, caregiverId }) as ProfileCaregiver;

  beforeEach(async () => {
    enviados = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        {
          provide: getRepositoryToken(PushToken),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((row: unknown) => Promise.resolve(row)),
            create: jest.fn((row: unknown) => row),
            delete: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProfileCaregiver),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PushService);
    tokens = module.get(getRepositoryToken(PushToken));
    links = module.get(getRepositoryToken(ProfileCaregiver));

    // Doble del POST a Expo: registra el lote y contesta que todo salió bien.
    jest
      .spyOn(
        service as unknown as { postearLote: (lote: unknown[]) => Promise<unknown[]> },
        'postearLote',
      )
      .mockImplementation((lote: unknown[]) => {
        enviados.push(lote as { to: string; title: string; body: string }[]);
        return Promise.resolve(lote.map(() => ({ status: 'ok' })));
      });
  });

  describe('notifyUrgentAlert', () => {
    it('avisa a todos los responsables vinculados al perfil', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID), vinculo(PADRE_ID), vinculo(HERMANA_ID)]);
      tokens.find.mockResolvedValue([
        pushToken({ caregiverId: MADRE_ID, token: 'ExponentPushToken[madre]' }),
        pushToken({ caregiverId: PADRE_ID, token: 'ExponentPushToken[padre]' }),
        pushToken({ caregiverId: HERMANA_ID, token: 'ExponentPushToken[hermana]' }),
      ]);

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-1',
      });

      expect(report).toEqual({ attempted: 3, accepted: 3, removed: 0 });
      expect(enviados[0].map((m) => m.to)).toEqual([
        'ExponentPushToken[madre]',
        'ExponentPushToken[padre]',
        'ExponentPushToken[hermana]',
      ]);
    });

    it('no le manda el aviso al dispositivo del que salió', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID)]);
      tokens.find.mockResolvedValue([
        // La tablet del chico/a cuelga del mismo cuidador que la enroló, así
        // que sin la exclusión por sesión recibiría su propio aviso.
        pushToken({
          caregiverId: MADRE_ID,
          token: 'ExponentPushToken[tablet-del-chico]',
          deviceSessionId: SESION_DEL_CHICO,
        }),
        pushToken({ caregiverId: MADRE_ID, token: 'ExponentPushToken[celu-de-mama]' }),
      ]);

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-2',
        originDeviceSessionId: SESION_DEL_CHICO,
      });

      expect(report.attempted).toBe(1);
      expect(enviados[0].map((m) => m.to)).toEqual(['ExponentPushToken[celu-de-mama]']);
    });

    it('nombra al chico/a en el título, que es lo que se lee en la pantalla bloqueada', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID)]);
      tokens.find.mockResolvedValue([pushToken()]);

      await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele la panza',
        alertId: 'alerta-3',
      });

      expect(enviados[0][0].title).toBe('Juan necesita ayuda');
      expect(enviados[0][0].body).toBe('Me duele la panza');
    });

    it('no falla cuando el perfil todavía no tiene a nadie vinculado', async () => {
      links.find.mockResolvedValue([]);

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-4',
      });

      expect(report).toEqual({ attempted: 0, accepted: 0, removed: 0 });
      expect(enviados).toHaveLength(0);
    });

    it('no falla cuando los responsables no registraron ningún teléfono', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID)]);
      tokens.find.mockResolvedValue([]);

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-5',
      });

      expect(report.attempted).toBe(0);
      expect(enviados).toHaveLength(0);
    });

    it('da de baja el token que Expo declara muerto y deja los demás', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID), vinculo(PADRE_ID)]);
      tokens.find.mockResolvedValue([
        pushToken({ caregiverId: MADRE_ID, token: 'ExponentPushToken[viejo]' }),
        pushToken({ caregiverId: PADRE_ID, token: 'ExponentPushToken[vivo]' }),
      ]);

      jest
        .spyOn(
          service as unknown as { postearLote: (lote: unknown[]) => Promise<unknown[]> },
          'postearLote',
        )
        .mockResolvedValue([
          { status: 'error', message: 'no existe', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok' },
        ]);

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-6',
      });

      expect(report).toEqual({ attempted: 2, accepted: 1, removed: 1 });
      // Se borra sólo el que murió: un rate limit no tiene que costarle el
      // token a nadie.
      expect(tokens.delete).toHaveBeenCalledWith({ token: expect.anything() });
    });

    it('si Expo se cae, el aviso no revienta: ya quedó guardado en la base', async () => {
      links.find.mockResolvedValue([vinculo(MADRE_ID)]);
      tokens.find.mockResolvedValue([pushToken()]);

      jest
        .spyOn(
          service as unknown as { postearLote: (lote: unknown[]) => Promise<unknown[]> },
          'postearLote',
        )
        .mockRejectedValue(new Error('sin red'));

      const report = await service.notifyUrgentAlert({
        userId: PERFIL_ID,
        profileName: 'Juan',
        pictogramText: 'Me duele',
        alertId: 'alerta-7',
      });

      expect(report).toEqual({ attempted: 1, accepted: 0, removed: 0 });
    });
  });

  describe('register', () => {
    it('reasigna el token cuando el teléfono cambia de cuenta', async () => {
      // Caso real: el padre usa el celular de la madre para entrar con su
      // cuenta. Si quedaran dos filas, los avisos seguirían yendo a la madre.
      tokens.findOne.mockResolvedValue(pushToken({ caregiverId: MADRE_ID }));

      await service.register(PADRE_ID, {
        token: 'ExponentPushToken[madre]',
        platform: 'android',
      });

      expect(tokens.save).toHaveBeenCalledWith(expect.objectContaining({ caregiverId: PADRE_ID }));
      expect(tokens.create).not.toHaveBeenCalled();
    });

    it('crea la fila la primera vez que el dispositivo se registra', async () => {
      tokens.findOne.mockResolvedValue(null);

      await service.register(
        MADRE_ID,
        { token: 'ExponentPushToken[nuevo]', platform: 'ios' },
        SESION_DEL_CHICO,
      );

      expect(tokens.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'ExponentPushToken[nuevo]',
          platform: 'ios',
          caregiverId: MADRE_ID,
          deviceSessionId: SESION_DEL_CHICO,
        }),
      );
    });
  });
});
