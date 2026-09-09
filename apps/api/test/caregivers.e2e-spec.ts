import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { INVITE_CODE } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { BoardsModule } from '../src/boards/boards.module';
import { CaregiverInvite } from '../src/users/entities/caregiver-invite.entity';
import { ProfileCaregiver } from '../src/users/entities/profile-caregiver.entity';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E de varios responsables por chico/a (Módulo 9, paso 3).
 *
 * Lo que hay que demostrar es que la madre y el padre —cuentas distintas, cada
 * uno con su email y su contraseña— ven y editan el mismo tablero, y que nadie
 * más lo ve. Eso último sigue siendo la regla de privacidad central: son datos
 * de salud de menores.
 */
describe('Responsables de un chico/a (e2e)', () => {
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
        BoardsModule,
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

  /** Registra un cuidador y devuelve su token e id. */
  async function registrar(email: string, fullName = 'Responsable') {
    const { body } = await request(server())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName })
      .expect(201);
    return { token: body.accessToken as string, id: body.caregiver.id as string };
  }

  /** Madre con un perfil creado, el punto de partida de casi todos los casos. */
  async function madreConPerfil() {
    const madre = await registrar('madre@vozaac.local', 'Madre de Mía');
    const { body: perfil } = await request(server())
      .post('/api/users')
      .set('Authorization', `Bearer ${madre.token}`)
      .send({ name: 'Mía', relationship: 'Mamá' })
      .expect(201);

    return { madre, userId: perfil.id as string };
  }

  /** Genera una invitación y la canjea con la cuenta indicada. */
  async function invitarY_aceptar(
    userId: string,
    tokenDeQuienInvita: string,
    tokenDelInvitado: string,
    relationship?: string,
  ) {
    const { body: invite } = await request(server())
      .post(`/api/users/${userId}/invites`)
      .set('Authorization', `Bearer ${tokenDeQuienInvita}`)
      .send(relationship ? { relationship } : {})
      .expect(201);

    await request(server())
      .post('/api/invites/accept')
      .set('Authorization', `Bearer ${tokenDelInvitado}`)
      .send({ code: invite.code })
      .expect(200);

    return invite;
  }

  describe('Alta del perfil', () => {
    /** Sin esta fila, quien crea el perfil no vería al chico/a que dio de alta. */
    it('deja a quien crea el perfil como su primer responsable', async () => {
      const { madre, userId } = await madreConPerfil();

      const response = await request(server())
        .get(`/api/users/${userId}/caregivers`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].caregiverId).toBe(madre.id);
      expect(response.body[0].relationship).toBe('Mamá');
      expect(response.body[0].isSelf).toBe(true);
    });
  });

  describe('POST /api/users/:id/invites', () => {
    it('genera un código con el nombre del chico/a', async () => {
      const { madre, userId } = await madreConPerfil();

      const response = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ relationship: 'Papá' })
        .expect(201);

      expect(response.body.code).toHaveLength(INVITE_CODE.length);
      expect(response.body.profileName).toBe('Mía');
      expect(response.body.relationship).toBe('Papá');
    });

    it('no deja invitar a un perfil del que no se es responsable', async () => {
      const { userId } = await madreConPerfil();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .send({})
        .expect(404);
    });
  });

  describe('POST /api/invites/accept', () => {
    /** El caso que motiva todo el paso: madre y padre, cuentas distintas. */
    it('suma al padre, que pasa a ver al mismo chico/a', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local', 'Padre de Mía');

      await invitarY_aceptar(userId, madre.token, padre.token, 'Papá');

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(200);

      expect(perfiles.body).toHaveLength(1);
      expect(perfiles.body[0].id).toBe(userId);
      expect(perfiles.body[0].name).toBe('Mía');
    });

    it('devuelve el nombre del chico/a al aceptar', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);

      const response = await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${padre.token}`)
        .send({ code: invite.code })
        .expect(200);

      expect(response.body.profileName).toBe('Mía');
      expect(response.body.userId).toBe(userId);
    });

    /** El código se dicta o se manda por mensaje: el formato no puede importar. */
    it('acepta el código en minúsculas y con espacios', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);
      const tipeado = `${invite.code.slice(0, 3)} ${invite.code.slice(3)}`.toLowerCase();

      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${padre.token}`)
        .send({ code: tipeado })
        .expect(200);
    });

    it('una invitación sirve una sola vez', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      const abuela = await registrar('abuela@vozaac.local');

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);

      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${padre.token}`)
        .send({ code: invite.code })
        .expect(200);

      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${abuela.token}`)
        .send({ code: invite.code })
        .expect(401);
    });

    it('rechaza una invitación vencida', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);

      await dataSource
        .getRepository(CaregiverInvite)
        .update({ code: invite.code }, { expiresAt: new Date(Date.now() - 1000) });

      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${padre.token}`)
        .send({ code: invite.code })
        .expect(401);
    });

    it('quema la invitación tras los intentos fallidos permitidos', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);

      await dataSource
        .getRepository(CaregiverInvite)
        .update({ code: invite.code }, { failedAttempts: INVITE_CODE.maxAttempts });

      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${padre.token}`)
        .send({ code: invite.code })
        .expect(401);
    });

    it('avisa distinto si ya era responsable', async () => {
      const { madre, userId } = await madreConPerfil();

      const { body: invite } = await request(server())
        .post(`/api/users/${userId}/invites`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({})
        .expect(201);

      // 409 y no 401: no es un código inválido, es que ya está a cargo.
      await request(server())
        .post('/api/invites/accept')
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ code: invite.code })
        .expect(409);
    });

    it('exige estar autenticado: el invitado tiene su propia cuenta', async () => {
      await request(server()).post('/api/invites/accept').send({ code: 'ABC234' }).expect(401);
    });
  });

  describe('Qué puede hacer un responsable sumado', () => {
    /**
     * Todos pueden lo mismo: si el padre no pudiera editar el tablero, la
     * madre tendría que estar disponible cada vez que hay que arreglar algo.
     */
    it('el padre edita el tablero del chico/a', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token);

      const tablero = await request(server())
        .get(`/api/users/${userId}/boards/default`)
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(200);

      expect(tablero.body.categories.length).toBeGreaterThan(0);
    });

    it('el padre puede invitar a un tercero sin pedírselo a la madre', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      const abuela = await registrar('abuela@vozaac.local', 'Abuela');
      await invitarY_aceptar(userId, madre.token, padre.token);

      await invitarY_aceptar(userId, padre.token, abuela.token, 'Abuela');

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${abuela.token}`)
        .expect(200);

      expect(perfiles.body).toHaveLength(1);
    });

    it('lista a los tres responsables con su etiqueta', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      const hermano = await registrar('hermano@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token, 'Papá');
      await invitarY_aceptar(userId, madre.token, hermano.token, 'Hermano');

      const response = await request(server())
        .get(`/api/users/${userId}/caregivers`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      // Ordenado en el test y no esperando el orden de la respuesta: las tres
      // filas se crean en el mismo milisegundo, así que el ORDER BY createdAt
      // no las desempata de forma determinística.
      expect(response.body.map((r: { relationship: string }) => r.relationship).sort()).toEqual([
        'Hermano',
        'Mamá',
        'Papá',
      ]);
    });
  });

  describe('Privacidad', () => {
    /** La regla central del proyecto, que este cambio no puede aflojar. */
    it('alguien que no es responsable no ve el perfil', async () => {
      const { userId } = await madreConPerfil();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(404);

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(200);
      expect(perfiles.body).toEqual([]);
    });

    it('alguien que no es responsable no ve la lista de responsables', async () => {
      const { userId } = await madreConPerfil();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .get(`/api/users/${userId}/caregivers`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(404);
    });

    it('alguien que no es responsable no edita el tablero', async () => {
      const { userId } = await madreConPerfil();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .get(`/api/users/${userId}/boards/default`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(404);
    });
  });

  describe('DELETE /api/users/:id/caregivers/:caregiverId', () => {
    it('quita a un responsable, que deja de ver al chico/a', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token);

      await request(server())
        .delete(`/api/users/${userId}/caregivers/${padre.id}`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(204);

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(200);
      expect(perfiles.body).toEqual([]);
    });

    /**
     * Un perfil sin responsables quedaría inaccesible para todos y sólo se
     * podría recuperar tocando la base a mano.
     */
    it('no deja quitar al único responsable', async () => {
      const { madre, userId } = await madreConPerfil();

      await request(server())
        .delete(`/api/users/${userId}/caregivers/${madre.id}`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(409);
    });

    /** Alguien que deja de estar a cargo puede irse, si queda otro. */
    it('deja que alguien se quite a sí mismo si queda otro', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token);

      await request(server())
        .delete(`/api/users/${userId}/caregivers/${padre.id}`)
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(204);

      const restantes = await dataSource
        .getRepository(ProfileCaregiver)
        .count({ where: { userId } });
      expect(restantes).toBe(1);
    });

    it('un ajeno no puede quitar responsables', async () => {
      const { madre, userId } = await madreConPerfil();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .delete(`/api/users/${userId}/caregivers/${madre.id}`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(404);
    });
  });

  describe('Borrado del perfil', () => {
    it('cualquier responsable puede borrarlo, y desaparece para todos', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token);

      await request(server())
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(204);

      const perfiles = await request(server())
        .get('/api/users')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);
      expect(perfiles.body).toEqual([]);
    });

    it('el borrado se lleva las filas de responsables', async () => {
      const { madre, userId } = await madreConPerfil();
      const padre = await registrar('padre@vozaac.local');
      await invitarY_aceptar(userId, madre.token, padre.token);

      await request(server())
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(204);

      const restantes = await dataSource
        .getRepository(ProfileCaregiver)
        .count({ where: { userId } });
      expect(restantes).toBe(0);
    });
  });
});
