# Modelo de datos — Módulo 1

Las siete entidades centrales y por qué están modeladas así. Este documento es
material directo para el capítulo de diseño de la tesis: cada decisión de acá
es defendible ante un tribunal.

## Diagrama de relaciones

```
Caregiver (cuidador/terapeuta)
    │ 1..N
    ▼
User (perfil del niño/a)
    │ 1..1 ──────────────► AccessibilitySettings
    │ 1..N ──────────────► UsageLog
    │ 1..N
    ▼
Board (tablero)
    │ 1..N
    ▼
Category (categoría / tab)
    │ 1..N
    ▼
Pictogram ◄────── 0..N UsageLog
```

## Entidades

### Caregiver

Quien se autentica en la app: madre, padre, docente o terapeuta. Administra uno
o varios `User`.

- `passwordHash` y `therapistPinHash` llevan `select: false`: no salen en las
  consultas comunes, así no se filtran por accidente al serializar la entidad.
- `role` distingue `family` de `therapist`. El terapeuta accede además al
  historial y a los reportes del Módulo 6.

### User

El perfil del niño o la niña que usa el comunicador.

- Se guarda `birthDate` y no la edad. La edad se deriva con el getter `age`,
  porque un número de edad almacenado queda desactualizado solo.
- El borrado del cuidador arrastra a sus usuarios en cascada.

### Board

Un usuario puede tener varios tableros — por ejemplo uno para la escuela y otro
para casa — pero sólo uno predeterminado.

- Índice único `(userId, name)`: no puede haber dos tableros con el mismo
  nombre para el mismo usuario.
- La marca `isDefault` la administra `BoardsService` dentro de una transacción,
  para que nunca queden dos tableros predeterminados a la vez.

### Category

Se muestra como tab en el comunicador.

- `color` sigue la convención Fitzgerald Key, que muchos terapeutas ya usan:
  verde para acciones, naranja para sustantivos, azul para descriptores, rosa
  para expresiones sociales.
- `order` define la posición del tab.

### Pictogram

La celda que el usuario toca para comunicar.

- **Índice único `(categoryId, text)`.** Es la regla que pide el Módulo 1: el
  mismo concepto no se repite dentro de una categoría. La unicidad es por
  categoría y no por tablero a propósito: "agua" tiene sentido tanto en Comidas
  como en Necesidades, y obligar a elegir una sola ubicación empeoraría el
  tablero.
- El servicio valida el duplicado ignorando mayúsculas y espacios sobrantes
  (`LOWER(TRIM(...))`), porque "Agua" y "agua " son el mismo concepto para quien
  usa el tablero. El índice único de la base queda como última línea de defensa
  ante escrituras concurrentes.
- `audioUrl` nulo significa "usar el TTS"; con valor, se reproduce la voz
  grabada por la familia, que para muchos chicos funciona mejor que la sintética.
- `source` y `arasaacId` distinguen los pictogramas del banco ARASAAC de los
  creados por el cuidador (Módulo 4).

### AccessibilitySettings

Relación 1:1 con `User`, no un campo JSON dentro de `User`.

El motivo: cada parámetro se consulta y se edita por separado desde el panel del
terapeuta, y como columna queda validable a nivel base. Un JSON haría más
difícil, por ejemplo, consultar cuántos usuarios tienen activo el filtro
anti-temblor.

Los tres parámetros del filtro anti-temblor (Módulo 5):

| Campo             | Qué hace                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `holdToConfirmMs` | Milisegundos que hay que sostener el toque para confirmarlo        |
| `debounceMs`      | Ventana en la que se ignoran toques repetidos sobre la misma celda |
| `moveTolerancePx` | Píxeles de desplazamiento tolerados sin cancelar el toque          |

Son configurables por usuario porque el temblor varía mucho entre personas: un
valor fijo que sirva para todos no existe.

### UsageLog

Alimenta el historial y los reportes del Módulo 6. Tabla de sólo escritura desde
la app, que crece rápido.

Dos decisiones que conviene poder explicar:

- **`occurredAt` se envía desde el cliente**, no es un `CreateDateColumn`. Con
  el modo offline del Módulo 7 un registro puede sincronizarse horas después de
  haber ocurrido, y el reporte tiene que ubicarlo en el momento real de uso.
  `syncedAt` guarda cuándo llegó al servidor.
- **`pictogramId` usa `ON DELETE SET NULL`, no cascada.** Si el terapeuta borra
  un pictograma no queremos perder la evidencia de que fue usado: la fila
  sobrevive y `pictogramTextSnapshot` conserva el texto. Con cascada, borrar un
  pictograma reescribiría el historial hacia atrás y arruinaría el reporte de
  evolución.
- Índice compuesto `(userId, occurredAt)`: es el que sostiene las consultas por
  rango de fechas del Módulo 6.

## Tipos de columna según el motor

Producción y desarrollo corren sobre PostgreSQL; los tests de integración usan
SQLite en memoria para no depender de Docker. SQLite no soporta `enum` ni
`timestamptz`, así que [`src/common/column-types.ts`](../apps/api/src/common/column-types.ts)
elige el tipo equivalente según el driver activo.

La alternativa era declarar todo como `varchar`, pero eso le sacaría a
PostgreSQL la validación del enum a nivel base — justamente lo que queremos
conservar donde importa.

