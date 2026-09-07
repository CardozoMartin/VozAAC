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
import { Board } from '../../boards/entities/board.entity';
import { Pictogram } from '../../pictograms/entities/pictogram.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Categoría del tablero: se muestra como tab en el comunicador (Módulo 3).
 * El color se usa para el borde de las celdas, siguiendo la convención
 * Fitzgerald Key que ya conocen muchos terapeutas.
 */
@Entity('categories')
@Index(['boardId', 'name'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Color hexadecimal, formato #RRGGBB. */
  @Column({ type: 'varchar', length: 7, default: '#4A90D9' })
  color: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  icon: string | null;

  /** Posición del tab dentro del tablero. */
  @Column({ type: 'int', default: 0 })
  order: number;

  @Index()
  @Column({ type: 'uuid' })
  boardId: string;

  @ManyToOne(() => Board, (board) => board.categories, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'boardId' })
  board: Board;

  @OneToMany(() => Pictogram, (pictogram) => pictogram.category, { cascade: true })
  pictograms: Pictogram[];

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
