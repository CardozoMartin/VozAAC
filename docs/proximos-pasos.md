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

247 tests en verde: 69 unitarios de la API, 85 e2e, 10 de integración y 83 de
la app.

Falta mergear a `main`: los Módulos 3, 4 y 5 viven en esta rama.

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
2. **Vinculación por código + sesión que no expira**
3. **Varios responsables por chico/a** — tabla intermedia cuidador–perfil
4. **Pictogramas urgentes + alertas** — primero sin push, después con push

### Tres bloqueantes técnicos

**El token dura 7 días** (`JWT_EXPIRES_IN=7d`). En el celular del chico/a eso
significa que una vez por semana la app lo saca al login, y él no puede
resolverlo. Un dispositivo vinculado necesita refresh token: sesión que se
renueva sola y sólo termina si alguien la revoca a propósito.

**Un perfil tiene un solo cuidador.** La relación es uno-a-muchos, así que hoy
el modelo no soporta que la madre y el padre vean al mismo chico/a. Hace falta
una tabla intermedia, y conviene migrarlo antes del piloto: hacerlo con datos
reales de familias encima es bastante peor.

**`Pictogram` no tiene campo de urgencia.** Es el más fácil de los tres.

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
