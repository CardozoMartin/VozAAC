import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { GridSize, UsageEventType } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { BoardsModule } from '../src/boards/boards.module';
import { AccessibilityModule } from '../src/accessibility/accessibility.module';
import { UsageModule } from '../src/usage/usage.module';
import { User } from '../src/users/entities/user.entity';
import { Board } from '../src/boards/entities/board.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { UsageLog } from '../src/usage/entities/usage-log.entity';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E de los endpoints que alimentan el comunicador (Módulo 3).
 *
 * Igual que en el Módulo 2, lo central no es sólo que devuelvan datos sino que
 * un cuidador no alcance los de otro.
 */
describe('Comunicador (e2e)', () => {
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
        AccessibilityModule,
        UsageModule,
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

  /** Cuidador con un perfil, un tablero, dos categorías y tres pictogramas. */
  async function crearEscenario(email: string) {
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName: 'Cuidador' });

    const user = await dataSource
      .getRepository(User)
      .save({ name: 'Perfil', caregiverId: body.caregiver.id } as User);

    const board = await dataSource
      .getRepository(Board)
      .save({ name: 'Casa', userId: user.id, isDefault: true } as Board);

    const comidas = await dataSource
      .getRepository(Category)
      .save({ name: 'Comidas', boardId: board.id, order: 0, color: '#E8A33D' } as Category);
    const acciones = await dataSource
      .getRepository(Category)
      .save({ name: 'Acciones', boardId: board.id, order: 1, color: '#4A90D9' } as Category);

    await dataSource.getRepository(Pictogram).save([
      { text: 'agua', imageUrl: 'agua.png', categoryId: comidas.id, order: 1 },
      { text: 'pan', imageUrl: 'pan.png', categoryId: comidas.id, order: 0 },
      { text: 'quiero', imageUrl: 'quiero.png', categoryId: acciones.id, order: 0 },
    ] as Pictogram[]);

    return { token: body.accessToken as string, user, board };
  }

  describe('GET /api/users/:userId/boards/default', () => {
    it('devuelve el tablero con categorías y pictogramas ordenados', async () => {
      const { token, user } = await crearEscenario('tablero@vozaac.local');

      const response = await request(app.getHttpServer())
        .get(`/api/users/${user.id}/boards/default`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.name).toBe('Casa');
      // Las categorías salen por su campo order, no por fecha de creación.
      expect(response.body.categories.map((c: { name: string }) => c.name)).toEqual([
        'Comidas',
        'Acciones',
      ]);
      // Y los pictogramas también: 'pan' tiene order 0 aunque se creó después.
      expect(response.body.categories[0].pictograms.map((p: { text: string }) => p.text)).toEqual([
        'pan',
        'agua',
      ]);
    });

    it('avisa cuando el perfil todavía no tiene tableros', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'sintablero@vozaac.local', password: 'contrasena-valida', fullName: 'C' });
      const user = await dataSource
        .getRepository(User)
        .save({ name: 'Sin tablero', caregiverId: body.caregiver.id } as User);

      await request(app.getHttpServer())
        .get(`/api/users/${user.id}/boards/default`)
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(404);
    });

    it('no deja leer el tablero de un perfil ajeno', async () => {
      const ajeno = await crearEscenario('ajeno@vozaac.local');
      const propio = await crearEscenario('propio@vozaac.local');

      await request(app.getHttpServer())
        .get(`/api/users/${ajeno.user.id}/boards/default`)
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(404);
    });

    it('rechaza la request sin token', async () => {
      const { user } = await crearEscenario('sintoken@vozaac.local');
      await request(app.getHttpServer()).get(`/api/users/${user.id}/boards/default`).expect(401);
    });
  });

  describe('GET /api/users/:userId/boards/:boardId', () => {
    it('no deja pedir un tablero de otro perfil pasando el propio userId', async () => {
      const ajeno = await crearEscenario('ajeno2@vozaac.local');
      const propio = await crearEscenario('propio2@vozaac.local');

      // El perfil es del cuidador, pero el tablero no: sigue siendo 404.
      await request(app.getHttpServer())
        .get(`/api/users/${propio.user.id}/boards/${ajeno.board.id}`)
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(404);
    });
  });

  describe('GET /api/users/:userId/accessibility', () => {
    it('crea la configuración con los valores por defecto la primera vez', async () => {
      const { token, user } = await crearEscenario('acc@vozaac.local');

      const response = await request(app.getHttpServer())
        .get(`/api/users/${user.id}/accessibility`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.gridSize).toBe(GridSize.GRID_2X3);
      expect(response.body.tremorFilterEnabled).toBe(false);
      expect(response.body.speechRate).toBe(1);
    });

    it('devuelve la misma configuración en llamadas sucesivas', async () => {
      const { token, user } = await crearEscenario('acc2@vozaac.local');
      const url = `/api/users/${user.id}/accessibility`;

      const primera = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`);
      const segunda = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`);

      // No debe crear una fila nueva en cada lectura.
      expect(segunda.body.id).toBe(primera.body.id);
    });

    it('no expone la configuración de un perfil ajeno', async () => {
      const ajeno = await crearEscenario('acc3@vozaac.local');
      const propio = await crearEscenario('acc4@vozaac.local');

      await request(app.getHttpServer())
        .get(`/api/users/${ajeno.user.id}/accessibility`)
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(404);
    });
  });

  describe('POST /api/users/:userId/usage', () => {
    it('registra un evento de toque', async () => {
      const { token, user } = await crearEscenario('uso@vozaac.local');

      await request(app.getHttpServer())
        .post(`/api/users/${user.id}/usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventType: UsageEventType.PICTOGRAM_TAP,
          pictogramTextSnapshot: 'agua',
          occurredAt: new Date().toISOString(),
        })
        .expect(201);

      const logs = await dataSource.getRepository(UsageLog).find({ where: { userId: user.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].pictogramTextSnapshot).toBe('agua');
    });

    it('registra un lote completo', async () => {
      const { token, user } = await crearEscenario('uso2@vozaac.local');

      const response = await request(app.getHttpServer())
        .post(`/api/users/${user.id}/usage/batch`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          events: [
            {
              eventType: UsageEventType.PICTOGRAM_TAP,
              pictogramTextSnapshot: 'pan',
              occurredAt: new Date().toISOString(),
            },
            {
              eventType: UsageEventType.PHRASE_SPOKEN,
              phraseText: 'quiero pan',
              occurredAt: new Date().toISOString(),
            },
          ],
        })
        .expect(201);

      expect(response.body.registered).toBe(2);
    });

    it('conserva el momento del uso que informa el dispositivo', async () => {
      const { token, user } = await crearEscenario('uso3@vozaac.local');
      // Con el modo offline el evento puede llegar mucho después de ocurrido.
      const ocurrido = '2026-03-01T10:30:00.000Z';

      await request(app.getHttpServer())
        .post(`/api/users/${user.id}/usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: UsageEventType.PHRASE_CLEARED, occurredAt: ocurrido })
        .expect(201);

      const [log] = await dataSource.getRepository(UsageLog).find({ where: { userId: user.id } });
      expect(new Date(log.occurredAt).toISOString()).toBe(ocurrido);
    });

    it('rechaza un tipo de evento inventado', async () => {
      const { token, user } = await crearEscenario('uso4@vozaac.local');

      await request(app.getHttpServer())
        .post(`/api/users/${user.id}/usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: 'inventado', occurredAt: new Date().toISOString() })
        .expect(400);
    });

    it('no deja registrar uso en el perfil de otro cuidador', async () => {
      const ajeno = await crearEscenario('uso5@vozaac.local');
      const propio = await crearEscenario('uso6@vozaac.local');

      await request(app.getHttpServer())
        .post(`/api/users/${ajeno.user.id}/usage`)
        .set('Authorization', `Bearer ${propio.token}`)
        .send({ eventType: UsageEventType.PICTOGRAM_TAP, occurredAt: new Date().toISOString() })
        .expect(404);

      const logs = await dataSource
        .getRepository(UsageLog)
        .find({ where: { userId: ajeno.user.id } });
      expect(logs).toHaveLength(0);
    });
  });
});
