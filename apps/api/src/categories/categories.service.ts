import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Board } from '../boards/entities/board.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
  ) {}

  /**
   * Crea una categoría al final del tablero.
   *
   * El nombre no puede repetirse dentro del mismo tablero: dos tabs iguales
   * serían indistinguibles para quien usa el comunicador. La base tiene además
   * un índice único como última defensa ante escrituras concurrentes.
   */
  async create(dto: CreateCategoryDto): Promise<Category> {
    const board = await this.boardsRepository.findOne({ where: { id: dto.boardId } });
    if (!board) {
      throw new NotFoundException(`No existe el tablero ${dto.boardId}`);
    }

    const name = dto.name.trim();
    await this.assertNameIsUnique(dto.boardId, name);

    return this.categoriesRepository.save(
      this.categoriesRepository.create({
        ...dto,
        name,
        order: dto.order ?? (await this.nextOrder(dto.boardId)),
      }),
    );
  }

  findAllByBoard(boardId: string): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: { boardId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`No existe la categoría ${id}`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    const name = dto.name?.trim();
    if (name && name !== category.name) {
      await this.assertNameIsUnique(category.boardId, name, id);
    }

    this.categoriesRepository.merge(category, { ...dto, ...(name ? { name } : {}) });
    return this.categoriesRepository.save(category);
  }

  /**
   * Borra la categoría y, en cascada, sus pictogramas.
   *
   * La cascada la define la entidad; acá se avisa cuántos pictogramas se van
   * a perder para que el editor pueda confirmarlo con el terapeuta antes.
   */
  async remove(id: string): Promise<void> {
    const result = await this.categoriesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`No existe la categoría ${id}`);
    }
  }

  /** Reordena los tabs del tablero según el orden de los ids. */
  async reorder(boardId: string, orderedIds: string[]): Promise<Category[]> {
    const categories = await this.findAllByBoard(boardId);
    const known = new Set(categories.map((category) => category.id));

    const unknown = orderedIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `Las categorías ${unknown.join(', ')} no pertenecen al tablero ${boardId}`,
      );
    }

    orderedIds.forEach((id, index) => {
      const category = categories.find((c) => c.id === id);
      if (category) category.order = index;
    });
    return this.categoriesRepository.save(categories);
  }

  private async assertNameIsUnique(
    boardId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoriesRepository
      .createQueryBuilder('category')
      .where('category.boardId = :boardId', { boardId })
      .andWhere('LOWER(TRIM(category.name)) = LOWER(TRIM(:name))', { name })
      .andWhere(excludeId ? 'category.id != :excludeId' : '1 = 1', { excludeId })
      .getOne();

    if (existing) {
      throw new ConflictException(`El tablero ya tiene una categoría "${name}"`);
    }
  }

  private async nextOrder(boardId: string): Promise<number> {
    const last = await this.categoriesRepository.findOne({
      where: { boardId },
      order: { order: 'DESC' },
    });
    return last ? last.order + 1 : 0;
  }
}
