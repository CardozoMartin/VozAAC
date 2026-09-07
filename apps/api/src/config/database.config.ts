import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Opciones de conexión leídas del entorno.
 *
 * synchronize queda siempre en false: el esquema se versiona con migraciones,
 * también en desarrollo, para que la migración inicial sea la fuente de verdad
 * y no haya sorpresas al desplegar.
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: parseInt(env.DB_PORT ?? '5432', 10),
    username: env.DB_USER ?? 'vozaac',
    password: env.DB_PASSWORD ?? 'vozaac_dev',
    database: env.DB_NAME ?? 'vozaac',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
}
