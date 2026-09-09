import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PictogramSource, UserProfile } from '@vozaac/shared';
import { User } from './entities/user.entity';
import { Board } from '../boards/entities/board.entity';
import { Category } from '../categories/entities/category.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../accessibility/entities/accessibility-settings.entity';
import { STARTER_VOCABULARY } from '../boards/starter-vocabulary';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Tamaño de imagen del CDN de ARASAAC; el mismo que usa ArasaacService. */
const ARASAAC_IMAGE_SIZE = 300;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** Perfiles de un cuidador, para el selector al abrir la app. */
  async findAllByCaregiver(caregiverId: string): Promise<UserProfile[]> {
    const users = await this.usersRepository.find({
      where: { caregiverId },
      order: { name: 'ASC' },
    });
    return users.map((user) => this.toProfile(user));
  }

  /**
   * Busca un perfil exigiendo que pertenezca al cuidador.
   *
   * El caregiverId va en el where y no en un chequeo posterior: así un perfil
   * de otro cuidador devuelve 404 y no 403. Un 403 confirmaría que el id
   * existe, y estos perfiles son datos de salud de menores.
   */
  async findOneForCaregiver(id: string, caregiverId: string): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({ where: { id, caregiverId } });
    if (!user) {
      throw new NotFoundException(`No existe el perfil ${id}`);
    }
    return this.toProfile(user);
  }

  /**
   * Crea el perfil de un chico/a con todo lo necesario para empezar a usarlo.
   *
   * Además del perfil deja su configuración de accesibilidad, un tablero por
   * defecto y el vocabulario inicial. Es deliberado que no sea sólo la fila
   * del perfil: un chico/a que abre el comunicador y encuentra una grilla
   * vacía no puede comunicar nada, y el cuidador tampoco tiene de dónde
   * agarrarse para entender cómo se arma un tablero. Se edita desde el Módulo
   * 4; esto es el punto de partida.
   *
   * Todo va en una transacción: un perfil a medio armar —con tablero pero sin
   * categorías, digamos— dejaría al chico/a frente a una pantalla rota, y no
   * hay forma de arreglarlo desde la app.
   */
  async createForCaregiver(caregiverId: string, dto: CreateUserDto): Promise<UserProfile> {
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(User, {
          name: dto.name,
          birthDate: dto.birthDate ?? null,
          photoUrl: dto.photoUrl ?? null,
          caregiverId,
        }),
      );

      await manager.save(manager.create(AccessibilitySettings, { userId: created.id }));

      const board = await manager.save(
        manager.create(Board, {
          name: 'Tablero principal',
          userId: created.id,
          isDefault: true,
        }),
      );

      for (const [index, starter] of STARTER_VOCABULARY.entries()) {
        const category = await manager.save(
          manager.create(Category, {
            name: starter.name,
            color: starter.color,
            order: index,
            boardId: board.id,
          }),
        );

        await manager.save(
          starter.words.map((word, wordIndex) =>
            manager.create(Pictogram, {
              text: word.text,
              imageUrl: this.arasaacImageUrl(word.arasaacId),
              categoryId: category.id,
              source: PictogramSource.ARASAAC,
              arasaacId: word.arasaacId,
              order: wordIndex,
            }),
          ),
        );
      }

      return created;
    });

    return this.toProfile(user);
  }

  /** Edita el perfil, exigiendo que sea del cuidador. */
  async updateForCaregiver(
    id: string,
    caregiverId: string,
    dto: UpdateUserDto,
  ): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({ where: { id, caregiverId } });
    if (!user) {
      throw new NotFoundException(`No existe el perfil ${id}`);
    }

    const updated = await this.usersRepository.save(this.usersRepository.merge(user, dto));
    return this.toProfile(updated);
  }

  /**
   * Borra el perfil y, en cascada, su tablero, vocabulario y configuración.
   *
   * La cascada la define el modelo del Módulo 1. Se borra de verdad y no con
   * soft delete: si una familia pide que se eliminen los datos de su hijo/a,
   * dejarlos marcados como borrados en la base no sería cumplir con eso.
   */
  async removeForCaregiver(id: string, caregiverId: string): Promise<void> {
    const result = await this.usersRepository.delete({ id, caregiverId });
    if (!result.affected) {
      throw new NotFoundException(`No existe el perfil ${id}`);
    }
  }

  private arasaacImageUrl(id: number): string {
    return `https://static.arasaac.org/pictograms/${id}/${id}_${ARASAAC_IMAGE_SIZE}.png`;
  }

  /** La edad es un getter de la entidad, así que se agrega explícitamente al serializar. */
  private toProfile(user: User): UserProfile {
    return {
      id: user.id,
      name: user.name,
      birthDate: user.birthDate,
      photoUrl: user.photoUrl,
      caregiverId: user.caregiverId,
      age: user.age,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
