/**
 * Tipos de columna que dependen del motor de base de datos.
 *
 * En producción y desarrollo corremos sobre PostgreSQL, pero los tests de
 * integración usan SQLite en memoria para no depender de Docker. SQLite no
 * soporta `enum` ni `timestamptz`, así que estas funciones eligen el tipo
 * equivalente según el driver activo.
 *
 * La alternativa —declarar las columnas como varchar en todos lados— haría
 * que Postgres perdiera la validación del enum a nivel base, que es
 * justamente lo que queremos conservar en la base real.
 */

const isTestDatabase = process.env.DB_DRIVER === 'sqlite' || process.env.NODE_ENV === 'test';

/** 'enum' en Postgres, 'varchar' en SQLite. */
export function enumColumnType(): 'enum' | 'varchar' {
  return isTestDatabase ? 'varchar' : 'enum';
}

/**
 * Opciones de una columna de enum, listas para expandir dentro del decorador
 * `@Column`. En SQLite omite la lista de valores, que el driver no acepta.
 */
export function enumColumn<T extends object>(
  enumType: T,
  options: { default?: unknown; nullable?: boolean } = {},
): Record<string, unknown> {
  if (isTestDatabase) {
    return { type: 'varchar', length: 40, ...options };
  }
  return { type: 'enum', enum: enumType, ...options };
}

/** 'timestamptz' en Postgres, 'datetime' en SQLite. */
export function timestampColumnType(): 'timestamptz' | 'datetime' {
  return isTestDatabase ? 'datetime' : 'timestamptz';
}

/** 'float' en Postgres, 'real' en SQLite. */
export function floatColumnType(): 'float' | 'real' {
  return isTestDatabase ? 'real' : 'float';
}
