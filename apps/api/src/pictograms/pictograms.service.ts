import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PictogramSource } from '@vozaac/shared';
import { Repository } from 'typeorm';
import { Pictogram } from './entities/pictogram.entity';
import { Category } from '../categories/entities/category.entity';
import { CreatePictogramDto } from './dto/create-pictogram.dto';
import { UpdatePictogramDto } from './dto/update-pictogram.dto';

@Injectable()
export class PictogramsService {
  constructor(
    @InjectRepository(Pictogram)
    private readonly pictogramsRepository: Repository<Pictogram>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  /**
   * Crea un pictograma dentro de una categoría.
   *
   * Regla del Módulo 1: no puede repetirse el mismo texto dentro de la misma
   * categoría. La comparación ignora mayúsculas y espacios de sobra, porque
   * "Agua" y "agua " son el mismo concepto para quien usa el tablero. La base
   * tiene además un índice único como última línea de defensa ante escrituras
   * concurrentes.
   */
  async create(dto: CreatePictogramDto): Promise<Pictogram> {
    const category = await this.categoriesRepository.findOne({ where: { id: dto.categoryId } });
    if (!category) {
      throw new NotFoundException(`No existe la categoría ${dto.categoryId}`);
    }

    const text = dto.text.trim();
    await this.assertTextIsUnique(dto.categoryId, text);

    const order = dto.order ?? (await this.nextOrder(dto.categoryId));

    const pictogram = this.pictogramsRepository.create({
      ...dto,
      text,
      order,
      source: dto.source ?? PictogramSource.CUSTOM,
      arasaacId: dto.arasaacId ?? null,
      audioUrl: dto.audioUrl ?? null,
    });
    return this.pictogramsRepository.save(pictogram);
  }

  findAllByCategory(categoryId: string): Promise<Pictogram[]> {
    return this.pictogramsRepository.find({
      where: { categoryId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Pictogram> {
    const pictogram = await this.pictogramsRepository.findOne({ where: { id } });
    if (!pictogram) {
      throw new NotFoundException(`No existe el pictograma ${id}`);
    }
    return pictogram;
  }

  /**
   * Buscador del editor (Módulo 4): pictogramas del cuidador cuyo texto
   * contenga el término.
   *
   * La búsqueda se ancla al cuidador dentro de la propia consulta y no con un
   * filtro posterior: así un tablero ajeno no puede aparecer nunca en los
   * resultados, ni siquiera por error de programación más adelante.
   */
  searchForCaregiver(caregiverId: string, term: string, boardId?: string): Promise<Pictogram[]> {
    const query = this.pictogramsRepository
      .createQueryBuilder('pictogram')
      .innerJoin('pictogram.category', 'category')
      .innerJoin('category.board', 'board')
      .innerJoin('board.user', 'user')
      .where('user.caregiverId = :caregiverId', { caregiverId })
      .andWhere('LOWER(pictogram.text) LIKE LOWER(:term)', { term: `%${term.trim()}%` })
      .orderBy('pictogram.text', 'ASC')
      .take(50);

    if (boardId) {
      query.andWhere('board.id = :boardId', { boardId });
    }

    return query.getMany();
  }

  async update(id: string, dto: UpdatePictogramDto): Promise<Pictogram> {
    const pictogram = await this.findOne(id);
    const targetCategoryId = dto.categoryId ?? pictogram.categoryId;
    const targetText = dto.text?.trim() ?? pictogram.text;

    const movedOrRenamed =
      targetCategoryId !== pictogram.categoryId || targetText !== pictogram.text;
    if (movedOrRenamed) {
      await this.assertTextIsUnique(targetCategoryId, targetText, id);
    }

    this.pictogramsRepository.merge(pictogram, { ...dto, text: targetText });
    return this.pictogramsRepository.save(pictogram);
  }

  async remove(id: string): Promise<void> {
    const result = await this.pictogramsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`No existe el pictograma ${id}`);
    }
  }

  /** Reordena los pictogramas de una categoría según el orden de los ids. */
  async reorder(categoryId: string, orderedIds: string[]): Promise<Pictogram[]> {
    const pictograms = await this.findAllByCategory(categoryId);
    const known = new Set(pictograms.map((p) => p.id));

    const unknown = orderedIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `Los pictogramas ${unknown.join(', ')} no pertenecen a la categoría ${categoryId}`,
      );
    }

    orderedIds.forEach((id, index) => {
      const pictogram = pictograms.find((p) => p.id === id);
      if (pictogram) pictogram.order = index;
    });
    return this.pictogramsRepository.save(pictograms);
  }

  /**
   * Lanza ConflictException si ya existe otro pictograma con ese texto en la
   * categoría. `excludeId` evita que un pictograma choque consigo mismo al
   * editarse.
   */
  private async assertTextIsUnique(
    categoryId: string,
    text: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.pictogramsRepository
      .createQueryBuilder('pictogram')
      .where('pictogram.categoryId = :categoryId', { categoryId })
      .andWhere('LOWER(TRIM(pictogram.text)) = LOWER(TRIM(:text))', { text })
      .andWhere(excludeId ? 'pictogram.id != :excludeId' : '1 = 1', { excludeId })
      .getOne();

    if (existing) {
      throw new ConflictException(`Ya existe un pictograma "${text}" en esta categoría`);
    }
  }

  /** Siguiente posición libre al final de la grilla de la categoría. */
  private async nextOrder(categoryId: string): Promise<number> {
    const last = await this.pictogramsRepository.findOne({
      where: { categoryId },
      order: { order: 'DESC' },
    });
    return last ? last.order + 1 : 0;
  }
}
