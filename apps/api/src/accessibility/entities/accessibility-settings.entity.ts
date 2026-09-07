import { ColorMode, GridSize, SPEECH_PITCH, SPEECH_RATE, TREMOR_FILTER } from '@vozaac/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { enumColumn, floatColumnType, timestampColumnType } from '../../common/column-types';

/**
 * Configuración de accesibilidad por usuario (Módulo 5).
 *
 * Es 1:1 con User y no un JSON dentro de User porque cada campo se consulta y
 * se edita por separado desde el panel del terapeuta, y así queda validable a
 * nivel de columna.
 */
@Entity('accessibility_settings')
export class AccessibilitySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.accessibilitySettings, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column(enumColumn(GridSize, { default: GridSize.GRID_2X3 }))
  gridSize: GridSize;

  @Column(enumColumn(ColorMode, { default: ColorMode.STANDARD }))
  colorMode: ColorMode;

  // --- Filtro anti-temblor (Módulo 5) ---

  @Column({ type: 'boolean', default: false })
  tremorFilterEnabled: boolean;

  /** Milisegundos de toque sostenido necesarios para confirmar la selección. */
  @Column({ type: 'int', default: TREMOR_FILTER.holdToConfirmMs.default })
  holdToConfirmMs: number;

  /** Ventana en la que se descartan toques repetidos sobre la misma celda. */
  @Column({ type: 'int', default: TREMOR_FILTER.debounceMs.default })
  debounceMs: number;

  /** Píxeles de movimiento tolerados sin cancelar el toque sostenido. */
  @Column({ type: 'int', default: TREMOR_FILTER.moveTolerancePx.default })
  moveTolerancePx: number;

  // --- Voz (Módulo 3 y 5) ---

  @Column({ type: floatColumnType(), default: SPEECH_RATE.default })
  speechRate: number;

  @Column({ type: floatColumnType(), default: SPEECH_PITCH.default })
  speechPitch: number;

  /** Identificador de voz del motor TTS del dispositivo; null usa la de sistema. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  voiceId: string | null;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
