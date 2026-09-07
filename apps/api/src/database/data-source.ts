import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from '../config/database.config';

// El CLI de TypeORM corre fuera de Nest, así que carga el .env por su cuenta.
// En CI las variables ya vienen del entorno y el archivo no existe: en ese
// caso dotenv no se ejecuta y se usa lo que haya en process.env.
const envPath = resolve(__dirname, '../../../../.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

export default new DataSource(buildDataSourceOptions(process.env) as DataSourceOptions);
