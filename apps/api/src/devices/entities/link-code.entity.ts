import { DeviceKind } from '@vozaac/shared';
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
import { User } from '../../users/entities/user.entity';
import { enumColumn, timestampColumnType } from '../../common/column-types';

/**
 * Código de un solo uso para enrolar un dispositivo (Módulo 9).
 *
 * El padre lo genera desde su celular y lo tipea en el otro dispositivo. Se usa
 * una vez, al enrolar, y no vuelve a aparecer nunca: es el patrón de Netflix o
 * Spotify Connect, y es distinto del PIN del modo terapeuta, que sí es una
 * barrera de todos los días.
 *
 * A diferencia del refresh token, acá se guarda el código en claro. Vive
 * quince minutos, sirve una sola vez y hay que poder mostrárselo al padre
 * mientras está vigente por si cerró la pantalla; un hash impediría eso sin
 * comprar seguridad real para una ventana tan corta.
 */
@Entity('link_codes')
export class LinkCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column(enumColumn(DeviceKind))
  kind: DeviceKind;

  @Index()
  @Column({ type: 'uuid' })
  caregiverId: string;

  @ManyToOne(() => Caregiver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'caregiverId' })
  caregiver: Caregiver;

  /** Perfil al que va a quedar atado el dispositivo; null para un responsable. */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: timestampColumnType() })
  expiresAt: Date;

  /** Cuándo se canjeó. Un código canjeado no vuelve a servir. */
  @Column({ type: timestampColumnType(), nullable: true })
  usedAt: Date | null;

  /** Intentos fallidos; pasado el límite el código queda quemado. */
  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;
}
