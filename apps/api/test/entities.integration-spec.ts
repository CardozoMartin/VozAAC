import { CaregiverRole, GridSize, PictogramSource, UsageEventType } from '@vozaac/shared';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { createTestDataSource } from './test-datasource';
import { Caregiver } from '../src/caregivers/entities/caregiver.entity';
import { User } from '../src/users/entities/user.entity';
import { Board } from '../src/boards/entities/board.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../src/accessibility/entities/accessibility-settings.entity';
import { UsageLog } from '../src/usage/entities/usage-log.entity';

/**
 * Tests de integración del Módulo 1: verifican contra una base real que las
 * relaciones, las cascadas y los índices únicos se comporten como se declaran
 * en las entidades.
 */
describe('Entidades del modelo de datos', () => {
  let dataSource: DataSource;
  let caregivers: Repository<Caregiver>;
  let users: Repository<User>;
  let boards: Repository<Board>;
  let categories: Repository<Category>;
  let pictograms: Repository<Pictogram>;
  let settings: Repository<AccessibilitySettings>;
  let usageLogs: Repository<UsageLog>;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    caregivers = dataSource.getRepository(Caregiver);
    users = dataSource.getRepository(User);
    boards = dataSource.getRepository(Board);
    categories = dataSource.getRepository(Category);
    pictograms = dataSource.getRepository(Pictogram);
    settings = dataSource.getRepository(AccessibilitySettings);
    usageLogs = dataSource.getRepository(UsageLog);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
    await dataSource.query('PRAGMA foreign_keys = ON');
  });

  /** Crea la cadena cuidador → usuario → tablero → categoría. */
  async function seedChain() {
    const caregiver = await caregivers.save(
      caregivers.create({
        email: 'ana@ejemplo.com',
        passwordHash: 'hash',
        fullName: 'Ana Fonoaudióloga',
        role: CaregiverRole.THERAPIST,
      }),
    );
    const user = await users.save(
      users.create({ name: 'Mateo', birthDate: '2018-05-14', caregiverId: caregiver.id }),
    );
    const board = await boards.save(
      boards.create({ name: 'Casa', userId: user.id, isDefault: true }),
    );
    const category = await categories.save(
      categories.create({ name: 'Comidas', color: '#E8A33D', order: 0, boardId: board.id }),
    );
    return { caregiver, user, board, category };
  }

  it('persiste la cadena cuidador → usuario → tablero → categoría → pictograma', async () => {
    const { category } = await seedChain();

    const pictogram = await pictograms.save(
      pictograms.create({
        text: 'Agua',
        imageUrl: 'https://arasaac.org/2248.png',
        categoryId: category.id,
        source: PictogramSource.ARASAAC,
        arasaacId: 2248,
        order: 0,
      }),
    );

    const found = await pictograms.findOne({
      where: { id: pictogram.id },
      relations: { category: { board: { user: { caregiver: true } } } },
    });

    expect(found?.category.board.user.caregiver.fullName).toBe('Ana Fonoaudióloga');
  });

  it('impide dos pictogramas con el mismo texto en la misma categoría', async () => {
    const { category } = await seedChain();

    await pictograms.save(
      pictograms.create({ text: 'Agua', imageUrl: 'a.png', categoryId: category.id }),
    );

    await expect(
      pictograms.save(
        pictograms.create({ text: 'Agua', imageUrl: 'b.png', categoryId: category.id }),
      ),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('permite el mismo texto en categorías distintas del mismo tablero', async () => {
    const { board, category } = await seedChain();
    const otherCategory = await categories.save(
      categories.create({ name: 'Necesidades', color: '#4A90D9', order: 1, boardId: board.id }),
    );

    await pictograms.save(
      pictograms.create({ text: 'Agua', imageUrl: 'a.png', categoryId: category.id }),
    );
    const second = await pictograms.save(
      pictograms.create({ text: 'Agua', imageUrl: 'b.png', categoryId: otherCategory.id }),
    );

    expect(second.id).toBeDefined();
    expect(await pictograms.count()).toBe(2);
  });

  it('impide dos tableros con el mismo nombre para el mismo usuario', async () => {
    const { user } = await seedChain();

    await expect(
      boards.save(boards.create({ name: 'Casa', userId: user.id })),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('borra en cascada el árbol completo al eliminar el cuidador', async () => {
    const { caregiver, category } = await seedChain();
    await pictograms.save(
      pictograms.create({ text: 'Agua', imageUrl: 'a.png', categoryId: category.id }),
    );

    await caregivers.delete(caregiver.id);

    expect(await users.count()).toBe(0);
    expect(await boards.count()).toBe(0);
    expect(await categories.count()).toBe(0);
    expect(await pictograms.count()).toBe(0);
  });

  it('conserva el registro de uso al borrar el pictograma', async () => {
    const { user, category } = await seedChain();
    const pictogram = await pictograms.save(
      pictograms.create({ text: 'Agua', imageUrl: 'a.png', categoryId: category.id }),
    );
    await usageLogs.save(
      usageLogs.create({
        userId: user.id,
        pictogramId: pictogram.id,
        pictogramTextSnapshot: pictogram.text,
        eventType: UsageEventType.PICTOGRAM_TAP,
        occurredAt: new Date(),
      }),
    );

    await pictograms.delete(pictogram.id);

    const log = await usageLogs.findOne({ where: { userId: user.id } });
    expect(log).not.toBeNull();
    expect(log?.pictogramId).toBeNull();
    // El texto sobrevive al borrado: el reporte del Módulo 6 sigue teniendo sentido.
    expect(log?.pictogramTextSnapshot).toBe('Agua');
  });

  it('aplica los valores por defecto de accesibilidad', async () => {
    const { user } = await seedChain();

    const saved = await settings.save(settings.create({ userId: user.id }));
    const found = await settings.findOneByOrFail({ id: saved.id });

    expect(found.gridSize).toBe(GridSize.GRID_2X3);
    expect(found.tremorFilterEnabled).toBe(false);
    expect(found.holdToConfirmMs).toBe(300);
    expect(found.debounceMs).toBe(500);
    expect(found.speechRate).toBe(1);
  });

  it('permite una sola configuración de accesibilidad por usuario', async () => {
    const { user } = await seedChain();
    await settings.save(settings.create({ userId: user.id }));

    await expect(settings.save(settings.create({ userId: user.id }))).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });

  it('calcula la edad a partir de la fecha de nacimiento', async () => {
    const { user } = await seedChain();
    const found = await users.findOneByOrFail({ id: user.id });

    const birth = new Date('2018-05-14');
    const today = new Date();
    let expected = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      expected -= 1;
    }

    expect(found.age).toBe(expected);
  });

  it('devuelve null como edad cuando no hay fecha de nacimiento', async () => {
    const { caregiver } = await seedChain();
    const user = await users.save(users.create({ name: 'Sin fecha', caregiverId: caregiver.id }));

    expect(user.age).toBeNull();
  });
});
