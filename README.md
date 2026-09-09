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
| 9      | Vinculación y alertas al responsable   | Completo — vinculación, responsables y alertas |

El plan del Módulo 9 y lo que sigue está en
[docs/proximos-pasos.md](docs/proximos-pasos.md).

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

El seed deja dos responsables del mismo chico/a, los dos con la contraseña
`vozaac-demo`: `demo@vozaac.local` (Terapeuta) y `familia@vozaac.local` (Mamá).
Son dos a propósito: entrar con una y con la otra y ver el mismo Mateo es lo
que muestra para qué sirve la tabla intermedia del Módulo 9.

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

Alertas de pictogramas urgentes (Módulo 9, paso 4). Cuando el chico/a toca "me
duele" o "me siento mal", les llega un aviso a todos sus responsables.

| Método | Ruta                             | Qué hace                              |
| ------ | -------------------------------- | ------------------------------------- |
| POST   | `/api/users/:userId/alerts`      | El chico/a avisa: emite la alerta     |
| GET    | `/api/alerts`                    | Bandeja del responsable               |
| GET    | `/api/alerts?pending=true`       | Sólo las que nadie atendió            |
| POST   | `/api/alerts/:id/acknowledge`    | Marca el aviso como visto             |

Sólo avisa lo urgente y corporal: dolor, me siento mal, angustia, miedo. Se
marca con `pictograms.isUrgent`, un puñado de celdas y no una categoría entera.
Un tablero nuevo trae marcados **"Ayuda" y "Dolor"**, que son los dos casos que
ninguna familia querría tener que descubrir configurando; el resto lo define
cada una con el uso.

**Pedir el baño no lleva marca.** Ya funciona con el tablero normal, porque es
comunicación con quien está al lado. Si todo notifica, las notificaciones se
vuelven ruido y el responsable las silencia — y ahí se pierden justo las que
importan. La API además rechaza con 400 un aviso por un pictograma sin marcar,
para que un error de la app no convierta cualquier toque en una notificación.

**Un pictograma urgente pide sostener más.** Reusa el hold del filtro
anti-temblor del Módulo 5: suma 700 ms al que ya tenga configurado, y fuerza
800 ms si el filtro está apagado. Un toque accidental que despierte a alguien a
las 3 AM hace que la función se desactive en una semana, y esta es la barrera
más barata contra eso — sin sumar un diálogo que el chico/a tendría que leer.

**El chico/a ve que su mensaje salió**, con un "Avisado ✓" que se limpia solo a
los pocos segundos. Si no lo viera, no sabría si sirvió de algo y lo tocaría
diez veces. Cuando falla se le dice que no salió: un "avisado" falso es peor
que nada, porque se queda esperando ayuda que nadie pidió.

La bandeja se consulta cada veinte segundos en vez de recibir push. Es a
propósito: así funciona en Expo Go, sin development build ni credenciales, y el
circuito queda probado entero para sumarle push encima sin rehacer nada. Más
adelante se puede sumar WhatsApp o SMS, que además llegan a responsables sin
smartphone.

El aviso guarda el texto y la imagen copiados del pictograma: si el terapeuta
lo renombra o lo borra después, el responsable tiene que poder seguir leyendo
qué avisó el chico/a esa noche.

Responsables de un chico/a (Módulo 9, paso 3). Un perfil puede estar a cargo de
varias personas —madre, padre, un hermano, la maestra—, cada una con su propia
cuenta.

| Método | Ruta                                     | Qué hace                            |
| ------ | ---------------------------------------- | ----------------------------------- |
| GET    | `/api/users/:id/caregivers`              | Quiénes están a cargo del chico/a   |
| POST   | `/api/users/:id/invites`                 | Genera el código para sumar a otro  |
| POST   | `/api/invites/accept`                    | Acepta una invitación               |
| DELETE | `/api/users/:id/caregivers/:caregiverId` | Quita a un responsable              |

**Todos pueden lo mismo**: ver el tablero, editarlo, invitar a otro y borrar el
perfil. No hay dueño ni invitados. Es lo que refleja cómo funciona una familia
—si la madre y el padre cuidan al mismo chico/a, los dos necesitan poder
arreglar el tablero un domingo a la noche— y evita tener que explicarle a
alguien por qué no puede hacer algo que la otra persona sí. El campo
`relationship` ("Mamá", "Hermano") es sólo una etiqueta para distinguir quién es
quién en la lista; no define permisos.

