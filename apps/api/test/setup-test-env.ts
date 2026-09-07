// Debe ejecutarse antes de que se importen las entidades: los decoradores de
// TypeORM leen el driver al evaluarse el módulo (ver src/common/column-types.ts).
process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'sqlite';
