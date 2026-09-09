import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ProfileCaregiver } from './entities/profile-caregiver.entity';
import { Board } from '../boards/entities/board.entity';
import { Category } from '../categories/entities/category.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';

/**
 * Chequeo de que algo pertenece a un chico/a del que el cuidador es responsable.
 *
 * Vive aparte porque lo necesitan casi todos los controllers y es la regla de
 * privacidad central del proyecto: conviene que esté escrita una sola vez.
 *
 * Desde el paso 3 del Módulo 9 el acceso no sale de `users.caregiverId` sino
 * de la tabla `profile_caregivers`: un chico/a puede tener varios responsables
 * —madre, padre, un hermano, la maestra— y todos ven y editan lo mismo. Por
 * eso cada consulta cruza por esa tabla en vez de comparar una columna.
 *
 * Todas las variantes lanzan NotFoundException y no ForbiddenException a
 * propósito: un 403 confirmaría que ese recurso existe, y son datos de salud
 * de menores. El contenido de un tablero se alcanza siguiendo la cadena
 * pictograma → categoría → tablero → perfil → responsables.
 */
@Injectable()
export class ProfileOwnershipService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProfileCaregiver)
    private readonly linksRepository: Repository<ProfileCaregiver>,
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Pictogram)
    private readonly pictogramsRepository: Repository<Pictogram>,
  ) {}

  /** El perfil existe y el cuidador es uno de sus responsables. */
  async assertOwned(userId: string, caregiverId: string): Promise<void> {
    if (!(await this.isResponsible(userId, caregiverId))) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }
  }

  /**
   * Si el cuidador es responsable del chico/a.
   *
   * Consulta directa a la tabla intermedia: es la pregunta que se hace en cada
   * request del editor, y el índice único sobre (userId, caregiverId) la
   * resuelve sin recorrer nada.
   */
  isResponsible(userId: string, caregiverId: string): Promise<boolean> {
    return this.linksRepository.exists({ where: { userId, caregiverId } });
  }

  /** El tablero pertenece a un perfil del que el cuidador es responsable. */
  async assertOwnsBoard(boardId: string, caregiverId: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id: boardId, user: { caregiverLinks: { caregiverId } } },
      relations: { user: true },
    });
    if (!board) {
      throw new NotFoundException(`No existe el tablero ${boardId}`);
    }
    return board;
  }

  /** La categoría cuelga de un tablero de un perfil a su cargo. */
  async assertOwnsCategory(categoryId: string, caregiverId: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId, board: { user: { caregiverLinks: { caregiverId } } } },
      relations: { board: { user: true } },
    });
    if (!category) {
      throw new NotFoundException(`No existe la categoría ${categoryId}`);
    }
    return category;
  }

  /** El pictograma cuelga de una categoría de un perfil a su cargo. */
  async assertOwnsPictogram(pictogramId: string, caregiverId: string): Promise<Pictogram> {
    const pictogram = await this.pictogramsRepository.findOne({
      where: {
        id: pictogramId,
        category: { board: { user: { caregiverLinks: { caregiverId } } } },
      },
      relations: { category: { board: { user: true } } },
    });
    if (!pictogram) {
      throw new NotFoundException(`No existe el pictograma ${pictogramId}`);
    }
    return pictogram;
  }
}
