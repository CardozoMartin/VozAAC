import { CaregiverRole } from '@vozaac/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProfileCaregiver } from '../../users/entities/profile-caregiver.entity';
import { enumColumn, timestampColumnType } from '../../common/column-types';

/**
 * Cuidador o terapeuta: quien se autentica en la app (Módulo 2).
 * Un cuidador administra uno o varios usuarios (los niños/as).
 */
@Entity('caregivers')
export class Caregiver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Hash bcrypt. Nunca se serializa hacia el cliente. */
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  @Column(enumColumn(CaregiverRole, { default: CaregiverRole.FAMILY }))
  role: CaregiverRole;

  /**
   * Hash del PIN que desbloquea el modo terapeuta (Módulo 2).
   * Nulo mientras el cuidador no configuró uno.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  therapistPinHash: string | null;

  /** Perfiles que este cuidador creó. El acceso lo define `profileLinks`. */
  @OneToMany(() => User, (user) => user.caregiver, { cascade: ['soft-remove'] })
  users: User[];

  /** Chicos/as de los que es responsable, los haya creado o no. */
  @OneToMany(() => ProfileCaregiver, (link) => link.caregiver)
  profileLinks: ProfileCaregiver[];

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
