import { DataSource } from 'typeorm';
import { Caregiver } from '../src/caregivers/entities/caregiver.entity';
import { User } from '../src/users/entities/user.entity';
import { Board } from '../src/boards/entities/board.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Pictogram } from '../src/pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../src/accessibility/entities/accessibility-settings.entity';
import { UsageLog } from '../src/usage/entities/usage-log.entity';
import { DeviceSession } from '../src/devices/entities/device-session.entity';
import { LinkCode } from '../src/devices/entities/link-code.entity';

export const TEST_ENTITIES = [
  Caregiver,
  User,
  Board,
  Category,
  Pictogram,
  AccessibilitySettings,
  UsageLog,
  DeviceSession,
  LinkCode,
];

/**
 * Base de test en memoria.
 *
 * SQLite corre sin infraestructura, así que los tests de integración andan en
 * cualquier máquina y en CI sin levantar Docker. Para lo que el Módulo 1 tiene
 * que verificar —relaciones, cascadas e índices únicos— alcanza. Las consultas
 * de agregación del Módulo 6, que usan funciones propias de Postgres, van a
 * necesitar la base de test de docker-compose (puerto 5443).
 *
 * synchronize: true acá es correcto: la base se crea y se descarta en cada
 * corrida, no hay esquema que preservar.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: TEST_ENTITIES,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await dataSource.initialize();
  // SQLite no aplica las claves foráneas si no se lo pide explícitamente,
  // y sin esto las cascadas ON DELETE no se probarían de verdad.
  await dataSource.query('PRAGMA foreign_keys = ON');
  return dataSource;
}
