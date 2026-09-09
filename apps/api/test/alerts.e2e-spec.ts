import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { BoardsModule } from '../src/boards/boards.module';
import { PictogramsModule } from '../src/pictograms/pictograms.module';
import { AlertsModule } from '../src/alerts/alerts.module';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E de los pictogramas urgentes y las alertas (Módulo 9, paso 4).
 *
 * El circuito completo: el chico/a toca "me duele", el aviso queda guardado, y
 * les aparece a todos sus responsables hasta que alguno lo atiende. Es lo que
 * le da sentido a los pasos 2 y 3 — la sesión que no se cierra en el celular
 * del chico/a, y los varios responsables que reciben el aviso.
 */
describe('Alertas de pictogramas urgentes (e2e)', () => {
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
        PictogramsModule,
        AlertsModule,
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

  async function registrar(email: string, fullName = 'Responsable') {
    const { body } = await request(server())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName })
      .expect(201);
    return { token: body.accessToken as string, id: body.caregiver.id as string };
  }

  /**
   * Madre con un perfil y un pictograma urgente listo para tocar.
   *
   * El perfil nace con vocabulario inicial, así que se toma una categoría de
   * ahí y se le marca un pictograma como urgente, que es lo que haría el
   * terapeuta desde el editor.
   */
  async function escenario() {
    const madre = await registrar('madre@vozaac.local', 'Madre de Mía');
    const { body: perfil } = await request(server())
      .post('/api/users')
      .set('Authorization', `Bearer ${madre.token}`)
      .send({ name: 'Mía', relationship: 'Mamá' })
      .expect(201);

    const { body: tablero } = await request(server())
      .get(`/api/users/${perfil.id}/boards/default`)
      .set('Authorization', `Bearer ${madre.token}`)
      .expect(200);

    const categoriaId = tablero.categories[0].id as string;

    const { body: urgente } = await request(server())
      .post('/api/pictograms')
      .set('Authorization', `Bearer ${madre.token}`)
      .send({
        text: 'me duele',
        imageUrl: 'duele.png',
        categoryId: categoriaId,
        isUrgent: true,
      })
      .expect(201);

    const { body: comun } = await request(server())
      .post('/api/pictograms')
      .set('Authorization', `Bearer ${madre.token}`)
      .send({ text: 'jugar', imageUrl: 'jugar.png', categoryId: categoriaId })
      .expect(201);

    return { madre, userId: perfil.id as string, urgente, comun };
  }

  /** Suma un responsable al perfil por el circuito de invitación normal. */
  async function sumarResponsable(userId: string, tokenDeQuienInvita: string, email: string) {
    const nuevo = await registrar(email, 'Padre de Mía');
    const { body: invite } = await request(server())
      .post(`/api/users/${userId}/invites`)
      .set('Authorization', `Bearer ${tokenDeQuienInvita}`)
      .send({ relationship: 'Papá' })
      .expect(201);

    await request(server())
      .post('/api/invites/accept')
      .set('Authorization', `Bearer ${nuevo.token}`)
      .send({ code: invite.code })
      .expect(200);

    return nuevo;
  }

  describe('Marcar un pictograma como urgente', () => {
    it('guarda la marca al crearlo', async () => {
      const { urgente, comun } = await escenario();

      expect(urgente.isUrgent).toBe(true);
      // Por defecto nada avisa: el terapeuta marca a mano el puñado que
      // corresponde, o las notificaciones se vuelven ruido.
      expect(comun.isUrgent).toBe(false);
    });

    /**
     * Un tablero nuevo trae "Ayuda" y "Dolor" ya marcados: son los dos casos
     * que ninguna familia querría tener que descubrir configurando.
     */
    it('el vocabulario inicial trae marcados Ayuda y Dolor', async () => {
      const { madre, userId } = await escenario();

      const { body: tablero } = await request(server())
        .get(`/api/users/${userId}/boards/default`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      const urgentes = tablero.categories
        .flatMap((c: { pictograms: { text: string; isUrgent: boolean }[] }) => c.pictograms)
        .filter((p: { isUrgent: boolean }) => p.isUrgent)
        .map((p: { text: string }) => p.text)
        .sort();

      // "me duele" lo agrega el escenario; los otros dos vienen de fábrica.
      expect(urgentes).toEqual(['Ayuda', 'Dolor', 'me duele']);
    });

    it('deja marcar uno existente desde el editor', async () => {
      const { madre, comun } = await escenario();

      const response = await request(server())
        .patch(`/api/pictograms/${comun.id}`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ isUrgent: true })
        .expect(200);

      expect(response.body.isUrgent).toBe(true);
    });
  });

  describe('POST /api/users/:userId/alerts', () => {
    it('registra el aviso con el texto y la imagen del pictograma', async () => {
      const { madre, userId, urgente } = await escenario();

      const response = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      expect(response.body.pictogramText).toBe('me duele');
      expect(response.body.pictogramImageUrl).toBe('duele.png');
      expect(response.body.profileName).toBe('Mía');
      expect(response.body.acknowledgedAt).toBeNull();
    });

    /**
     * Que la API exija la marca evita que un error de la app convierta
     * cualquier toque en una notificación a las 3 AM.
     */
    it('rechaza avisar por un pictograma que no está marcado como urgente', async () => {
      const { madre, userId, comun } = await escenario();

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: comun.id })
        .expect(400);
    });

    /**
     * El aviso puede llegar tarde —sin señal, o con la app cerrada— y lo que
     * importa es cuándo lo tocó el chico/a, no cuándo se enteró el servidor.
     */
    it('conserva el momento del toque que informa el dispositivo', async () => {
      const { madre, userId, urgente } = await escenario();
      const cuando = '2026-03-01T02:45:00.000Z';

      const response = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id, occurredAt: cuando })
        .expect(201);

      expect(new Date(response.body.occurredAt).toISOString()).toBe(cuando);
    });

    it('no deja avisar en el perfil de otro', async () => {
      const { userId, urgente } = await escenario();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .send({ pictogramId: urgente.id })
        .expect(404);
    });

    it('rechaza un pictograma de otro tablero', async () => {
      const { madre, userId } = await escenario();
      const otra = await escenarioDeOtraFamilia();

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: otra.urgenteId })
        .expect(404);
    });
  });

  describe('GET /api/alerts', () => {
    /** El caso que da sentido al paso 3: el aviso le llega a los dos. */
    it('les llega a todos los responsables del chico/a', async () => {
      const { madre, userId, urgente } = await escenario();
      const padre = await sumarResponsable(userId, madre.token, 'padre@vozaac.local');

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      for (const token of [madre.token, padre.token]) {
        const response = await request(server())
          .get('/api/alerts')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].pictogramText).toBe('me duele');
      }
    });

    it('no le llega a quien no es responsable', async () => {
      const { madre, userId, urgente } = await escenario();
      const ajeno = await registrar('ajeno@vozaac.local');

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      const response = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('ordena de la más nueva a la más vieja', async () => {
      const { madre, userId, urgente } = await escenario();

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id, occurredAt: '2026-03-01T02:00:00.000Z' })
        .expect(201);
      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id, occurredAt: '2026-03-01T05:00:00.000Z' })
        .expect(201);

      const response = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      expect(new Date(response.body[0].occurredAt).toISOString()).toBe('2026-03-01T05:00:00.000Z');
    });

    /** Es lo que consulta la app cada veinte segundos para decidir si avisa. */
    it('filtra las pendientes con ?pending=true', async () => {
      const { madre, userId, urgente } = await escenario();

      const { body: primera } = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);
      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      await request(server())
        .post(`/api/alerts/${primera.id}/acknowledge`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      const pendientes = await request(server())
        .get('/api/alerts?pending=true')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);
      expect(pendientes.body).toHaveLength(1);

      const todas = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);
      expect(todas.body).toHaveLength(2);
    });

    /**
     * Un responsable con dos hijos quiere una sola bandeja: cuando suena, lo
     * primero que necesita saber es qué pasó, y recién después de cuál.
     */
    it('junta en una bandeja las alertas de todos sus chicos/as', async () => {
      const { madre, userId, urgente } = await escenario();

      const { body: segundo } = await request(server())
        .post('/api/users')
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ name: 'Tomás' })
        .expect(201);
      const { body: tablero } = await request(server())
        .get(`/api/users/${segundo.id}/boards/default`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);
      const { body: urgenteDeTomas } = await request(server())
        .post('/api/pictograms')
        .set('Authorization', `Bearer ${madre.token}`)
        .send({
          text: 'me duele',
          imageUrl: 'duele.png',
          categoryId: tablero.categories[0].id,
          isUrgent: true,
        })
        .expect(201);

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);
      await request(server())
        .post(`/api/users/${segundo.id}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgenteDeTomas.id })
        .expect(201);

      const response = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((a: { profileName: string }) => a.profileName).sort()).toEqual([
        'Mía',
        'Tomás',
      ]);
    });

    /**
     * El texto se copia al emitir: si el terapeuta renombra el pictograma, la
     * alerta tiene que seguir diciendo lo que el chico/a quiso decir.
     */
    it('conserva el texto aunque después borren el pictograma', async () => {
      const { madre, userId, urgente } = await escenario();

      await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      await request(server())
        .delete(`/api/pictograms/${urgente.id}`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(204);

      const response = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].pictogramText).toBe('me duele');
      expect(response.body[0].pictogramId).toBeNull();
    });
  });

  describe('POST /api/alerts/:id/acknowledge', () => {
    /**
     * Con varios responsables importa: si la madre ya fue a ver al chico/a, el
     * padre necesita saberlo para no salir corriendo también.
     */
    it('el otro responsable ve quién la atendió', async () => {
      const { madre, userId, urgente } = await escenario();
      const padre = await sumarResponsable(userId, madre.token, 'padre@vozaac.local');

      const { body: alerta } = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      await request(server())
        .post(`/api/alerts/${alerta.id}/acknowledge`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);

      const response = await request(server())
        .get('/api/alerts')
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(200);

      expect(response.body[0].acknowledgedByName).toBe('Madre de Mía');
      expect(response.body[0].acknowledgedAt).not.toBeNull();
    });

    /** Quien la atendió primero es el dato que sirve; no se pisa. */
    it('no reescribe quién la atendió primero', async () => {
      const { madre, userId, urgente } = await escenario();
      const padre = await sumarResponsable(userId, madre.token, 'padre@vozaac.local');

      const { body: alerta } = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      await request(server())
        .post(`/api/alerts/${alerta.id}/acknowledge`)
        .set('Authorization', `Bearer ${madre.token}`)
        .expect(200);
      const segunda = await request(server())
        .post(`/api/alerts/${alerta.id}/acknowledge`)
        .set('Authorization', `Bearer ${padre.token}`)
        .expect(200);

      expect(segunda.body.acknowledgedByName).toBe('Madre de Mía');
    });

    it('un ajeno no puede atender la alerta', async () => {
      const { madre, userId, urgente } = await escenario();
      const ajeno = await registrar('ajeno@vozaac.local');

      const { body: alerta } = await request(server())
        .post(`/api/users/${userId}/alerts`)
        .set('Authorization', `Bearer ${madre.token}`)
        .send({ pictogramId: urgente.id })
        .expect(201);

      await request(server())
        .post(`/api/alerts/${alerta.id}/acknowledge`)
        .set('Authorization', `Bearer ${ajeno.token}`)
        .expect(404);
    });
  });

  /** Segunda familia, para los casos de aislamiento. */
  async function escenarioDeOtraFamilia() {
    const otro = await registrar('otra@vozaac.local', 'Otra familia');
    const { body: perfil } = await request(server())
      .post('/api/users')
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ name: 'Otro chico' })
      .expect(201);
    const { body: tablero } = await request(server())
      .get(`/api/users/${perfil.id}/boards/default`)
      .set('Authorization', `Bearer ${otro.token}`)
      .expect(200);

    const urgente = await dataSource.getRepository(Pictogram).save({
      text: 'me duele',
      imageUrl: 'duele.png',
      categoryId: tablero.categories[0].id,
      isUrgent: true,
      order: 99,
    } as Pictogram);

    return { urgenteId: urgente.id };
  }
});
