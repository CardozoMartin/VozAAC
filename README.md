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
| 2      | Autenticación y perfiles               | JWT, PIN y aislamiento listos          |
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

La API queda en `http://localhost:3010/api`.

## Endpoints

Autenticación (Módulo 2). Todo lo que no sea `register` o `login` necesita el
header `Authorization: Bearer <token>`.

| Método | Ruta                   | Qué hace                                   |
| ------ | ---------------------- | ------------------------------------------ |
| POST   | `/api/auth/register`   | Crea un cuidador y devuelve el token       |
| POST   | `/api/auth/login`      | Valida credenciales y devuelve el token    |
| GET    | `/api/auth/me`         | Datos del cuidador autenticado             |
| GET    | `/api/auth/pin`        | Si ya configuró el PIN del modo terapeuta  |
| PUT    | `/api/auth/pin`        | Define o reemplaza el PIN                  |
| POST   | `/api/auth/pin/verify` | Verifica el PIN                            |
| GET    | `/api/users`           | Perfiles del cuidador (selector de perfil) |
| GET    | `/api/users/:id`       | Un perfil, solo si es del cuidador         |

Dos decisiones que vale la pena señalar, porque son de privacidad y no de
comodidad:

- Login y registro responden lo mismo ante un email inexistente que ante una
  contraseña incorrecta. Distinguirlos permitiría averiguar qué familias tienen
  cuenta.
- Pedir el perfil de otro cuidador devuelve 404, no 403. Un 403 confirmaría que
  ese perfil existe, y son datos de salud de menores.

El PIN no emite un token propio: es la barrera para que el chico/a no entre al
editor sin querer, no una segunda autenticación. Por eso un PIN incorrecto
devuelve `200 {"valid": false}` y no un 401 — el cuidador sigue con su sesión
válida, solo se equivocó al tipear.

## Tests

```bash
npm test                                          # todo el monorepo
npm run test --workspace @vozaac/api              # unitarios (servicios)
npm run test:integration --workspace @vozaac/api  # integración (repositorios)
npm run test:e2e --workspace @vozaac/api          # e2e (endpoints con supertest)
npm run test:cov --workspace @vozaac/api          # con cobertura
```

Los e2e del Módulo 2 levantan la app entera contra SQLite y ejercitan los
endpoints con supertest: login correcto e incorrecto, PIN correcto e
incorrecto, y que un cuidador no pueda ver los perfiles de otro.

Los tests unitarios mockean los repositorios y verifican reglas de negocio. Los
de integración corren contra SQLite en memoria, así que no necesitan Docker:
validan relaciones, cascadas e índices únicos. Las agregaciones del Módulo 6,
que usan funciones propias de PostgreSQL, van a necesitar la base de test de
`docker-compose` (puerto 5443).

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
