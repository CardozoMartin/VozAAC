# Próximos pasos

Estado al 15 de septiembre de 2026, rama `dev`.

## Dónde quedamos

Los Módulos 1 al 5 están terminados, y además se cerró el arranque de la app
—registro y alta de perfiles—, que no estaba en el plan del Doc pero faltaba
para que una familia pudiera usar el proyecto sin tocar la base a mano.

| Commit    | Qué cierra                                        |
| --------- | ------------------------------------------------- |
| `041a5ad` | Módulo 4 — editor de pictogramas                  |
| `02f88ff` | Módulo 5 — accesibilidad configurable             |
| `bc7cb9f` | Orientación libre: la app corre en celular        |
| `dfed24a` | La app encuentra sola la IP de la API             |
| `6ee3efb` | Registro y alta de perfiles desde la app          |
| `92519a3` | Tokens visuales en un solo lugar                  |
| `eede357` | Última pantalla migrada a los tokens              |

El Módulo 9 está completo: vinculación por código con sesión que no expira,
varios responsables por chico/a, alertas de pictogramas urgentes y
notificaciones push a los responsables vinculados.

387 tests en verde: 98 unitarios de la API, 149 e2e, 10 de integración y 130
de la app. Corridos sobre `dev` el 15 de septiembre, después de sumar el push:
los e2e de vinculación siguen pasando con las dos rutas nuevas de
`/devices/push-token`, que era el riesgo de tocar ese controller.

## Ramas

`dev` integra todo y es donde se trabaja. `main` sigue en el Módulo 1 y recibe
el merge recién cuando salga la primera versión completa, así que no refleja el
estado del proyecto. `feature/pitogramas` ya está en `dev` desde el PR #2 y no
tiene nada pendiente.

## Tokens visuales

Los cinco commits de `92519a3` a `eede357` sacaron los estilos repetidos de
cada pantalla y los centralizaron en `apps/mobile/src/theme/`. Todas las
pantallas y componentes los usan.

Importa para lo que viene: el modo bajo estímulo del Módulo 5 y los gráficos
del Módulo 6 necesitan una paleta coherente, y con los colores desperdigados
en veinte archivos cada cambio era una recorrida a mano.

## Correr la app sin un dispositivo

`npm run web --workspace @vozaac/mobile` levanta la app en el navegador. Sirve
cuando el celular no puede alcanzar la PC —redes de invitados, o una escuela
que aísla los clientes entre sí— y para revisar la interfaz rápido.

No reemplaza la prueba en el dispositivo: el TTS usa las voces del navegador,
que no son las del celular, y el toque con mouse no se parece al de un chico/a
con dificultades motrices. Para eso, o misma red, o un túnel.

## Módulo 9 — Vinculación de dispositivos y alertas

Idea propia, fuera del plan del Doc. Se presenta en la tesis como aporte más
allá del plan original.

El padre se registra desde su celular, configura el panel del hijo, y después
vincula otros dispositivos con un código: el celular del chico/a, y el de otro
responsable. La sesión en esos dispositivos no se cierra nunca. Cuando el
chico/a toca "me duele" o "me siento mal", les llega una notificación.

El código de vinculación **no es una barrera diaria**: se usa una vez al
enrolar el dispositivo y no vuelve a aparecer. Es el patrón de Netflix o
Spotify Connect, y es distinto del PIN del modo terapeuta, que protege la
salida al editor.

### Orden de trabajo

1. ~~Registro, alta de perfiles y restaurar la sesión~~ — hecho en `6ee3efb`
2. ~~Vinculación por código + sesión que no expira~~ — hecho
3. ~~Varios responsables por chico/a~~ — hecho
4. ~~Pictogramas urgentes + alertas~~ — hecho
5. ~~Notificaciones push a los responsables vinculados~~ — hecho

### Cómo quedó la vinculación

El cuidador genera un código de 6 caracteres desde su celular
(`POST /api/devices/link-codes`), lo dicta, y en el otro dispositivo se canjea
(`POST /api/devices/redeem`). Ese canje deja una `DeviceSession` con un refresh
token que no vence por tiempo: la app renueva sola con
`POST /api/devices/refresh`, y la sesión termina sólo cuando alguien la revoca
desde la pantalla de dispositivos.

