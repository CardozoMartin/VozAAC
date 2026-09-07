import { UsageEventType } from '@vozaac/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pictogram } from '../../pictograms/entities/pictogram.entity';
import { enumColumn, timestampColumnType } from '../../common/column-types';

/**
 * Registro de uso: alimenta el historial y los reportes del terapeuta
 * (Módulo 6).
 *
 * Es una tabla de sólo escritura desde la app: nunca se edita, y crece rápido.
 * El índice compuesto (userId, occurredAt) es el que sostiene las consultas
 * por rango de fechas.
 *
 * pictogramId es nullable y usa ON DELETE SET NULL a propósito: si el
 * terapeuta borra un pictograma no queremos perder el historial de que fue
 * usado, así que se conserva la fila con el texto en pictogramTextSnapshot.
 */
@Entity('usage_logs')
@Index(['userId', 'occurredAt'])
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.usageLogs, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  pictogramId: string | null;

  @ManyToOne(() => Pictogram, (pictogram) => pictogram.usageLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'pictogramId' })
  pictogram: Pictogram | null;

  /** Texto del pictograma al momento del uso; sobrevive a su borrado. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  pictogramTextSnapshot: string | null;

  @Column(enumColumn(UsageEventType))
  eventType: UsageEventType;

  /** Frase completa, cuando el evento es PHRASE_SPOKEN. */
  @Column({ type: 'text', nullable: true })
  phraseText: string | null;

  /**
   * Momento del uso en el dispositivo. Se envía desde el cliente y no se usa
   * CreateDateColumn porque con el modo offline (Módulo 7) el registro puede
   * sincronizarse horas después de haber ocurrido.
   */
  @Index()
  @Column({ type: timestampColumnType() })
  occurredAt: Date;

  @CreateDateColumn({ type: timestampColumnType() })
  syncedAt: Date;
}
