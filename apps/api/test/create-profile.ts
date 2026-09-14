import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { ProfileCaregiver } from '../src/users/entities/profile-caregiver.entity';

/**
 * Crea un perfil de prueba directo en la base, con su fila de responsable.
 *
 * Los escenarios de los e2e insertan a mano en vez de pasar por
 * `POST /api/users`, que además del perfil crea tablero y vocabulario inicial
 * y haría cada test mucho más lento y menos explícito sobre qué está
 * probando.
 *
 * El detalle que importa: desde el paso 3 del Módulo 9 el acceso sale de
 * `profile_caregivers`, así que un perfil insertado sin esa fila no lo ve
 * nadie. Este helper existe para que no se olvide, que es justo el tipo de
 * error que después aparece como un 404 difícil de explicar.
 */
export async function crearPerfil(
  dataSource: DataSource,
  caregiverId: string,
  attrs: Partial<User> = {},
): Promise<User> {
  const user = await dataSource
    .getRepository(User)
    .save({ name: 'Perfil', ...attrs, caregiverId } as User);

  await dataSource
    .getRepository(ProfileCaregiver)
    .save({ userId: user.id, caregiverId } as ProfileCaregiver);

  return user;
}
