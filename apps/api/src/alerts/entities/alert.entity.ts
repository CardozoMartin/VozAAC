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
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { timestampColumnType } from '../../common/column-types';

/**
 * Aviso que dispara un pictograma urgente (Módulo 9, paso 4).
 *
 * Cuando el chico/a toca "me duele" o "me siento mal", se guarda una fila acá
 * y la app de cada responsable la levanta. Se arranca sin push a propósito:
 * así funciona en Expo Go, sin development build ni credenciales, y el
 * circuito queda probado entero para sumarle push encima sin rehacer nada.
 *
 * Es distinta de `UsageLog`, aunque el toque también quede registrado ahí.
 * UsageLog es material de reportes: crece rápido, nadie lo lee de a una fila y
 * se consulta agregado. Una alerta es un mensaje dirigido a personas, se lee
 * de a una y tiene estado —vista o no—. Meterlas en la misma tabla obligaría a
 * filtrar el historial entero cada veinte segundos para encontrar las pocas
 * filas que importan.
 */
@Entity('alerts')
// El índice compuesto sostiene la consulta que corre cada veinte segundos:
// las alertas de un chico/a, de la más nueva a la más vieja.
@Index(['userId', 'occurredAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Pictograma que la disparó. Se conserva la alerta si lo borran —de ahí el
   * SET NULL—, porque el responsable tiene que poder mirar después qué avisó
   * el chico/a aunque el tablero haya cambiado.
   */
  @Column({ type: 'uuid', nullable: true })
  pictogramId: string | null;

  @ManyToOne(() => Pictogram, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pictogramId' })
  pictogram: Pictogram | null;

  /**
   * Texto e imagen copiados al momento del aviso.
   *
   * Se duplican a propósito: si el terapeuta renombra el pictograma después,
   * la alerta tiene que seguir diciendo lo que el chico/a quiso decir esa
   * noche, no lo que hoy dice esa celda.
   */
  @Column({ type: 'varchar', length: 120 })
  pictogramText: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pictogramImageUrl: string | null;

  /**
   * Cuándo se tocó, según el dispositivo.
   *
   * Va aparte de createdAt porque el aviso puede llegar tarde —sin señal, o
   * con la app cerrada— y lo que importa es cuándo el chico/a lo tocó, no
   * cuándo el servidor se enteró.
   */
  @Column({ type: timestampColumnType() })
  occurredAt: Date;

  /** Cuándo alguien la marcó como vista, o null si sigue pendiente. */
  @Column({ type: timestampColumnType(), nullable: true })
  acknowledgedAt: Date | null;

  /**
   * Quién la marcó como vista.
   *
   * Con varios responsables importa: si la madre ya fue a ver al chico/a, el
   * padre necesita saberlo para no salir corriendo también.
   */
  @Column({ type: 'uuid', nullable: true })
  acknowledgedByCaregiverId: string | null;

  @ManyToOne(() => Caregiver, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'acknowledgedByCaregiverId' })
  acknowledgedBy: Caregiver | null;

  @CreateDateColumn({ type: timestampColumnType() })
  createdAt: Date;
}
