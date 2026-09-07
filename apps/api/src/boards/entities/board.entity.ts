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
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Tablero de comunicación: el conjunto de categorías y pictogramas que ve
 * un usuario (Módulo 1). Un usuario puede tener varios tableros —por ejemplo
 * uno para la escuela y otro para casa— pero sólo uno es el predeterminado.
 */
@Entity('boards')
@Index(['userId', 'name'], { unique: true })
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.boards, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Category, (category) => category.board, { cascade: true })
  categories: Category[];

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: timestampColumnType() })
  updatedAt: Date;
}
