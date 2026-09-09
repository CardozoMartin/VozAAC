import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PictogramSource } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { BoardsModule } from '../src/boards/boards.module';
import { AccessibilityModule } from '../src/accessibility/accessibility.module';
import { Board } from '../src/boards/entities/board.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../src/accessibility/entities/accessibility-settings.entity';
import { STARTER_PICTOGRAM_COUNT, STARTER_VOCABULARY } from '../src/boards/starter-vocabulary';
import { TEST_ENTITIES } from './test-datasource';

/**
 * E2E de la creación de perfiles.
 *
 * Cierra el arranque: hasta ahora un cuidador se registraba y quedaba con el
 * selector vacío, sin forma de crear el perfil de su hijo/a desde la app. Lo
 * que más se verifica acá es que un perfil nuevo nazca usable —tablero,
 * vocabulario y configuración—, porque un chico/a frente a una grilla vacía no
 * puede comunicar nada y no tiene cómo arreglarlo.
 */
describe('Perfiles (e2e)', () => {
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

  /** Registra un cuidador y devuelve su token. */
  async function registrar(email: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName: 'Cuidador' });
    return body.accessToken;
  }

  const crearPerfil = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('POST /api/users', () => {
    it('crea el perfil y lo devuelve', async () => {
      const token = await registrar('alta@vozaac.local');

      const response = await crearPerfil(token, {
        name: 'Mateo',
        birthDate: '2018-05-14',
      }).expect(201);

      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.name).toBe('Mateo');
    });

    it('cuelga el perfil del cuidador del token', async () => {
      const token = await registrar('duenio@vozaac.local');

      const creado = await crearPerfil(token, { name: 'Mateo' });

      const listado = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listado.body).toHaveLength(1);
      expect(listado.body[0].id).toBe(creado.body.id);
    });

    it('deja el perfil listo para usar: tablero, vocabulario y configuración', async () => {
      const token = await registrar('completo@vozaac.local');

      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });

      // El chico/a tiene que poder comunicar algo apenas se crea el perfil.
      const tablero = await request(app.getHttpServer())
        .get(`/api/users/${perfil.id}/boards/default`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(tablero.body.isDefault).toBe(true);
      expect(tablero.body.categories).toHaveLength(STARTER_VOCABULARY.length);

      const pictogramas = tablero.body.categories.flatMap(
        (categoria: { pictograms: unknown[] }) => categoria.pictograms,
      );
      expect(pictogramas).toHaveLength(STARTER_PICTOGRAM_COUNT);
    });

    it('respeta el orden de las categorías del vocabulario inicial', async () => {
      const token = await registrar('orden@vozaac.local');

      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });
      const tablero = await request(app.getHttpServer())
        .get(`/api/users/${perfil.id}/boards/default`)
        .set('Authorization', `Bearer ${token}`);

      // Necesidades va primera a propósito: pedir agua, el baño o avisar un
      // dolor es lo que más urge poder decir.
      expect(tablero.body.categories[0].name).toBe('Necesidades');
    });

    it('marca los pictogramas iniciales como de ARASAAC, con su id', async () => {
      const token = await registrar('fuente@vozaac.local');

      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });
      const tablero = await request(app.getHttpServer())
        .get(`/api/users/${perfil.id}/boards/default`)
        .set('Authorization', `Bearer ${token}`);

      const primero = tablero.body.categories[0].pictograms[0];
      expect(primero.source).toBe(PictogramSource.ARASAAC);
      expect(primero.arasaacId).toEqual(expect.any(Number));
      // La imagen se referencia en el CDN, no se copia.
      expect(primero.imageUrl).toContain('static.arasaac.org');
    });

    it('crea la configuración de accesibilidad con los valores por defecto', async () => {
      const token = await registrar('config@vozaac.local');

      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });

      const settings = await dataSource
        .getRepository(AccessibilitySettings)
        .findOne({ where: { userId: perfil.id } });

      expect(settings).not.toBeNull();
    });

    it('acepta un perfil sin fecha de nacimiento', async () => {
      const token = await registrar('sinfecha@vozaac.local');

      // Se puede querer armar el tablero antes de tener el dato a mano.
      const response = await crearPerfil(token, { name: 'Mateo' }).expect(201);

      expect(response.body.birthDate).toBeNull();
    });

    it('rechaza un perfil sin nombre', async () => {
      const token = await registrar('sinnombre@vozaac.local');

      await crearPerfil(token, {}).expect(400);
    });

    it('rechaza una fecha con formato inválido', async () => {
      const token = await registrar('fechamala@vozaac.local');

      await crearPerfil(token, { name: 'Mateo', birthDate: '14-05-2018' }).expect(400);
    });

    it('no deja elegir de qué cuidador cuelga el perfil', async () => {
      const token = await registrar('ajeno@vozaac.local');
      const otroToken = await registrar('victima@vozaac.local');

      const { body: victima } = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${otroToken}`);

      // El cuidador sale del token; mandarlo en el cuerpo tiene que fallar y
      // no crear un perfil colgado de la cuenta de otra persona.
      await crearPerfil(token, { name: 'Mateo', caregiverId: victima.id }).expect(400);
    });

    it('no deja crear un perfil sin token', async () => {
      await request(app.getHttpServer()).post('/api/users').send({ name: 'Mateo' }).expect(401);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('renombra el perfil', async () => {
      const token = await registrar('editar@vozaac.local');
      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });

      const response = await request(app.getHttpServer())
        .patch(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Mateo Cardozo' })
        .expect(200);

      expect(response.body.name).toBe('Mateo Cardozo');
    });

    it('no deja editar el perfil de otro cuidador', async () => {
      const propio = await registrar('propio-edit@vozaac.local');
      const ajeno = await registrar('ajeno-edit@vozaac.local');
      const { body: perfil } = await crearPerfil(ajeno, { name: 'Mateo' });

      // 404 y no 403: un 403 confirmaría que ese perfil existe.
      await request(app.getHttpServer())
        .patch(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${propio}`)
        .send({ name: 'Cambiado' })
        .expect(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('borra el perfil con todo su contenido', async () => {
      const token = await registrar('borrar@vozaac.local');
      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });

      await request(app.getHttpServer())
        .delete(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Si una familia pide que se borren los datos de su hijo/a, no puede
      // quedar el tablero ni el vocabulario dando vueltas.
      expect(await dataSource.getRepository(Board).count()).toBe(0);
      expect(await dataSource.getRepository(Category).count()).toBe(0);
      expect(await dataSource.getRepository(Pictogram).count()).toBe(0);
      expect(await dataSource.getRepository(AccessibilitySettings).count()).toBe(0);
    });

    it('no deja borrar el perfil de otro cuidador', async () => {
      const propio = await registrar('propio-del@vozaac.local');
      const ajeno = await registrar('ajeno-del@vozaac.local');
      const { body: perfil } = await crearPerfil(ajeno, { name: 'Mateo' });

      await request(app.getHttpServer())
        .delete(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${propio}`)
        .expect(404);

      expect(await dataSource.getRepository(Board).count()).toBe(1);
    });

    it('devuelve 404 al borrar algo que ya no existe', async () => {
      const token = await registrar('doble@vozaac.local');
      const { body: perfil } = await crearPerfil(token, { name: 'Mateo' });

      await request(app.getHttpServer())
        .delete(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/users/${perfil.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
