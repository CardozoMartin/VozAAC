import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Board } from '../boards/entities/board.entity';
import { Category } from '../categories/entities/category.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';

/**
 * Chequeo de que algo pertenece al cuidador autenticado.
 *
 * Vive aparte porque lo necesitan casi todos los controllers y es la regla de
 * privacidad central del proyecto: conviene que esté escrita una sola vez.
 *
 * Todas las variantes lanzan NotFoundException y no ForbiddenException a
 * propósito: un 403 confirmaría que ese recurso existe, y son datos de salud
 * de menores. El contenido de un tablero se alcanza siguiendo la cadena
 * pictograma → categoría → tablero → perfil → cuidador.
 */
@Injectable()
export class ProfileOwnershipService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Pictogram)
    private readonly pictogramsRepository: Repository<Pictogram>,
  ) {}

  /** El perfil existe y es del cuidador. */
  async assertOwned(userId: string, caregiverId: string): Promise<void> {
    const belongs = await this.usersRepository.exists({ where: { id: userId, caregiverId } });
    if (!belongs) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }
  }

  /** El tablero pertenece a un perfil del cuidador. */
  async assertOwnsBoard(boardId: string, caregiverId: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id: boardId, user: { caregiverId } },
      relations: { user: true },
    });
    if (!board) {
      throw new NotFoundException(`No existe el tablero ${boardId}`);
    }
    return board;
  }

  /** La categoría cuelga de un tablero del cuidador. */
  async assertOwnsCategory(categoryId: string, caregiverId: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId, board: { user: { caregiverId } } },
      relations: { board: { user: true } },
    });
    if (!category) {
      throw new NotFoundException(`No existe la categoría ${categoryId}`);
    }
    return category;
  }

  /** El pictograma cuelga de una categoría del cuidador. */
  async assertOwnsPictogram(pictogramId: string, caregiverId: string): Promise<Pictogram> {
    const pictogram = await this.pictogramsRepository.findOne({
      where: { id: pictogramId, category: { board: { user: { caregiverId } } } },
      relations: { category: { board: { user: true } } },
    });
    if (!pictogram) {
      throw new NotFoundException(`No existe el pictograma ${pictogramId}`);
    }
    return pictogram;
  }
}
