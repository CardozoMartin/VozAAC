import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Board } from './entities/board.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea un tablero para un usuario.
   *
   * Si se marca como predeterminado, quita la marca del anterior dentro de una
   * transacción: un usuario no puede quedar con dos tableros predeterminados.
   */
  async create(dto: CreateBoardDto): Promise<Board> {
    const duplicate = await this.boardsRepository.findOne({
      where: { userId: dto.userId, name: dto.name },
    });
    if (duplicate) {
      throw new ConflictException(`El usuario ya tiene un tablero llamado "${dto.name}"`);
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault) {
        await manager.update(Board, { userId: dto.userId }, { isDefault: false });
      }

      // El primer tablero de un usuario es siempre el predeterminado.
      const existingCount = await manager.count(Board, { where: { userId: dto.userId } });
      const board = manager.create(Board, {
        ...dto,
        isDefault: dto.isDefault ?? existingCount === 0,
      });
      return manager.save(board);
    });
  }

  findAllByUser(userId: string): Promise<Board[]> {
    return this.boardsRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  /** Devuelve el tablero con sus categorías y pictogramas ya ordenados. */
  async findOneWithContent(id: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id },
      relations: { categories: { pictograms: true } },
      order: {
        categories: { order: 'ASC', pictograms: { order: 'ASC' } },
      },
    });
    if (!board) {
      throw new NotFoundException(`No existe el tablero ${id}`);
    }
    return board;
  }

  async update(id: string, dto: UpdateBoardDto): Promise<Board> {
    const board = await this.boardsRepository.findOne({ where: { id } });
    if (!board) {
      throw new NotFoundException(`No existe el tablero ${id}`);
    }

    if (dto.name && dto.name !== board.name) {
      const duplicate = await this.boardsRepository.findOne({
        where: { userId: board.userId, name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException(`El usuario ya tiene un tablero llamado "${dto.name}"`);
      }
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault) {
        await manager.update(Board, { userId: board.userId }, { isDefault: false });
      }
      manager.merge(Board, board, dto);
      return manager.save(board);
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.boardsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`No existe el tablero ${id}`);
    }
  }
}