Dos detalles que valen para la defensa: el código usa un alfabeto sin O/0 ni
I/1/L porque se dicta en voz alta, y del refresh token se guarda el hash
—SHA-256, no bcrypt: son 32 bytes aleatorios, no hay diccionario que los
adivine, y el hash tiene que ser determinístico para buscar la sesión por
índice—.

En el dispositivo de un chico/a la app además esconde la salida al selector de
perfiles: su perfil quedó fijado al vincularlo, y una puerta que él no sabe
deshacer sólo lo dejaría afuera de su comunicador.

### Cómo quedaron los responsables

Cualquier responsable genera un código desde la pantalla de responsables
(`POST /api/users/:id/invites`). La otra persona crea su cuenta en la app,
entra al selector de perfiles, toca "Tengo una invitación" y lo escribe. Desde
ahí ve y edita el mismo tablero.

Todos pueden lo mismo, incluido invitar y borrar el perfil. No hay dueño ni
invitados: si la madre y el padre cuidan al mismo chico/a, los dos necesitan
poder arreglar el tablero un domingo a la noche, y un modelo con niveles
obligaría a explicarle a alguien por qué no puede hacer algo que la otra
persona sí. Lo único que no se permite es quitar al último responsable, porque
dejaría el perfil inaccesible para todos.

El acceso pasó a salir de `profile_caregivers`. `users.caregiverId` se conserva
para saber quién creó el perfil, y la migración hace el backfill: cada perfil
existente queda a cargo de quien lo creó.

El seed ahora deja dos responsables del mismo Mateo, `demo@vozaac.local` y
`familia@vozaac.local`, las dos con `vozaac-demo`. Entrar con una y con la otra
es la forma más rápida de mostrar esto en la defensa.

### Cómo quedaron las alertas

El terapeuta marca un pictograma con "Avisa" desde el editor. Cuando el chico/a
lo sostiene, sale el aviso (`POST /api/users/:userId/alerts`) y le aparece a
todos sus responsables en la bandeja, que consulta cada veinte segundos. El
primero que lo atiende queda registrado, así los demás saben que alguien ya
fue.

Un tablero nuevo trae "Ayuda" y "Dolor" ya marcados. El resto lo define cada
familia con el uso — que es justo lo que conviene preguntar en el piloto.

Las dos decisiones que deciden si esto sobrevive al uso real están cubiertas:
el pictograma urgente pide sostener 700 ms más que uno común (800 ms si el
filtro anti-temblor está apagado), y el chico/a ve un "Avisado ✓" que se limpia
solo a los pocos segundos.

### Los tres bloqueantes, resueltos

~~**El token dura 7 días.**~~ Un dispositivo vinculado renueva su sesión solo y
ya no vuelve nunca al login.

~~**Un perfil tiene un solo cuidador.**~~ Resuelto con `profile_caregivers`, y
migrado antes del piloto como convenía.

~~**`Pictogram` no tiene campo de urgencia.**~~ Resuelto con `isUrgent`.

### Cómo quedaron las notificaciones push

Cuando el chico/a toca un pictograma urgente, el aviso sale por push a **todos
los responsables vinculados al perfil** —la madre que creó la cuenta, el padre,
la hermana— en todos sus dispositivos. El envío va por la Expo Push API, que
resuelve Android e iOS con un solo token y sin guardar credenciales de Google ni
de Apple en este backend.

El dispositivo del propio chico/a queda excluido. Es menos obvio de lo que
parece: su tablet cuelga del cuidador que la enroló, así que sin distinguirla
recibiría su propio aviso de dolor como si alguien le estuviera hablando. La
exclusión se hace por `deviceSessionId`, que la app guarda al vincularse y
restaura en cada arranque.

**El polling de veinte segundos sigue existiendo y es la red de seguridad.** Si
el push no sale —permiso denegado, token vencido, Expo caído— el aviso igual
aparece cuando el responsable abre la app. El envío es best-effort a propósito:
nunca hace fallar el `POST` del chico/a, porque desde su lado el aviso sí salió.
El estado del registro se le muestra al adulto en la bandeja, porque uno que
cree que le van a sonar los avisos y no le suenan está peor que uno que sabe que
tiene que entrar a mirar.

