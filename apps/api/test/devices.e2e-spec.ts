import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DeviceKind, LINK_CODE } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { DevicesModule } from '../src/devices/devices.module';
import { LinkCode } from '../src/devices/entities/link-code.entity';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E de la vinculación de dispositivos (Módulo 9) sobre SQLite en memoria.
 *
 * El circuito completo es: el padre genera un código desde su celular, lo
 * tipea en el dispositivo del chico/a, ese dispositivo queda con una sesión que
 * se renueva sola, y el padre puede cortarla cuando quiera. Lo que más importa
 * verificar es lo último: que revocar corte el acceso de verdad.
 */
describe('Vinculación de dispositivos (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'secreto-de-test', JWT_EXPIRES_IN: '1h' })],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: TEST_ENTITIES,
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        AuthModule,
        UsersModule,
        DevicesModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    for (const entity of [...TEST_ENTITIES].reverse()) {
      await dataSource.getRepository(entity).clear();
    }
  });

  const server = () => app.getHttpServer();

  /** Registra un cuidador con un perfil de chico/a y devuelve ambos ids. */
  async function familia(email = 'ana@vozaac.local') {
    const registro = await request(server())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName: 'Ana Pérez' })
      .expect(201);

    const token = registro.body.accessToken as string;

    const perfil = await request(server())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mía' })
      .expect(201);

    return { token, userId: perfil.body.id as string };
  }

  const generarCodigo = (token: string, body: Record<string, unknown>) =>
    request(server())
      .post('/api/devices/link-codes')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('POST /api/devices/link-codes', () => {
    it('genera un código para el dispositivo de un chico/a', async () => {
      const { token, userId } = await familia();

      const response = await generarCodigo(token, { kind: DeviceKind.CHILD, userId }).expect(201);

      expect(response.body.code).toHaveLength(LINK_CODE.length);
      expect(response.body.kind).toBe(DeviceKind.CHILD);
      expect(response.body.userId).toBe(userId);
      expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('genera un código para el dispositivo de otro responsable, sin perfil atado', async () => {
      const { token } = await familia();

      const response = await generarCodigo(token, { kind: DeviceKind.CAREGIVER }).expect(201);

      expect(response.body.userId).toBeNull();
    });

    it('exige sesión de cuidador', async () => {
      await request(server())
        .post('/api/devices/link-codes')
        .send({ kind: DeviceKind.CAREGIVER })
        .expect(401);
    });

    /** Privacidad: el perfil ajeno da 404 y no confirma que el id exista. */
    it('no deja generar un código contra el perfil de otro cuidador', async () => {
      const ajena = await familia('otro@vozaac.local');
      const { token } = await familia();

      await generarCodigo(token, { kind: DeviceKind.CHILD, userId: ajena.userId }).expect(404);
    });

    it('rechaza un dispositivo de chico/a sin perfil', async () => {
      const { token } = await familia();
      await generarCodigo(token, { kind: DeviceKind.CHILD }).expect(400);
    });
  });

  describe('POST /api/devices/redeem', () => {
    it('canjea el código y devuelve el perfil ya resuelto', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });

      const response = await request(server())
        .post('/api/devices/redeem')
        .send({ code: codigo.code, deviceName: 'Tablet de Mía' })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(response.body.device.name).toBe('Tablet de Mía');
      // El perfil viene en la misma respuesta: el dispositivo del chico/a abre
      // directo en su tablero, sin una pantalla de carga de más.
      expect(response.body.profile.id).toBe(userId);
    });

    it('el dispositivo de un responsable no trae perfil', async () => {
      const { token } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CAREGIVER });

      const response = await request(server())
        .post('/api/devices/redeem')
        .send({ code: codigo.code })
        .expect(200);

      expect(response.body.profile).toBeNull();
    });

    /** El código se dicta por teléfono: minúsculas y espacios tienen que andar. */
    it('acepta el código en minúsculas y con espacios', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });
      const tipeado = `${codigo.code.slice(0, 3)} ${codigo.code.slice(3)}`.toLowerCase();

      await request(server()).post('/api/devices/redeem').send({ code: tipeado }).expect(200);
    });

    it('un código sirve una sola vez', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });

      await request(server()).post('/api/devices/redeem').send({ code: codigo.code }).expect(200);
      await request(server()).post('/api/devices/redeem').send({ code: codigo.code }).expect(401);
    });

    it('rechaza un código inexistente', async () => {
      await request(server()).post('/api/devices/redeem').send({ code: 'ZZZZZZ' }).expect(401);
    });

    it('rechaza un código vencido', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });

      await dataSource
        .getRepository(LinkCode)
        .update({ code: codigo.code }, { expiresAt: new Date(Date.now() - 1000) });

      await request(server()).post('/api/devices/redeem').send({ code: codigo.code }).expect(401);
    });

    /**
     * Seis caracteres sin límite de intentos se rompen a fuerza bruta. Con
     * límite, el código se quema antes de que valga la pena intentarlo.
     */
    it('quema el código después de los intentos fallidos permitidos', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });

      await dataSource
        .getRepository(LinkCode)
        .update({ code: codigo.code }, { failedAttempts: LINK_CODE.maxAttempts });

      await request(server()).post('/api/devices/redeem').send({ code: codigo.code }).expect(401);
    });

    it('cuenta el intento fallido contra el código tipeado', async () => {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });

      await dataSource
        .getRepository(LinkCode)
        .update({ code: codigo.code }, { expiresAt: new Date(Date.now() - 1000) });
      await request(server()).post('/api/devices/redeem').send({ code: codigo.code }).expect(401);

      const guardado = await dataSource
        .getRepository(LinkCode)
        .findOne({ where: { code: codigo.code } });
      expect(guardado?.failedAttempts).toBe(1);
    });

    it('rechaza un código con largo inválido antes de tocar la base', async () => {
      await request(server()).post('/api/devices/redeem').send({ code: 'AB' }).expect(400);
    });
  });

  describe('POST /api/devices/refresh', () => {
    /** Registra un dispositivo de chico/a y devuelve sus tokens. */
    async function dispositivoVinculado() {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });
      const canje = await request(server())
        .post('/api/devices/redeem')
        .send({ code: codigo.code, deviceName: 'Tablet de Mía' })
        .expect(200);

      return { cuidador: token, dispositivo: canje.body, userId };
    }

    /**
     * Esto es lo que resuelve el bloqueante del token de 7 días: el celular
     * del chico/a renueva su sesión solo, sin que él tenga que hacer nada.
     */
    it('renueva la sesión y entrega un par de tokens nuevo', async () => {
      const { dispositivo } = await dispositivoVinculado();

      const response = await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: dispositivo.refreshToken })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(response.body.refreshToken).not.toBe(dispositivo.refreshToken);
    });

    /** El access token renovado tiene que servir de verdad contra la API. */
    it('el access token renovado sirve para pedir los perfiles', async () => {
      const { dispositivo, userId } = await dispositivoVinculado();

      const { body: renovado } = await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: dispositivo.refreshToken })
        .expect(200);

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${renovado.accessToken}`)
        .expect(200);

      expect(perfiles.body.map((p: { id: string }) => p.id)).toContain(userId);
    });

    /** Rotación: el token viejo no sirve más apenas se renueva. */
    it('invalida el refresh token anterior al rotarlo', async () => {
      const { dispositivo } = await dispositivoVinculado();

      await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: dispositivo.refreshToken })
        .expect(200);

      await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: dispositivo.refreshToken })
        .expect(401);
    });

    it('rechaza un refresh token inventado', async () => {
      await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: 'a'.repeat(64) })
        .expect(401);
    });
  });

  describe('GET /api/devices y DELETE /api/devices/:id', () => {
    async function conDispositivo() {
      const { token, userId } = await familia();
      const { body: codigo } = await generarCodigo(token, { kind: DeviceKind.CHILD, userId });
      const canje = await request(server())
        .post('/api/devices/redeem')
        .send({ code: codigo.code, deviceName: 'Tablet de Mía' })
        .expect(200);

      return { cuidador: token, dispositivo: canje.body };
    }

    it('lista los dispositivos vinculados del cuidador', async () => {
      const { cuidador } = await conDispositivo();

      const response = await request(server())
        .get('/api/devices')
        .set('Authorization', `Bearer ${cuidador}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Tablet de Mía');
      expect(response.body[0].kind).toBe(DeviceKind.CHILD);
    });

    /** El hash del token es la credencial: no puede salir nunca por la API. */
    it('no expone el hash del refresh token', async () => {
      const { cuidador } = await conDispositivo();

      const response = await request(server())
        .get('/api/devices')
        .set('Authorization', `Bearer ${cuidador}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('refreshTokenHash');
    });

    it('un cuidador no ve los dispositivos de otro', async () => {
      await conDispositivo();
      const otro = await request(server())
        .post('/api/auth/register')
        .send({ email: 'otro@vozaac.local', password: 'contrasena-valida', fullName: 'Otro' })
        .expect(201);

      const response = await request(server())
        .get('/api/devices')
        .set('Authorization', `Bearer ${otro.body.accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    /**
     * El caso que justifica todo el diseño: si un dispositivo se pierde, el
     * padre lo revoca y esa sesión deja de renovarse.
     */
    it('revocar corta la renovación del dispositivo', async () => {
      const { cuidador, dispositivo } = await conDispositivo();

      await request(server())
        .delete(`/api/devices/${dispositivo.device.id}`)
        .set('Authorization', `Bearer ${cuidador}`)
        .expect(204);

      await request(server())
        .post('/api/devices/refresh')
        .send({ refreshToken: dispositivo.refreshToken })
        .expect(401);
    });

    it('el dispositivo revocado desaparece de la lista', async () => {
      const { cuidador, dispositivo } = await conDispositivo();

      await request(server())
        .delete(`/api/devices/${dispositivo.device.id}`)
        .set('Authorization', `Bearer ${cuidador}`)
        .expect(204);

      const response = await request(server())
        .get('/api/devices')
        .set('Authorization', `Bearer ${cuidador}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('un cuidador no puede revocar el dispositivo de otro', async () => {
      const { dispositivo } = await conDispositivo();
      const otro = await request(server())
        .post('/api/auth/register')
        .send({ email: 'otro@vozaac.local', password: 'contrasena-valida', fullName: 'Otro' })
        .expect(201);

      await request(server())
        .delete(`/api/devices/${dispositivo.device.id}`)
        .set('Authorization', `Bearer ${otro.body.accessToken}`)
        .expect(404);
    });
  });
});
