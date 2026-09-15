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
import { DeviceSession } from './device-session.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Token de push de un dispositivo concreto (Módulo 9, paso 5).
 *
 * Va en su propia tabla y no como columna de `device_sessions` porque las dos
 * cosas caducan distinto: la sesión vive hasta que un adulto la revoca, y el
 * token de Expo se muere solo cuando reinstalan la app o el sistema lo rota.
 * Mezclarlos obligaría a revocar la sesión de un familiar —sacándolo de la
 * app— sólo porque su token quedó viejo.
 *
 * La fila es del cuidador, no del perfil del chico/a. Un mismo teléfono recibe
 * los avisos de todos los chicos/as que ese adulto tenga a cargo, que es cómo
 * lo espera una familia con dos hijos usando la app.
 */
@Entity('push_tokens')
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Token de Expo (`ExponentPushToken[...]`). Único en la tabla: si alguien
   * presta el teléfono y entra con otra cuenta, el token tiene que quedar
   * apuntando al último que lo usó y no mandarle los avisos al anterior.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  token: string;

  /** 'ios' | 'android' | 'web'. Sirve para diagnosticar cuando algo no llega. */
  @Column({ type: 'varchar', length: 16 })
  platform: string;

  /** Dueño del dispositivo: a él le llegan los avisos de los chicos/as a cargo. */
  @Index()
  @Column({ type: 'uuid' })
  caregiverId: string;

  @ManyToOne(() => Caregiver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'caregiverId' })
  caregiver: Caregiver;

  /**
   * Sesión de dispositivo que registró el token, si vino de un dispositivo
   * vinculado.
   *
   * Es lo que permite no mandarle el push al propio dispositivo del chico/a:
   * sin esto no habría forma de distinguir su tablet del teléfono de la madre,
   * porque las dos cuelgan del mismo cuidador.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  deviceSessionId: string | null;

  @ManyToOne(() => DeviceSession, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'deviceSessionId' })
  deviceSession: DeviceSession | null;

  /**
   * Última vez que la app confirmó este token. La app lo reenvía en cada
   * arranque, así que un token que no se refresca hace meses es de alguien que
   * desinstaló y se puede limpiar.
   */
  @Column({ type: timestampColumnType(), nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
