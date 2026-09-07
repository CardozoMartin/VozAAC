import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { Board } from '../../boards/entities/board.entity';
import { AccessibilitySettings } from '../../accessibility/entities/accessibility-settings.entity';
import { UsageLog } from '../../usage/entities/usage-log.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Perfil del niño/a que usa el comunicador (Módulo 1).
 *
 * Se guarda la fecha de nacimiento y no la edad: la edad se deriva, así no
 * queda un dato desactualizado en la base.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Index()
  @Column({ type: 'uuid' })
  caregiverId: string;

  @ManyToOne(() => Caregiver, (caregiver) => caregiver.users, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'caregiverId' })
  caregiver: Caregiver;

  @OneToMany(() => Board, (board) => board.user, { cascade: true })
  boards: Board[];

  @OneToOne(() => AccessibilitySettings, (settings) => settings.user, { cascade: true })
  accessibilitySettings: AccessibilitySettings;

  @OneToMany(() => UsageLog, (log) => log.user)
  usageLogs: UsageLog[];

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;

  /** Edad en años cumplidos, derivada de birthDate. */
  get age(): number | null {
    if (!this.birthDate) return null;
    const birth = new Date(this.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  }
}
