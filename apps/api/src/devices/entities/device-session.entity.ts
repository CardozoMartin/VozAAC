import { DeviceKind } from '@vozaac/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { User } from '../../users/entities/user.entity';
import { enumColumn, timestampColumnType } from '../../common/column-types';

/**
 * Sesión de un dispositivo vinculado (Módulo 9).
 *
 * Existe porque el JWT de 7 días no sirve para el celular del chico/a: una vez
 * por semana lo sacaría al login, y él no puede resolver eso. Acá el refresh
 * token vive en la base y no caduca por tiempo; la sesión termina sólo cuando
 * un adulto la revoca. El precio es que cada renovación pega a la base, que es
 * exactamente lo que queremos: revocar tiene que surtir efecto enseguida.
 *
 * Se guarda el hash del token, nunca el token. Si alguien lee la base no puede
 * hacerse pasar por el dispositivo, igual que con las contraseñas.
 */
@Entity('device_sessions')
export class DeviceSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre que ve el cuidador en la lista: "Tablet de Mía", "Celu de papá". */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column(enumColumn(DeviceKind))
  kind: DeviceKind;

  /** Hash SHA-256 del refresh token. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, select: false })
  refreshTokenHash: string;

  /**
   * Cuidador dueño de la sesión: de él hereda el dispositivo sus permisos.
   * Para un dispositivo de chico/a es quien lo enroló.
   */
  @Index()
  @Column({ type: 'uuid' })
  caregiverId: string;

  @ManyToOne(() => Caregiver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'caregiverId' })
  caregiver: Caregiver;

  /**
   * Perfil al que el dispositivo abre directo. Null en el de un responsable,
   * que elige perfil como siempre.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  /**
   * Última vez que el dispositivo renovó su sesión. Le sirve al cuidador para
   * distinguir el dispositivo en uso del que perdió hace tres meses y conviene
   * revocar.
   */
  @Column({ type: timestampColumnType(), nullable: true })
  lastSeenAt: Date | null;

  /** Fecha de revocación. Se conserva la fila para que quede el rastro. */
  @Column({ type: timestampColumnType(), nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
