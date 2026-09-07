import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BoardsService } from './boards.service';
import { Board } from './entities/board.entity';

describe('BoardsService', () => {
  let service: BoardsService;
  let boardsRepository: jest.Mocked<Repository<Board>>;
  let manager: {
    update: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    merge: jest.Mock;
  };

  beforeEach(async () => {
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entity, dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'board-1', ...entity })),
      merge: jest.fn((_entity, target, dto) => Object.assign(target, dto)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: getRepositoryToken(Board),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
              cb(manager as unknown as EntityManager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(BoardsService);
    boardsRepository = module.get(getRepositoryToken(Board));
  });

  describe('create', () => {
    it('crea un tablero para el usuario', async () => {
      const board = await service.create({ name: 'Casa', userId: 'user-1' });

      expect(board.name).toBe('Casa');
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it('marca como predeterminado el primer tablero del usuario', async () => {
      manager.count.mockResolvedValue(0);

      const board = await service.create({ name: 'Casa', userId: 'user-1' });

      expect(board.isDefault).toBe(true);
    });

    it('no marca como predeterminado un tablero posterior', async () => {
      manager.count.mockResolvedValue(2);

      const board = await service.create({ name: 'Escuela', userId: 'user-1' });

      expect(board.isDefault).toBe(false);
    });

    it('quita el predeterminado anterior al crear uno nuevo como predeterminado', async () => {
      manager.count.mockResolvedValue(1);

      await service.create({ name: 'Escuela', userId: 'user-1', isDefault: true });

      expect(manager.update).toHaveBeenCalledWith(
        Board,
        { userId: 'user-1' },
        { isDefault: false },
      );
    });

    it('rechaza dos tableros con el mismo nombre para el mismo usuario', async () => {
      boardsRepository.findOne.mockResolvedValue({ id: 'existente', name: 'Casa' } as Board);

      await expect(service.create({ name: 'Casa', userId: 'user-1' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOneWithContent', () => {
    it('falla si el tablero no existe', async () => {
      boardsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneWithContent('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('falla si el tablero no existe', async () => {
      boardsRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove('inexistente')).rejects.toThrow(NotFoundException);
    });
  });
});