Los tokens muertos se dan de baja solos cuando Expo contesta
`DeviceNotRegistered`, que es el único error que se arregla borrando. Un rate
limit o un problema de Expo son transitorios y no le cuestan el token a nadie.

### Lo que falta antes de poder probar el push en un teléfono

Nada de esto es código: el circuito está implementado y verificado contra la
base. Son pasos de configuración que hay que hacer una vez.

1. **Cuenta de Expo y `projectId` de EAS.** `npx eas init` dentro de
   `apps/mobile` deja el `projectId` en `app.json`. El hook ya lo lee de
   `Constants.expoConfig.extra.eas.projectId`, así que no hay que tocar código.
2. **Development build.** Expo Go no recibe push remotas desde el SDK 53. Con
   `npx eas build --platform android --profile development` sale el APK; en la
   nube son entre diez y veinte minutos de cola, o local con
   `--local` porque el SDK de Android ya está configurado en esta máquina.
3. **Credenciales de FCM.** EAS las genera y sube solo durante el build; sólo
   hace falta intervenir si se quiere usar un proyecto de Firebase propio.
4. **API alcanzable desde el teléfono.** Hoy la API corre en `localhost:3010`.
   Para un teléfono real hace falta que esté en la misma red —y que la red no
   aísle los clientes— o un túnel.

**Con un solo celular alcanza.** El chico/a no necesita ser un dispositivo
físico: el aviso se dispara desde el emulador, la web o un `curl` a la API, y el
push llega al teléfono del cuidador. Dos celulares sirven para la demo de la
defensa —la tablet del chico/a y el teléfono de la madre lado a lado— pero no
agregan nada técnico.

### Lo que queda del Módulo 9

**WhatsApp o SMS.** Es el paso siguiente y llega a responsables sin smartphone,
que en una familia extendida es un caso real y no un detalle.

### Criterio: qué avisa y qué no

Sólo lo urgente y corporal: dolor, me siento mal, angustia, miedo. Un puñado de
pictogramas marcados, no una categoría entera.

Pedir el baño **no** genera alerta: ya funciona con el tablero normal, porque
es comunicación con quien está al lado. Si todo notifica, las notificaciones se
vuelven ruido y el responsable las silencia — y ahí se pierden justo las que
importan.

Dos detalles que deciden si la función sobrevive al uso real:

- **Confirmación antes de enviar.** Un toque accidental que despierte a alguien
  a las 3 AM hace que la función se desactive en una semana. El hold del filtro
  anti-temblor del Módulo 5 ya sirve para esto: un pictograma urgente pide
  sostener más que uno común.
- **El chico/a tiene que ver que su mensaje salió**, con un "avisado ✓". Si no,
  no sabe si sirvió de algo y lo va a tocar diez veces.

## Diseño de las pantallas

Las diez pantallas están descriptas en
[prompt-diseno-pantallas.md](prompt-diseno-pantallas.md), pensado para pasarle
a una herramienta de diseño. Conviene pedirlas de a una o dos, y empezar por el
comunicador: es la que define el sistema visual y las demás se acomodan a ella.

Ese documento arrastra las restricciones que no se pueden negociar —áreas
táctiles grandes, nada de gestos, sin animaciones decorativas— porque las
herramientas de diseño optimizan por lo que se ve lindo en una captura y no por
lo que funciona en la mano de un chico/a con dificultades motrices.

## Después

- **Módulo 6** — historial y reportes. Las agregaciones usan funciones propias
  de PostgreSQL, así que van a necesitar la base de test de `docker-compose`
  (puerto 5443) y no SQLite.
- **Módulo 7** — offline y sincronización.
- **Módulo 8** — validación con familias o una escuela.

Para el piloto conviene tener en cuenta que muchas redes de escuela aíslan los
clientes entre sí, así que ahí sí puede hacer falta un túnel.

## Dos cosas para preguntar en el piloto

- **Qué avisaría el chico/a si pudiera avisar.** La lista que den las familias
  va a ser mejor que cualquiera definida desde el escritorio.
- **Si el hold de 300 ms del filtro anti-temblor queda corto o largo**, y si la
  grilla 4x5 en vertical es usable en un celular o ya es demasiado apretada.
