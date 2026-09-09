import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PictogramSource } from '@vozaac/shared';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { CategoriesModule } from '../src/categories/categories.module';
import { PictogramsModule } from '../src/pictograms/pictograms.module';
import { Board } from '../src/boards/entities/board.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { TEST_ENTITIES } from './test-datasource';
import { crearPerfil } from './create-profile';

/**
 * E2E del editor del modo terapeuta (Módulo 4).
 *
 * Además del CRUD, lo que se verifica acá es que un cuidador no pueda tocar el
 * vocabulario de otro: el editor escribe, así que un agujero de aislamiento
 * sería peor que en las pantallas de lectura.
 */
describe('Editor de pictogramas (e2e)', () => {
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
        CategoriesModule,
        PictogramsModule,
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

  /** Cuidador con perfil, tablero y una categoría con un pictograma. */
  async function crearEscenario(email: string) {
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'contrasena-valida', fullName: 'Cuidador' });

    const user = await crearPerfil(dataSource, body.caregiver.id);
    const board = await dataSource
      .getRepository(Board)
      .save({ name: 'Casa', userId: user.id, isDefault: true } as Board);
    const category = await dataSource
      .getRepository(Category)
      .save({ name: 'Comidas', boardId: board.id, order: 0 } as Category);
    const pictogram = await dataSource
      .getRepository(Pictogram)
      .save({ text: 'agua', imageUrl: 'agua.png', categoryId: category.id, order: 0 } as Pictogram);

    return { token: body.accessToken as string, user, board, category, pictogram };
  }

  describe('Categorías', () => {
    it('crea una categoría al final del tablero', async () => {
      const { token, board } = await crearEscenario('cat1@vozaac.local');

      const response = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acciones', boardId: board.id, color: '#4A90D9' })
        .expect(201);

      expect(response.body.name).toBe('Acciones');
      // Ya existía "Comidas" en order 0.
      expect(response.body.order).toBe(1);
    });

    it('rechaza un nombre repetido en el mismo tablero', async () => {
      const { token, board } = await crearEscenario('cat2@vozaac.local');

      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Comidas', boardId: board.id })
        .expect(409);
    });

    it('rechaza un color que no sea hexadecimal', async () => {
      const { token, board } = await crearEscenario('cat3@vozaac.local');

      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acciones', boardId: board.id, color: 'azul' })
        .expect(400);
    });

    it('renombra una categoría', async () => {
      const { token, category } = await crearEscenario('cat4@vozaac.local');

      const response = await request(app.getHttpServer())
        .patch(`/api/categories/${category.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alimentos' })
        .expect(200);

      expect(response.body.name).toBe('Alimentos');
    });

    it('borra la categoría y sus pictogramas en cascada', async () => {
      const { token, category } = await crearEscenario('cat5@vozaac.local');

      await request(app.getHttpServer())
        .delete(`/api/categories/${category.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const quedan = await dataSource
        .getRepository(Pictogram)
        .find({ where: { categoryId: category.id } });
      expect(quedan).toHaveLength(0);
    });

    it('reordena los tabs del tablero', async () => {
      const { token, board, category } = await crearEscenario('cat6@vozaac.local');
      const segunda = await dataSource
        .getRepository(Category)
        .save({ name: 'Acciones', boardId: board.id, order: 1 } as Category);

      await request(app.getHttpServer())
        .patch(`/api/boards/${board.id}/categories/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: [segunda.id, category.id] })
        .expect(200);

      const ordenadas = await dataSource
        .getRepository(Category)
        .find({ where: { boardId: board.id }, order: { order: 'ASC' } });
      expect(ordenadas.map((c) => c.name)).toEqual(['Acciones', 'Comidas']);
    });

    it('no deja crear una categoría en el tablero de otro cuidador', async () => {
      const ajeno = await crearEscenario('cat7@vozaac.local');
      const propio = await crearEscenario('cat8@vozaac.local');

      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${propio.token}`)
        .send({ name: 'Intrusa', boardId: ajeno.board.id })
        .expect(404);
    });

    it('no deja borrar la categoría de otro cuidador', async () => {
      const ajeno = await crearEscenario('cat9@vozaac.local');
      const propio = await crearEscenario('cat10@vozaac.local');

      await request(app.getHttpServer())
        .delete(`/api/categories/${ajeno.category.id}`)
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(404);

      const sigue = await dataSource
        .getRepository(Category)
        .findOne({ where: { id: ajeno.category.id } });
      expect(sigue).not.toBeNull();
    });
  });

  describe('Pictogramas', () => {
    it('crea un pictograma en una categoría', async () => {
      const { token, category } = await crearEscenario('pic1@vozaac.local');

      const response = await request(app.getHttpServer())
        .post('/api/pictograms')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'pan', imageUrl: '/uploads/images/pan.png', categoryId: category.id })
        .expect(201);

      expect(response.body.text).toBe('pan');
      expect(response.body.source).toBe(PictogramSource.CUSTOM);
    });

    it('rechaza repetir el mismo texto en la categoría', async () => {
      const { token, category } = await crearEscenario('pic2@vozaac.local');

      // Ignorando mayúsculas y espacios: "Agua " es el mismo concepto que "agua".
      await request(app.getHttpServer())
        .post('/api/pictograms')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '  Agua ', imageUrl: 'x.png', categoryId: category.id })
        .expect(409);
    });

    it('guarda un pictograma de ARASAAC con su id de origen', async () => {
      const { token, category } = await crearEscenario('pic3@vozaac.local');

      const response = await request(app.getHttpServer())
        .post('/api/pictograms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          text: 'pelota',
          imageUrl: 'https://static.arasaac.org/pictograms/2248/2248_300.png',
          categoryId: category.id,
          source: PictogramSource.ARASAAC,
          arasaacId: 2248,
        })
        .expect(201);

      expect(response.body.arasaacId).toBe(2248);
    });

    it('exige el id de ARASAAC cuando el origen es ARASAAC', async () => {
      const { token, category } = await crearEscenario('pic4@vozaac.local');

      await request(app.getHttpServer())
        .post('/api/pictograms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          text: 'pelota',
          imageUrl: 'x.png',
          categoryId: category.id,
          source: PictogramSource.ARASAAC,
        })
        .expect(400);
    });

    it('edita el texto de un pictograma', async () => {
      const { token, pictogram } = await crearEscenario('pic5@vozaac.local');

      const response = await request(app.getHttpServer())
        .patch(`/api/pictograms/${pictogram.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'agua fría' })
        .expect(200);

      expect(response.body.text).toBe('agua fría');
    });

    it('mueve un pictograma a otra categoría propia', async () => {
      const { token, board, pictogram } = await crearEscenario('pic6@vozaac.local');
      const destino = await dataSource
        .getRepository(Category)
        .save({ name: 'Bebidas', boardId: board.id, order: 1 } as Category);

      const response = await request(app.getHttpServer())
        .patch(`/api/pictograms/${pictogram.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId: destino.id })
        .expect(200);

      expect(response.body.categoryId).toBe(destino.id);
    });

    it('no deja mover un pictograma a una categoría ajena', async () => {
      const ajeno = await crearEscenario('pic7@vozaac.local');
      const propio = await crearEscenario('pic8@vozaac.local');

      await request(app.getHttpServer())
        .patch(`/api/pictograms/${propio.pictogram.id}`)
        .set('Authorization', `Bearer ${propio.token}`)
        .send({ categoryId: ajeno.category.id })
        .expect(404);
    });

    it('borra un pictograma', async () => {
      const { token, pictogram } = await crearEscenario('pic9@vozaac.local');

      await request(app.getHttpServer())
        .delete(`/api/pictograms/${pictogram.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const sigue = await dataSource
        .getRepository(Pictogram)
        .findOne({ where: { id: pictogram.id } });
      expect(sigue).toBeNull();
    });

    it('reordena los pictogramas de una categoría', async () => {
      const { token, category, pictogram } = await crearEscenario('pic10@vozaac.local');
      const segundo = await dataSource
        .getRepository(Pictogram)
        .save({ text: 'pan', imageUrl: 'pan.png', categoryId: category.id, order: 1 } as Pictogram);

      await request(app.getHttpServer())
        .patch(`/api/categories/${category.id}/pictograms/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: [segundo.id, pictogram.id] })
        .expect(200);

      const ordenados = await dataSource
        .getRepository(Pictogram)
        .find({ where: { categoryId: category.id }, order: { order: 'ASC' } });
      expect(ordenados.map((p) => p.text)).toEqual(['pan', 'agua']);
    });

    it('no deja editar el pictograma de otro cuidador', async () => {
      const ajeno = await crearEscenario('pic11@vozaac.local');
      const propio = await crearEscenario('pic12@vozaac.local');

      await request(app.getHttpServer())
        .patch(`/api/pictograms/${ajeno.pictogram.id}`)
        .set('Authorization', `Bearer ${propio.token}`)
        .send({ text: 'intruso' })
        .expect(404);

      const sinCambios = await dataSource
        .getRepository(Pictogram)
        .findOne({ where: { id: ajeno.pictogram.id } });
      expect(sinCambios?.text).toBe('agua');
    });

    it('no deja borrar el pictograma de otro cuidador', async () => {
      const ajeno = await crearEscenario('pic13@vozaac.local');
      const propio = await crearEscenario('pic14@vozaac.local');

      await request(app.getHttpServer())
        .delete(`/api/pictograms/${ajeno.pictogram.id}`)
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(404);
    });

    it('rechaza cualquier operación sin token', async () => {
      const { category } = await crearEscenario('pic15@vozaac.local');

      await request(app.getHttpServer())
        .post('/api/pictograms')
        .send({ text: 'x', imageUrl: 'x.png', categoryId: category.id })
        .expect(401);
    });
  });

  describe('Buscador', () => {
    it('encuentra pictogramas por parte del texto', async () => {
      const { token, category } = await crearEscenario('bus1@vozaac.local');
      await dataSource.getRepository(Pictogram).save({
        text: 'agua caliente',
        imageUrl: 'x.png',
        categoryId: category.id,
        order: 1,
      } as Pictogram);

      const response = await request(app.getHttpServer())
        .get('/api/pictograms/search?q=agua')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.map((p: { text: string }) => p.text).sort()).toEqual([
        'agua',
        'agua caliente',
      ]);
    });

    it('ignora mayúsculas al buscar', async () => {
      const { token } = await crearEscenario('bus2@vozaac.local');

      const response = await request(app.getHttpServer())
        .get('/api/pictograms/search?q=AGUA')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('nunca devuelve pictogramas de otro cuidador', async () => {
      await crearEscenario('bus3@vozaac.local');
      const propio = await crearEscenario('bus4@vozaac.local');

      // Ambos tienen un pictograma "agua"; sólo debe verse el propio.
      const response = await request(app.getHttpServer())
        .get('/api/pictograms/search?q=agua')
        .set('Authorization', `Bearer ${propio.token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].categoryId).toBe(propio.category.id);
    });

    it('devuelve vacío cuando no hay coincidencias', async () => {
      const { token } = await crearEscenario('bus5@vozaac.local');

      const response = await request(app.getHttpServer())
        .get('/api/pictograms/search?q=inexistente')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