`/api/invites/accept` no cuelga de `/users/:id` porque quien acepta todavía no
ve ese perfil —ni siquiera sabe su id—: lo único que tiene es el código. Sí
exige estar autenticado, a diferencia del canje de dispositivos: el invitado ya
tiene su cuenta, y lo que falta es atarla al perfil.

No se puede quitar al último responsable: un perfil sin nadie a cargo quedaría
inaccesible para todos y sólo se recuperaría tocando la base a mano. Para
deshacerse del perfil está el borrado, que además limpia sus datos.

El acceso sale de la tabla `profile_caregivers` y ya no de `users.caregiverId`,
que se conserva sólo para saber quién creó el perfil. Eso alcanza a todo:
listar perfiles, el editor, el buscador y la vinculación de dispositivos.

Vinculación de dispositivos (Módulo 9). Es el aporte que va más allá del plan
del Doc: el padre configura el panel desde su celular y después enrola los
otros dispositivos —el del chico/a, el de otro responsable— con un código.

| Método | Ruta                       | Qué hace                                  |
| ------ | -------------------------- | ----------------------------------------- |
| POST   | `/api/devices/link-codes`  | Genera el código para enrolar otro equipo |
| POST   | `/api/devices/redeem`      | Canjea el código y abre la sesión         |
| POST   | `/api/devices/refresh`     | Renueva la sesión de un dispositivo       |
| GET    | `/api/devices`             | Dispositivos vinculados del cuidador      |
| DELETE | `/api/devices/:id`         | Revoca el acceso de un dispositivo        |

`redeem` y `refresh` son los dos únicos endpoints sin `Authorization`: quien
los llama todavía no tiene JWT, y su credencial es el código en un caso y el
refresh token en el otro.

El código se usa **una sola vez**, al enrolar, y no vuelve a aparecer nunca. Es
el patrón de Netflix o Spotify Connect, y no hay que confundirlo con el PIN del
modo terapeuta, que sí es una barrera de todos los días. Vive quince minutos, se
quema a los cinco intentos fallidos y usa un alfabeto sin caracteres que se
confundan al dictarlo por teléfono: sin O/0, sin I/1/L.

Esto existe porque el JWT de siete días no sirve en el celular del chico/a: una
vez por semana lo dejaría en la pantalla de login, y él no puede resolver eso.
Un dispositivo vinculado guarda además un refresh token, la app renueva la
sesión sola antes de que nadie lo note, y esa sesión no vence por tiempo:
termina sólo cuando un adulto la revoca desde su celular.

Del refresh token se guarda el hash, nunca el token, igual que con las
contraseñas. Es SHA-256 y no bcrypt: son 32 bytes aleatorios, no hay
diccionario que los adivine, así que el coste alto de bcrypt no compraría nada
y además impediría buscar la sesión por índice. El token se rota en cada
renovación, así que uno filtrado deja de servir apenas el dispositivo vuelve a
renovar.

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

Los del Módulo 9 recorren el circuito entero de vinculación: generar el código,
canjearlo, renovar la sesión y revocarla. El que más importa es el último —que
revocar corte de verdad la renovación—, porque es lo único que cierra el acceso
de un dispositivo perdido cuya sesión no vence por tiempo. Del lado de la app
se verifica que un 401 dispare la renovación y el reintento sin que el chico/a
vea nada, y que dos llamadas simultáneas compartan una sola renovación: como el
backend rota el token en cada uso, dos renovaciones a la vez cerrarían la
sesión sin motivo.

Los del paso 3 del Módulo 9 verifican el caso que motiva todo: la madre y el
padre, con cuentas distintas, viendo y editando el mismo tablero. Y del otro
lado, que alguien que no es responsable no vea nada —ni el perfil, ni la lista
de responsables, ni el tablero—, que sigue siendo la regla de privacidad
central del proyecto.

Los del paso 4 cubren el circuito entero —el chico/a avisa, les llega a todos
sus responsables, uno lo atiende y los demás ven quién fue— y sobre todo el
hold reforzado, que es lo que evita el aviso accidental: que un pictograma
urgente no se dispare con un toque, ni siquiera con el filtro anti-temblor
apagado.

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
