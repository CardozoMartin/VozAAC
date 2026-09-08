import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '@vozaac/shared';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
