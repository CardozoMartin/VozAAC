# VozAAC

Comunicador AAC (Comunicación Aumentativa y Alternativa) para niños y niñas con
necesidades complejas de comunicación. Permite construir frases tocando
pictogramas y reproducirlas con síntesis de voz, y le da al terapeuta o a la
familia un panel para armar el vocabulario y seguir su evolución.

Proyecto de tesis. El plan completo por módulos está en [Doc.txt](Doc.txt).

## Estado

| Módulo | Qué incluye                            | Estado                                 |
| ------ | -------------------------------------- | -------------------------------------- |
| 1      | Modelo de datos y backend base         | Entidades, migración y tests listos    |
| 2      | Autenticación y perfiles               | Pendiente                              |
| 3      | Tablero principal (comunicador)        | Pendiente                              |
| 4      | Editor de pictogramas (modo terapeuta) | Pendiente                              |
| 5      | Accesibilidad configurable             | Campos en la base; lógica pendiente    |
| 6      | Historial y reportes                   | Entidad lista; agregaciones pendientes |
| 7      | Offline y sincronización               | Pendiente                              |
| 8      | Validación con usuarios reales         | Pendiente                              |

## Estructura

```
VozAAC/
├── apps/
│   ├── api/                 API REST — NestJS + TypeORM + PostgreSQL
│   │   ├── src/
│   │   │   ├── caregivers/  Cuidadores y terapeutas
│   │   │   ├── users/       Perfiles de los chicos/as
│   │   │   ├── boards/      Tableros
│   │   │   ├── categories/  Categorías (tabs del comunicador)
│   │   │   ├── pictograms/  Pictogramas
│   │   │   ├── accessibility/  Configuración por usuario
│   │   │   ├── usage/       Registro de uso para reportes
│   │   │   ├── database/    Migraciones y seeds
│   │   │   └── common/      Utilidades compartidas
│   │   └── test/            Tests de integración y e2e
│   └── mobile/              App React Native (Expo) — por crear
├── packages/
│   └── shared/              Tipos, enums y constantes compartidos
├── docs/                    Documentación del proyecto
└── docker-compose.yml       PostgreSQL de desarrollo y de test
```

## Puesta en marcha

Requisitos: Node 22+, Docker Desktop.

```bash
# 1. Instalar dependencias de todo el monorepo
npm install

# 2. Crear el archivo de entorno
cp .env.example .env

# 3. Levantar PostgreSQL
npm run db:up

# 4. Crear el esquema
npm run migration:run --workspace @vozaac/api

# 5. Cargar datos de ejemplo (opcional, útil para la demo)
npm run seed --workspace @vozaac/api

# 6. Arrancar la API en modo desarrollo
npm run api
```

La API queda en `http://localhost:3000/api`.

## Tests

```bash
npm test                                          # todo el monorepo
npm run test --workspace @vozaac/api              # unitarios (servicios)
npm run test:integration --workspace @vozaac/api  # integración (repositorios)
npm run test:cov --workspace @vozaac/api          # con cobertura
```

Los tests unitarios mockean los repositorios y verifican reglas de negocio. Los
de integración corren contra SQLite en memoria, así que no necesitan Docker:
validan relaciones, cascadas e índices únicos. Las agregaciones del Módulo 6,
que usan funciones propias de PostgreSQL, van a necesitar la base de test de
`docker-compose` (puerto 5433).

## Migraciones

El esquema se versiona con migraciones, también en desarrollo: `synchronize`
está en `false` siempre, para que la migración sea la única fuente de verdad.

```bash
# Generar una migración a partir de cambios en las entidades
npm run migration:generate --workspace @vozaac/api -- src/database/migrations/NombreDelCambio

npm run migration:run --workspace @vozaac/api
npm run migration:revert --workspace @vozaac/api
```

## Modelo de datos

Las siete entidades del Módulo 1 y las decisiones detrás de ellas están
documentadas en [docs/modelo-de-datos.md](docs/modelo-de-datos.md).

## Licencia

MIT
