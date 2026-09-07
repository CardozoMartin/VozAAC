import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PictogramSource } from '@vozaac/shared';
import { Repository } from 'typeorm';
import { PictogramsService } from './pictograms.service';
import { Pictogram } from './entities/pictogram.entity';
import { Category } from '../categories/entities/category.entity';

/**
 * Tests unitarios del Módulo 1. Los repositorios están mockeados: acá se
 * valida la regla de negocio, no el mapeo a SQL (eso va en los tests de
 * integración, en test/).
 */
describe('PictogramsService', () => {
  let service: PictogramsService;
  let pictogramsRepository: jest.Mocked<Repository<Pictogram>>;
  let categoriesRepository: jest.Mocked<Repository<Category>>;
  let queryBuilder: { where: jest.Mock; andWhere: jest.Mock; getOne: jest.Mock };

  const category = { id: 'cat-1', name: 'Comidas', boardId: 'board-1' } as Category;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PictogramsService,
        {
          provide: getRepositoryToken(Pictogram),
          useValue: {
            create: jest.fn((dto) => dto as Pictogram),
            save: jest.fn((entity) => Promise.resolve({ id: 'picto-1', ...entity })),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            merge: jest.fn((target, dto) => Object.assign(target, dto)),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { findOne: jest.fn().mockResolvedValue(category) },
        },
      ],
    }).compile();

    service = module.get(PictogramsService);
    pictogramsRepository = module.get(getRepositoryToken(Pictogram));
    categoriesRepository = module.get(getRepositoryToken(Category));
  });

  describe('create', () => {
    it('crea un pictograma en una categoría existente', async () => {
      const result = await service.create({
        text: 'Agua',
        imageUrl: 'https://arasaac.org/2248.png',
        categoryId: 'cat-1',
      });

      expect(result.text).toBe('Agua');
      expect(result.source).toBe(PictogramSource.CUSTOM);
      expect(pictogramsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('recorta los espacios sobrantes del texto', async () => {
      const result = await service.create({
        text: '  Agua  ',
        imageUrl: 'https://arasaac.org/2248.png',
        categoryId: 'cat-1',
      });

      expect(result.text).toBe('Agua');
    });

    it('rechaza un pictograma duplicado en la misma categoría', async () => {
      queryBuilder.getOne.mockResolvedValue({ id: 'existente', text: 'Agua' });

      await expect(
        service.create({
          text: 'Agua',
          imageUrl: 'https://arasaac.org/2248.png',
          categoryId: 'cat-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza el duplicado sin importar mayúsculas ni espacios', async () => {
      await service.create({
        text: 'AGUA ',
        imageUrl: 'https://arasaac.org/2248.png',
        categoryId: 'cat-1',
      });

      // La comparación se delega a SQL con LOWER(TRIM(...)) en ambos lados.
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(TRIM(pictogram.text)) = LOWER(TRIM(:text))',
        { text: 'AGUA' },
      );
    });

    it('falla si la categoría no existe', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          text: 'Agua',
          imageUrl: 'https://arasaac.org/2248.png',
          categoryId: 'inexistente',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('coloca el pictograma nuevo al final de la grilla', async () => {
      pictogramsRepository.findOne.mockResolvedValue({ order: 4 } as Pictogram);

      const result = await service.create({
        text: 'Pan',
        imageUrl: 'https://arasaac.org/2401.png',
        categoryId: 'cat-1',
      });

      expect(result.order).toBe(5);
    });
  });

  describe('reorder', () => {
    it('reasigna el orden siguiendo la lista de ids', async () => {
      pictogramsRepository.find.mockResolvedValue([
        { id: 'a', order: 0 } as Pictogram,
        { id: 'b', order: 1 } as Pictogram,
        { id: 'c', order: 2 } as Pictogram,
      ]);

      await service.reorder('cat-1', ['c', 'a', 'b']);

      const saved = pictogramsRepository.save.mock.calls[0][0] as Pictogram[];
      expect(saved.find((p) => p.id === 'c')?.order).toBe(0);
      expect(saved.find((p) => p.id === 'a')?.order).toBe(1);
      expect(saved.find((p) => p.id === 'b')?.order).toBe(2);
    });

    it('rechaza ids que no pertenecen a la categoría', async () => {
      pictogramsRepository.find.mockResolvedValue([{ id: 'a', order: 0 } as Pictogram]);

      await expect(service.reorder('cat-1', ['a', 'intruso'])).rejects.toThrow(NotFoundException);
    });
  });
});
