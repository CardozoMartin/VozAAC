import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CaregiverRole } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E del Módulo 2 sobre SQLite en memoria, para que corra sin Docker.
 *
 * Lo importante acá no es solo que el login funcione, sino que un cuidador no
 * pueda ver los perfiles de otro: son datos de salud de menores.
 */
describe('Autenticación y perfiles (e2e)', () => {
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
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mismos pipes que en main.ts, si no los DTOs no validarían nada.
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
    // Cada test arranca con la base limpia para no depender del orden.
    for (const entity of [...TEST_ENTITIES].reverse()) {
      await dataSource.getRepository(entity).clear();
    }
  });

  const registrar = (email: string, password = 'contrasena-valida') =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Cuidador de prueba' });

  describe('POST /api/auth/register', () => {
    it('registra un cuidador y devuelve el token', async () => {
      const response = await registrar('ana@vozaac.local').expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.caregiver.email).toBe('ana@vozaac.local');
      expect(response.body.caregiver.role).toBe(CaregiverRole.FAMILY);
    });

    it('nunca expone el hash de la contraseña', async () => {
      const response = await registrar('ana@vozaac.local').expect(201);

      expect(JSON.stringify(response.body)).not.toContain('$2b$');
      expect(response.body.caregiver).not.toHaveProperty('passwordHash');
    });

    it('normaliza el email a minúsculas', async () => {
      const response = await registrar('Ana@VozAAC.Local').expect(201);
      expect(response.body.caregiver.email).toBe('ana@vozaac.local');
    });

    it('rechaza un email repetido', async () => {
      await registrar('ana@vozaac.local').expect(201);
      await registrar('ana@vozaac.local').expect(409);
    });

    it('rechaza una contraseña demasiado corta', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'ana@vozaac.local', password: 'corta', fullName: 'Ana' })
        .expect(400);
    });

    it('rechaza un email mal formado', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'no-es-un-email', password: 'contrasena-valida', fullName: 'Ana' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await registrar('ana@vozaac.local');
    });

    it('devuelve el token con credenciales correctas', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@vozaac.local', password: 'contrasena-valida' })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('rechaza la contraseña incorrecta', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@vozaac.local', password: 'contrasena-mala' })
        .expect(401);
    });

    it('responde igual ante un email inexistente que ante una contraseña incorrecta', async () => {
      const inexistente = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nadie@vozaac.local', password: 'contrasena-valida' })
        .expect(401);

      const incorrecta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@vozaac.local', password: 'contrasena-mala' })
        .expect(401);

      expect(inexistente.body.message).toBe(incorrecta.body.message);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devuelve el cuidador autenticado', async () => {
      const { body } = await registrar('ana@vozaac.local');

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('ana@vozaac.local');
    });

    it('rechaza la request sin token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('rechaza un token inventado', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-falso')
        .expect(401);
    });
  });

  describe('PIN del modo terapeuta', () => {
    let token: string;

    beforeEach(async () => {
      const { body } = await registrar('ana@vozaac.local');
      token = body.accessToken;
    });

    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    it('arranca sin PIN configurado', async () => {
      const response = await auth(request(app.getHttpServer()).get('/api/auth/pin')).expect(200);
      expect(response.body.configured).toBe(false);
    });

    it('configura el PIN y lo reporta como configurado', async () => {
      await auth(request(app.getHttpServer()).put('/api/auth/pin'))
        .send({ pin: '1234' })
        .expect(204);

      const response = await auth(request(app.getHttpServer()).get('/api/auth/pin')).expect(200);
      expect(response.body.configured).toBe(true);
    });

    it('acepta el PIN correcto', async () => {
      await auth(request(app.getHttpServer()).put('/api/auth/pin'))
        .send({ pin: '1234' })
        .expect(204);

      const response = await auth(request(app.getHttpServer()).post('/api/auth/pin/verify'))
        .send({ pin: '1234' })
        .expect(200);
      expect(response.body.valid).toBe(true);
    });

    it('rechaza el PIN incorrecto sin romper la sesión', async () => {
      await auth(request(app.getHttpServer()).put('/api/auth/pin'))
        .send({ pin: '1234' })
        .expect(204);

      // 200 con valid:false, no 401: el cuidador sigue autenticado, solo erró el PIN.
      const response = await auth(request(app.getHttpServer()).post('/api/auth/pin/verify'))
        .send({ pin: '9999' })
        .expect(200);
      expect(response.body.valid).toBe(false);
    });

    it('rechaza un PIN que no tenga cuatro dígitos', async () => {
      await auth(request(app.getHttpServer()).put('/api/auth/pin')).send({ pin: '12' }).expect(400);
      await auth(request(app.getHttpServer()).put('/api/auth/pin'))
        .send({ pin: 'abcd' })
        .expect(400);
    });

    it('no deja tocar el PIN sin token', async () => {
      await request(app.getHttpServer()).put('/api/auth/pin').send({ pin: '1234' }).expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/pin/verify')
        .send({ pin: '1234' })
        .expect(401);
    });
  });

  describe('Aislamiento entre cuidadores', () => {
    let tokenAna: string;
    let perfilDeBruno: User;

    beforeEach(async () => {
      const ana = await registrar('ana@vozaac.local');
      tokenAna = ana.body.accessToken;

      const bruno = await registrar('bruno@vozaac.local');

      const usersRepository = dataSource.getRepository(User);
      await usersRepository.save(
        usersRepository.create({ name: 'Hija de Ana', caregiverId: ana.body.caregiver.id }),
      );
      perfilDeBruno = await usersRepository.save(
        usersRepository.create({ name: 'Hijo de Bruno', caregiverId: bruno.body.caregiver.id }),
      );
    });

    it('lista únicamente los perfiles propios', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenAna}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Hija de Ana');
    });

    it('devuelve 404 —y no 403— al pedir el perfil de otro cuidador', async () => {
      // 403 confirmaría que el id existe; 404 no filtra ni siquiera eso.
      await request(app.getHttpServer())
        .get(`/api/users/${perfilDeBruno.id}`)
        .set('Authorization', `Bearer ${tokenAna}`)
        .expect(404);
    });

    it('no lista perfiles sin token', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });

    it('incluye la edad calculada en el perfil', async () => {
      const usersRepository = dataSource.getRepository(User);
      const { body: ana } = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenAna}`);

      await usersRepository.save(
        usersRepository.create({ name: 'Con fecha', caregiverId: ana.id, birthDate: '2018-06-15' }),
      );

      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenAna}`)
        .expect(200);

      const perfil = response.body.find((p: { name: string }) => p.name === 'Con fecha');
      // La edad se deriva, así que se compara contra el mismo cálculo del getter
      // en vez de un número fijo que quedaría viejo con el correr de los años.
      const nacimiento = new Date('2018-06-15');
      const hoy = new Date();
      let esperada = hoy.getFullYear() - nacimiento.getFullYear();
      const diferenciaDeMes = hoy.getMonth() - nacimiento.getMonth();
      if (diferenciaDeMes < 0 || (diferenciaDeMes === 0 && hoy.getDate() < nacimiento.getDate())) {
        esperada -= 1;
      }
      expect(perfil.age).toBe(esperada);
    });
  });
});
