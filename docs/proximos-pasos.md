# Próximos pasos

Estado al 9 de septiembre de 2026, rama `feature/pitogramas`.

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

Del Módulo 9 están hechos los pasos 2 y 3: vinculación por código con sesión
que no expira, y varios responsables por chico/a.

344 tests en verde: 89 unitarios de la API, 132 e2e, 10 de integración y 113 de
la app.

Falta mergear a `main`: los Módulos 3, 4, 5 y 9 viven en esta rama.

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
4. **Pictogramas urgentes + alertas** — primero sin push, después con push

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

### El bloqueante que queda

~~**El token dura 7 días.**~~ Resuelto: un dispositivo vinculado renueva su
sesión solo y ya no vuelve nunca al login.

~~**Un perfil tiene un solo cuidador.**~~ Resuelto con `profile_caregivers`, y
migrado antes del piloto como convenía.

**`Pictogram` no tiene campo de urgencia.** Es lo único que falta para el paso
4, y es el más fácil de los tres.

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
