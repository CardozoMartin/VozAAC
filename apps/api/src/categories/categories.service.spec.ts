import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Board } from '../boards/entities/board.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoriesRepository: jest.Mocked<Repository<Category>>;
  let boardsRepository: jest.Mocked<Repository<Board>>;
  let queryBuilder: { [key: string]: jest.Mock };

  const BOARD_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((dto: Partial<Category>) => dto as Category),
            save: jest.fn((entity: unknown) => Promise.resolve(entity)),
            merge: jest.fn((target: Category, dto: Partial<Category>) =>
              Object.assign(target, dto),
            ),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Board),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: BOARD_ID } as Board) },
        },
      ],
    }).compile();

    service = module.get(CategoriesService);
    categoriesRepository = module.get(getRepositoryToken(Category));
    boardsRepository = module.get(getRepositoryToken(Board));
  });

  describe('create', () => {
    it('crea la categoría al final del tablero', async () => {
      categoriesRepository.findOne.mockResolvedValue({ order: 2 } as Category);

      const creada = (await service.create({ name: 'Comidas', boardId: BOARD_ID })) as Category;

      expect(creada.order).toBe(3);
    });

    it('arranca en cero cuando el tablero no tiene categorías', async () => {
      const creada = (await service.create({ name: 'Primera', boardId: BOARD_ID })) as Category;

      expect(creada.order).toBe(0);
    });

    it('recorta los espacios del nombre', async () => {
      const creada = (await service.create({ name: '  Comidas  ', boardId: BOARD_ID })) as Category;

      expect(creada.name).toBe('Comidas');
    });

    it('rechaza un nombre repetido en el mismo tablero', async () => {
      queryBuilder.getOne.mockResolvedValue({ id: 'otra' } as Category);

      await expect(service.create({ name: 'Comidas', boardId: BOARD_ID })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('avisa si el tablero no existe', async () => {
      boardsRepository.findOne.mockResolvedValue(null);

      await expect(service.create({ name: 'Comidas', boardId: BOARD_ID })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('renombra la categoría', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Comidas',
        boardId: BOARD_ID,
      } as Category);

      const actualizada = (await service.update('cat-1', { name: 'Alimentos' })) as Category;

      expect(actualizada.name).toBe('Alimentos');
    });

    it('deja conservar el nombre propio al editar otro campo', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Comidas',
        boardId: BOARD_ID,
      } as Category);

      // Mandar el mismo nombre no debe chocar consigo misma.
      await expect(
        service.update('cat-1', { name: 'Comidas', color: '#FF0000' }),
      ).resolves.toBeDefined();
    });

    it('rechaza renombrar a un nombre ya usado en el tablero', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Comidas',
        boardId: BOARD_ID,
      } as Category);
      queryBuilder.getOne.mockResolvedValue({ id: 'cat-2' } as Category);

      await expect(service.update('cat-1', { name: 'Acciones' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('avisa si la categoría no existe', async () => {
      await expect(service.update('inexistente', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('asigna el orden según la posición en la lista', async () => {
      const categorias = [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
        { id: 'c', order: 2 },
      ] as Category[];
      categoriesRepository.find.mockResolvedValue(categorias);

      await service.reorder(BOARD_ID, ['c', 'a', 'b']);

      expect(categorias.find((c) => c.id === 'c')?.order).toBe(0);
      expect(categorias.find((c) => c.id === 'a')?.order).toBe(1);
      expect(categorias.find((c) => c.id === 'b')?.order).toBe(2);
    });

    it('rechaza ids que no son del tablero', async () => {
      categoriesRepository.find.mockResolvedValue([{ id: 'a', order: 0 }] as Category[]);

      await expect(service.reorder(BOARD_ID, ['a', 'ajena'])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('avisa si la categoría no existe', async () => {
      categoriesRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove('inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
