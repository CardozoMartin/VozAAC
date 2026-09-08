import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * Chequeo de que un perfil pertenece al cuidador autenticado.
 *
 * Vive aparte porque lo necesitan varios controllers (tableros, accesibilidad,
 * uso) y es la regla de privacidad central del proyecto: conviene que esté
 * escrita una sola vez.
 */
@Injectable()
export class ProfileOwnershipService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Lanza NotFoundException si el perfil no existe o es de otro cuidador.
   *
   * 404 y no 403 a propósito: un 403 confirmaría que ese perfil existe, y son
   * datos de salud de menores.
   */
  async assertOwned(userId: string, caregiverId: string): Promise<void> {
    const belongs = await this.usersRepository.exists({ where: { id: userId, caregiverId } });
    if (!belongs) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }
  }
}
