import { PictogramSource } from '@vozaac/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { UsageLog } from '../../usage/entities/usage-log.entity';
import { enumColumn, timestampColumnType } from '../../common/column-types';

/**
 * Pictograma: la celda que el usuario toca para comunicar (Módulo 1 y 4).
 *
 * El índice único sobre (categoryId, text) es la regla de negocio que pide el
 * Módulo 1: el mismo concepto no se repite dentro de una categoría. Sí puede
 * aparecer en categorías distintas —"agua" tiene sentido en Comidas y en
 * Necesidades— y por eso la unicidad no es a nivel tablero.
 */
@Entity('pictograms')
@Index(['categoryId', 'text'], { unique: true })
export class Pictogram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Texto que se pronuncia y se muestra bajo la imagen. */
  @Column({ type: 'varchar', length: 120 })
  text: string;

  @Column({ type: 'varchar', length: 500 })
  imageUrl: string;

  /** Audio propio grabado por el cuidador; si es null se usa el TTS. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  audioUrl: string | null;

  @Column(enumColumn(PictogramSource, { default: PictogramSource.CUSTOM }))
  source: PictogramSource;

  /** Identificador en el banco ARASAAC, cuando el pictograma vino de ahí. */
  @Column({ type: 'int', nullable: true })
  arasaacId: number | null;

  /** Posición dentro de la grilla de su categoría. */
  @Column({ type: 'int', default: 0 })
  order: number;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.pictograms, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => UsageLog, (log) => log.pictogram)
  usageLogs: UsageLog[];

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
