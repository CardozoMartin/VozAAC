import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PictogramSource, ProfileCaregiverInfo, UserProfile } from '@vozaac/shared';
import { User } from './entities/user.entity';
import { ProfileCaregiver } from './entities/profile-caregiver.entity';
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
    @InjectRepository(ProfileCaregiver)
    private readonly linksRepository: Repository<ProfileCaregiver>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Perfiles de los que el cuidador es responsable, para el selector al abrir
   * la app.
   *
   * Sale de `profile_caregivers` y no de `users.caregiverId`: desde el paso 3
   * del Módulo 9 un chico/a puede tener varios responsables, y el padre tiene
   * que ver al mismo chico/a que la madre aunque el perfil lo haya creado ella.
   */
  async findAllByCaregiver(caregiverId: string): Promise<UserProfile[]> {
    const users = await this.usersRepository.find({
      where: { caregiverLinks: { caregiverId } },
      order: { name: 'ASC' },
    });
    return users.map((user) => this.toProfile(user));
  }

  /**
   * Busca un perfil exigiendo que el cuidador sea uno de sus responsables.
   *
   * La condición va en el where y no en un chequeo posterior: así un perfil
   * ajeno devuelve 404 y no 403. Un 403 confirmaría que el id existe, y estos
   * perfiles son datos de salud de menores.
   */
  async findOneForCaregiver(id: string, caregiverId: string): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({
      where: { id, caregiverLinks: { caregiverId } },
    });
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

      // Quien crea el perfil queda como su primer responsable. Sin esta fila
      // no vería al chico/a que acaba de dar de alta: el acceso lo define la
      // tabla intermedia, no `caregiverId`.
      await manager.save(
        manager.create(ProfileCaregiver, {
          userId: created.id,
          caregiverId,
          relationship: dto.relationship ?? null,
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
              isUrgent: word.isUrgent ?? false,
              order: wordIndex,
            }),
          ),
        );
      }

      return created;
    });

    return this.toProfile(user);
  }

  /** Edita el perfil, exigiendo que el cuidador sea uno de sus responsables. */
  async updateForCaregiver(
    id: string,
    caregiverId: string,
    dto: UpdateUserDto,
  ): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({
      where: { id, caregiverLinks: { caregiverId } },
    });
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
   *
   * Cualquier responsable puede borrarlo, igual que puede editarlo: no hay
   * dueño ni invitados. El borrado se lleva también las filas de
   * `profile_caregivers`, así que el perfil desaparece de la app de todos.
   */
  async removeForCaregiver(id: string, caregiverId: string): Promise<void> {
    const esResponsable = await this.linksRepository.exists({
      where: { userId: id, caregiverId },
    });
    if (!esResponsable) {
      throw new NotFoundException(`No existe el perfil ${id}`);
    }
    await this.usersRepository.delete({ id });
  }

  /**
   * Responsables de un chico/a, para la pantalla donde se administran.
   *
   * Exige que quien pregunta sea uno de ellos: la lista dice nombre y email de
   * personas reales, y no tiene por qué verla alguien de afuera.
   */
  async listCaregivers(userId: string, caregiverId: string): Promise<ProfileCaregiverInfo[]> {
    const esResponsable = await this.linksRepository.exists({ where: { userId, caregiverId } });
    if (!esResponsable) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }

    const links = await this.linksRepository.find({
      where: { userId },
      relations: { caregiver: true },
      order: { createdAt: 'ASC' },
    });

    return links.map((link) => ({
      id: link.id,
      caregiverId: link.caregiverId,
      fullName: link.caregiver.fullName,
      email: link.caregiver.email,
      relationship: link.relationship,
      /** Para que la app no ofrezca "quitar" sobre uno mismo. */
      isSelf: link.caregiverId === caregiverId,
      createdAt: link.createdAt.toISOString(),
    }));
  }

  /**
   * Suma un responsable al perfil.
   *
   * Es idempotente: si ya lo era, actualiza la etiqueta y no falla. Sumar dos
   * veces a la misma persona no significa nada distinto de sumarla una, y
   * hacer fallar el segundo intento obligaría a la app a distinguir un caso
   * que para el usuario es el mismo.
   */
  async addCaregiver(
    userId: string,
    caregiverId: string,
    relationship?: string | null,
  ): Promise<void> {
    const existente = await this.linksRepository.findOne({ where: { userId, caregiverId } });
    if (existente) {
      if (relationship !== undefined && relationship !== existente.relationship) {
        await this.linksRepository.update(existente.id, { relationship: relationship ?? null });
      }
      return;
    }

    await this.linksRepository.save(
      this.linksRepository.create({ userId, caregiverId, relationship: relationship ?? null }),
    );
  }

  /**
   * Quita a un responsable del perfil.
   *
   * No se permite quitar al último: un perfil sin responsables quedaría
   * inaccesible para todos y sólo se podría recuperar tocando la base a mano.
   * Para deshacerse del perfil está el borrado, que además limpia sus datos.
   *
   * Sí se puede quitar a uno mismo —alguien que deja de estar a cargo— siempre
   * que quede otro.
   */
  async removeCaregiver(userId: string, caregiverId: string, targetId: string): Promise<void> {
    const esResponsable = await this.linksRepository.exists({ where: { userId, caregiverId } });
    if (!esResponsable) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }

    const total = await this.linksRepository.count({ where: { userId } });
    if (total <= 1) {
      throw new ConflictException(
        'No se puede quitar al único responsable. Para eliminar el perfil, borralo.',
      );
    }

    const result = await this.linksRepository.delete({ userId, caregiverId: targetId });
    if (!result.affected) {
      throw new NotFoundException('Esa persona no es responsable de este perfil');
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
