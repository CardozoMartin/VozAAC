# Próximos pasos

Estado al 14 de septiembre de 2026, rama `dev`.

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
varios responsables por chico/a, y alertas de pictogramas urgentes.

378 tests en verde: 89 unitarios de la API, 149 e2e, 10 de integración y 130 de
la app. Corridos sobre `dev` el 14 de septiembre, después de la migración de
tokens: ninguna pantalla se rompió al cambiar de estilos sueltos a tokens.

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
4. ~~Pictogramas urgentes + alertas~~ — hecho, sin push

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

### Lo que queda del Módulo 9

**Push de verdad.** Hoy la app consulta cada veinte segundos, así que con la
app cerrada el aviso no suena. Alcanza para el piloto y deja el circuito
probado, pero para uso real hace falta un development build con credenciales de
Expo. **WhatsApp o SMS** sería el paso siguiente, y además llega a responsables
sin smartphone.

### Cómo llegan las alertas

Se arranca sin push: las alertas se guardan en el backend y la app del
responsable las consulta. Funciona en Expo Go, sin development build ni
credenciales, y deja el circuito completo probado para sumarle push encima sin
rehacer nada. Expo Go no recibe notificaciones push reales.

Más adelante se puede sumar WhatsApp o SMS, que además llegan a responsables
sin smartphone.

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