## Varios responsables por chico/a (Módulo 9, paso 3)

El modelo original del Doc daba un solo cuidador por perfil, y eso dejaba
afuera el caso normal: la madre y el padre cuidan al mismo chico/a, y muchas
veces también un hermano mayor, una abuela o la maestra. Con la relación
uno-a-muchos el segundo responsable tenía que compartir la cuenta del primero,
que además de incómodo mezcla en un solo login a personas distintas y hace
imposible saber después quién cambió qué.

```
Caregiver ◄──── N ProfileCaregiver N ────► User
                                    │
              CaregiverInvite ──────┘
```

### ProfileCaregiver

La tabla intermedia. Desde acá sale **el acceso**: `ProfileOwnershipService`,
el listado de perfiles, el editor, el buscador y la vinculación de dispositivos
cruzan por ella en vez de comparar `users.caregiverId`.

Todos los responsables pueden lo mismo, así que no hay columna de rol.
`relationship` ("Mamá", "Hermano") es sólo una etiqueta para distinguir quién
es quién en la lista.

`users.caregiverId` se conserva: sigue diciendo quién creó el perfil, que es un
dato real, y de ahí cuelga la cascada de borrado. Lo que cambió es que ya no
decide quién ve qué.

El índice único sobre (userId, caregiverId) evita filas repetidas —sumar dos
veces a la misma persona no significa nada distinto de sumarla una— y además es
el que resuelve la pregunta que se hace en cada request del editor.

### CaregiverInvite

El código con el que se suma a alguien. Se parece al `LinkCode` de
dispositivos, pero resuelve otra cosa: aquel enrola un aparato y le abre una
sesión, este suma a una persona que tiene su propia cuenta.

Vive 48 horas y no quince minutos: el de dispositivos se canjea con los dos
aparatos sobre la mesa, y este se manda por mensaje a alguien que capaz se
registra a la noche.

### Qué hay que recordar al migrar

La migración `MultipleCaregivers` hace un backfill: cada perfil existente queda
a cargo de quien lo creó. Sin ese `INSERT ... SELECT`, al terminar la migración
el acceso saldría de una tabla vacía y ninguna familia vería a su hijo/a al
abrir la app.

Revertirla descarta los responsables agregados, y es inevitable:
`users.caregiverId` guarda uno solo y no hay dónde poner a los demás.

## Vinculación de dispositivos (Módulo 9, paso 2)

La vinculación de dispositivos suma dos entidades que cuelgan de `Caregiver` y,
opcionalmente, de `User`. No forman parte del modelo del Doc: son del aporte
propio del Módulo 9.

```
Caregiver
    │ 1..N ──────────────► DeviceSession ──► 0..1 User
    │ 1..N ──────────────► LinkCode      ──► 0..1 User
```

### DeviceSession

La sesión permanente de un dispositivo enrolado. Existe porque el JWT de siete
días no sirve en el celular del chico/a: una vez por semana lo dejaría en el
login, y él no puede resolverlo.

De `refreshTokenHash` se guarda el hash y nunca el token, igual que con las
contraseñas. Es SHA-256 y no bcrypt, a diferencia del `passwordHash` del
cuidador: un refresh token son 32 bytes aleatorios, así que no hay diccionario
que lo adivine y el coste alto de bcrypt no compraría nada; además el hash
tiene que ser determinístico para buscar la sesión por índice, y con bcrypt
habría que recorrer la tabla entera.

`userId` es nulo en el dispositivo de un responsable, que elige perfil como
siempre, y apunta al perfil en el del chico/a, que abre directo en su tablero.

`revokedAt` marca la revocación en vez de borrar la fila: al cuidador le sirve
saber que ese acceso existió y cuándo terminó. `lastSeenAt` le permite
distinguir el dispositivo en uso del que perdió hace meses.

### LinkCode

El código de un solo uso con el que se enrola un dispositivo. A diferencia del
refresh token, acá el código se guarda en claro: vive quince minutos, sirve una
sola vez, y hay que poder mostrárselo al cuidador mientras está vigente por si
cerró la pantalla. Un hash impediría eso sin comprar seguridad real para una
ventana tan corta.

`failedAttempts` quema el código a los cinco intentos: seis caracteres sin
límite de intentos se rompen a fuerza bruta, con límite no. Se cuenta sólo
contra códigos que existen — sumarle intentos a códigos inventados no protege
nada y permitiría que un tercero quemara el código de otro tipeando cualquier
cosa.

## Qué está verificado por tests

Los tests de integración en
[`apps/api/test/entities.integration-spec.ts`](../apps/api/test/entities.integration-spec.ts)
corren contra una base real y verifican:

- La cadena completa cuidador → usuario → tablero → categoría → pictograma.
- Que no se pueda repetir un pictograma dentro de una categoría.
- Que sí se pueda repetir en categorías distintas.
- Que no haya dos tableros con el mismo nombre por usuario.
- Que borrar un cuidador borre en cascada todo su árbol.
- Que borrar un pictograma **no** borre su historial de uso.
- Los valores por defecto de accesibilidad.
- Que haya una sola configuración de accesibilidad por usuario.
- El cálculo de la edad a partir de la fecha de nacimiento.
