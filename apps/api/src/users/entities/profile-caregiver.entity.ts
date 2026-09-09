import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { User } from './user.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Quiénes son responsables de un chico/a (Módulo 9, paso 3).
 *
 * Antes un perfil tenía un solo cuidador, y eso dejaba afuera el caso normal:
 * la madre y el padre cuidan al mismo chico/a, y muchas veces también un
 * hermano mayor, una abuela o la maestra. Con una relación uno-a-muchos el
 * segundo responsable tenía que compartir la cuenta del primero, que además de
 * incómodo mezcla en un solo login a personas distintas.
 *
 * Todos los responsables pueden lo mismo: ver el tablero, editarlo y sumar a
 * otro responsable. No hay dueño ni invitados. Es lo que refleja cómo funciona
 * una familia —si la madre y el padre cuidan al mismo chico/a, los dos
 * necesitan poder arreglar el tablero un domingo a la noche— y evita que la
 * app tenga que explicarle a alguien por qué no puede hacer algo que la otra
 * persona sí.
 *
 * `relationship` es sólo una etiqueta para mostrar ("Mamá", "Hermano"): no
 * define permisos. Sirve para que en la lista se distinga quién es quién.
 */
@Entity('profile_caregivers')
// Único: sumar dos veces al mismo responsable no significa nada, y con filas
// repetidas los listados mostrarían duplicados.
@Index(['userId', 'caregiverId'], { unique: true })
export class ProfileCaregiver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.caregiverLinks, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  caregiverId: string;

  @ManyToOne(() => Caregiver, (caregiver) => caregiver.profileLinks, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'caregiverId' })
  caregiver: Caregiver;

  /** Cómo se muestra en la lista: "Mamá", "Papá", "Hermano", "Maestra". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  relationship: string | null;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;
}
