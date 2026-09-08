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
| 3      | Tablero principal (comunicador)        | App Expo con grilla, frase y TTS       |
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
│   └── mobile/              App React Native (Expo)
│       ├── src/
│       │   ├── api/         Cliente HTTP de la API
│       │   ├── components/  Grilla, barra de frase, tabs
│       │   ├── screens/     Login, selector de perfil, comunicador
│       │   ├── state/       Frase, TTS, cola de uso, sesión
│       │   └── theme/       Paletas (incluye modo bajo estímulo)
│       └── test/            Tests de componentes
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

El seed deja un cuidador de demostración: `demo@vozaac.local` / `vozaac-demo`.

### App móvil

```bash
npm run mobile
```

Se abre Expo con un QR: escaneándolo desde Expo Go la app corre en el celular
o la tablet. Ojo con un detalle: desde un dispositivo real `localhost` es el
propio teléfono, así que hay que apuntar `expo.extra.apiUrl` de
[apps/mobile/app.json](apps/mobile/app.json) a la IP de la máquina en la red
local (por ejemplo `http://192.168.0.10:3010/api`).

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

Comunicador (Módulo 3). Todo cuelga de `/api/users/:userId/`, y en cada request
se valida que el perfil sea del cuidador del token.

| Método | Ruta                                 | Qué hace                                  |
| ------ | ------------------------------------ | ----------------------------------------- |
| GET    | `/api/users/:userId/boards`          | Tableros del perfil                       |
| GET    | `/api/users/:userId/boards/default`  | Tablero principal con categorías y pictos |
| GET    | `/api/users/:userId/boards/:boardId` | Un tablero con su contenido               |
| GET    | `/api/users/:userId/accessibility`   | Configuración (se crea con los defaults)  |
| POST   | `/api/users/:userId/usage`           | Registra un evento de uso                 |
| POST   | `/api/users/:userId/usage/batch`     | Registra un lote de eventos               |

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
npm run test --workspace @vozaac/mobile           # componentes de la app
npm run typecheck --workspace @vozaac/mobile      # tipos de la app
```

Los e2e del Módulo 2 levantan la app entera contra SQLite y ejercitan los
endpoints con supertest: login correcto e incorrecto, PIN correcto e
incorrecto, y que un cuidador no pueda ver los perfiles de otro. Los del
Módulo 3 hacen lo mismo con el tablero, la accesibilidad y el registro de uso.

Los del comunicador usan React Native Testing Library y cubren lo que pide el
Doc: que tocar un pictograma lo agregue a la frase y que "limpiar" la vacíe.
El TTS se mockea, así que verifican qué texto se mandó a decir sin depender
del motor de voz del dispositivo.

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
