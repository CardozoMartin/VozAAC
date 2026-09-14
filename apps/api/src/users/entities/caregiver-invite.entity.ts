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
 * Invitación para sumar a otro responsable de un chico/a (Módulo 9, paso 3).
 *
 * Se parece al código de vinculación de dispositivos, pero resuelve otra cosa.
 * Aquel enrola un aparato y le abre una sesión; este suma a una persona que
 * tiene —o va a crear— su propia cuenta, con su email y su contraseña. Eso
 * importa: la madre y el padre no comparten login, cada uno entra con lo suyo
 * y ambos ven al mismo chico/a.
 *
 * Vive 48 horas y no quince minutos como el de dispositivos: aquel se canjea
 * con los dos aparatos sobre la mesa, y este se manda por mensaje a alguien
 * que capaz se registra a la noche.
 *
 * El código se guarda en claro por la misma razón que el de vinculación: hay
 * que poder volver a mostrárselo a quien invitó si cerró la pantalla, y
 * hashearlo no compraría seguridad real para un código de un solo uso.
 */
@Entity('caregiver_invites')
export class CaregiverInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  /** Chico/a al que se suma el responsable invitado. */
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Quién invitó. Sirve para mostrar de parte de quién llegó la invitación. */
  @Index()
  @Column({ type: 'uuid' })
  invitedByCaregiverId: string;

  @ManyToOne(() => Caregiver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'invitedByCaregiverId' })
  invitedBy: Caregiver;

  /** Etiqueta sugerida para el invitado: "Papá", "Hermana", "Maestra". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  relationship: string | null;

  @Column({ type: timestampColumnType() })
  expiresAt: Date;

  /** Cuándo se canjeó. Una invitación canjeada no vuelve a servir. */
  @Column({ type: timestampColumnType(), nullable: true })
  usedAt: Date | null;

  /** Quién la canjeó, para que quien invitó vea que ya fue aceptada. */
  @Column({ type: 'uuid', nullable: true })
  acceptedByCaregiverId: string | null;

  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;
}
