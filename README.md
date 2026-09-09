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
| 4      | Editor de pictogramas (modo terapeuta) | CRUD, uploads, ARASAAC y editor listos |
| 5      | Accesibilidad configurable             | Filtro anti-temblor, grilla, voz y paleta |
| 6      | Historial y reportes                   | Entidad lista; agregaciones pendientes |
| 7      | Offline y sincronización               | Pendiente                              |
| 8      | Validación con usuarios reales         | Pendiente                              |

## Quién usa qué

Hay dos entidades y conviene no confundirlas. El **cuidador** (madre, padre,
terapeuta) es quien tiene cuenta con email y contraseña. El **perfil** es el
chico/a, y no tiene credenciales de ningún tipo.

Eso no es un atajo: quien usa un comunicador AAC muchas veces no lee ni
escribe, y pedirle una contraseña sería ponerle una barrera de texto delante de
su propia voz. El adulto se autentica una vez, la sesión queda guardada en el
dispositivo, y el chico/a entra tocando su foto en el selector.

```
El adulto, una vez            El chico/a, todos los días
──────────────────            ──────────────────────────
Se registra                   Abre la app
Crea el perfil                Toca su foto
Arma el vocabulario           Ya está en su tablero
Define un PIN
```

Por eso el PIN del modo terapeuta protege la **salida** hacia el editor y no la
entrada al comunicador: es para que el chico/a no desarme su propio vocabulario
sin querer, no para dejarlo afuera. Un cuidador puede tener varios perfiles
—una terapeuta con seis pacientes— y cada uno lleva su tablero, su vocabulario
y su configuración de accesibilidad.

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
o la tablet. La orientación queda libre y la grilla se acomoda al rotar: las
mismas celdas se reparten con el lado largo hacia donde la pantalla tiene
lugar, así que una 3x4 son cuatro columnas en la tablet apaisada y tres
columnas por cuatro filas en el celular vertical. La cantidad de pictogramas
no cambia nunca —eso lo eligió el terapeuta, y rotar el dispositivo no debería
agregar ni sacar vocabulario—. En vertical la barra de frase se apila para no
comerle ancho a los pictogramas.

Se probó primero en tablet, pero no la requiere: en un celular las grillas 2x2
y 2x3 —las pensadas para quien más dificultad motriz tiene— quedan cómodas, y
que funcione en el dispositivo que la familia ya tiene importa para el piloto.

La app encuentra sola la API: deriva la IP de la máquina que le está sirviendo
el bundle, que es la misma que corre el backend. No hay que configurar nada
mientras el celular y la computadora estén en la misma red WiFi.

Eso importa porque desde un dispositivo real `localhost` es el propio teléfono
y no la computadora, y esa IP además cambia cada vez que el router renueva el
DHCP. Para apuntar a otro lado —un backend desplegado, o un túnel— se pone la
URL en `expo.extra.apiUrl` de [apps/mobile/app.json](apps/mobile/app.json), que
tiene prioridad sobre la detección automática.

Si el celular no llega a la API, en orden: que ambos estén en el mismo WiFi (y
que no sea una red que aísle a los clientes entre sí, como suele pasar en las
de invitados); que el firewall de Windows deje entrar al puerto 3010 en el
perfil de red privada; y recién ahí, un túnel.

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
| POST   | `/api/users`           | Crea el perfil de un chico/a               |
| PATCH  | `/api/users/:id`       | Edita nombre, fecha o foto                 |
| DELETE | `/api/users/:id`       | Borra el perfil y todo su contenido        |

Un perfil nuevo no nace vacío: la creación deja además su configuración de
accesibilidad, un tablero por defecto y un vocabulario inicial de 27
pictogramas de ARASAAC en cinco categorías. Va todo en una transacción, porque
un perfil a medio armar dejaría al chico/a frente a una pantalla rota y no hay
forma de arreglarla desde la app. El vocabulario vive en
[starter-vocabulary.ts](apps/api/src/boards/starter-vocabulary.ts) y lo comparte
el seed, así que la demo muestra exactamente lo que ve una familia al crear el
suyo.

El `caregiverId` sale siempre del token y nunca del cuerpo: mandarlo en el body
devuelve 400. Si viniera de ahí, alguien podría crear perfiles colgados de la
cuenta de otra persona.

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

Editor del modo terapeuta (Módulo 4). Cada operación verifica que el recurso
cuelgue de un perfil del cuidador, siguiendo la cadena pictograma → categoría →
tablero → perfil.

| Método | Ruta                                      | Qué hace                           |
| ------ | ----------------------------------------- | ---------------------------------- |
| POST   | `/api/categories`                         | Crea una categoría                 |
| PATCH  | `/api/categories/:id`                     | Renombra o recolorea               |
| DELETE | `/api/categories/:id`                     | Borra la categoría y sus pictos    |
| GET    | `/api/boards/:boardId/categories`         | Categorías del tablero             |
| PATCH  | `/api/boards/:boardId/categories/reorder` | Reordena los tabs                  |
| POST   | `/api/pictograms`                         | Crea un pictograma                 |
| PATCH  | `/api/pictograms/:id`                     | Edita, o lo mueve de categoría     |
| DELETE | `/api/pictograms/:id`                     | Borra el pictograma y sus archivos |
| GET    | `/api/pictograms/search?q=`               | Buscador del editor                |
| GET    | `/api/categories/:id/pictograms`          | Pictogramas de la categoría        |
| PATCH  | `/api/categories/:id/pictograms/reorder`  | Reordena la grilla                 |
| POST   | `/api/uploads/image`                      | Sube una imagen (máx. 5 MB)        |
| POST   | `/api/uploads/audio`                      | Sube un audio (máx. 2 MB)          |
| GET    | `/api/arasaac/search?q=`                  | Busca en el banco ARASAAC          |

Accesibilidad (Módulo 5). La lectura ya existía desde el Módulo 3; acá se suma
la edición.

| Método | Ruta                               | Qué hace                            |
| ------ | ---------------------------------- | ----------------------------------- |
| PATCH  | `/api/users/:userId/accessibility` | Edita la configuración del perfil   |

El PATCH es parcial y crea la fila si todavía no existía: el terapeuta puede
entrar a los ajustes sin haber abierto nunca el comunicador, y ahí no habría
nada que actualizar. Los rangos que valida el DTO salen de las constantes de
`@vozaac/shared`, las mismas con las que la app dibuja los controles, así que
la app y la API no pueden discrepar sobre qué valor es válido.

Los archivos subidos se guardan en `UPLOAD_DIR` y se sirven bajo `/uploads`.
El nombre lo genera el servidor y nunca se usa el que manda el cliente: un
nombre como `../../.env` escaparía del directorio de subidas. Los pictogramas
de ARASAAC referencian la imagen en su CDN en vez de copiarla, así el tablero
no duplica miles de PNG.

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

Los del Módulo 4 verifican las validaciones de subida (formato y tamaño, más
que un nombre de archivo no pueda escapar del directorio) y el aislamiento del
borrador del editor: que agregar, editar o borrar no escriban nada hasta
"Guardar cambios".

Los del Módulo 5 son los que pide el Doc para el filtro anti-temblor: simulan
toques rápidos contra toques sostenidos y verifican que sólo los segundos
lleguen a la frase. Usan los fake timers de Jest, así que corren en
milisegundos y no dependen de la carga de la máquina —conviene para mostrarlos
en vivo en la defensa:

```bash
npm run test --workspace @vozaac/mobile -- tremor-filter
```

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
