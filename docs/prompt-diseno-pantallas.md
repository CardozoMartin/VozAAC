# Prompt de diseño — pantallas de VozAAC

Documento para pasarle a una herramienta de diseño (Stitch, Figma AI, v0 o
similar). Describe las diez pantallas que ya existen en la app, con lo que cada
una tiene que resolver.

**Cómo usarlo:** pegar la sección "Contexto" y "Sistema visual" primero, y
después la pantalla que se quiera diseñar. No conviene pedir las diez de una:
salen mejor de a una o dos, y así se puede corregir el rumbo antes de que la
herramienta repita un error en todas.

Al final hay una sección de **restricciones que no se pueden romper**. Esa
conviene repetirla en cada pedido, porque las herramientas de diseño tienden a
optimizar por lo que se ve lindo en una captura y no por lo que funciona en la
mano de un chico/a con dificultades motrices.

---

## Contexto

> VozAAC es un comunicador AAC (Comunicación Aumentativa y Alternativa) para
> niños y niñas con necesidades complejas de comunicación. El chico/a arma
> frases tocando pictogramas y la app las dice en voz alta con síntesis de voz.
>
> Hay dos tipos de usuario y no se pueden confundir:
>
> - **El chico/a**: usa el comunicador. Muchas veces no lee, no escribe, y
>   tiene dificultades motrices. Nunca tiene contraseña ni cuenta. Toca
>   pictogramas: imágenes, no texto.
> - **El adulto responsable**: madre, padre, un hermano, la maestra, un
>   terapeuta. Tiene cuenta con email y contraseña. Configura el tablero, marca
>   qué pictogramas avisan, y recibe los avisos urgentes.
>
> La app corre en Android y iOS (React Native / Expo), tanto en tablet apaisada
> como en celular vertical. La misma pantalla tiene que funcionar en los dos.
>
> Es un proyecto de tesis con un piloto real planeado con familias y una
> escuela especial. No es una demo: la van a usar chicos y chicas de verdad.

---

## Sistema visual

### Paletas

La app tiene **tres paletas** que el terapeuta elige por chico/a. Las pantallas
del comunicador tienen que verse bien en las tres. Las pantallas de
administración usan siempre la estándar.

**Estándar** — la que se usa por defecto:

| Rol        | Hex       | Uso                         |
| ---------- | --------- | --------------------------- |
| background | `#FFFFFF` | Fondo de pantalla           |
| surface    | `#F4F6F8` | Tarjetas, celdas, campos    |
| text       | `#1B2733` | Texto principal             |
| textMuted  | `#5A6B7B` | Texto secundario, ayudas    |
| border     | `#D3DCE3` | Bordes, separadores         |
| accent     | `#2F6FB0` | Acción principal, selección |
| danger     | `#C0453B` | Destructivo y **urgente**   |

**Bajo estímulo** — para chicos/as con hipersensibilidad visual. Menos
saturación y menos contraste, sin llegar a ser ilegible:

`background #EDEAE4` · `surface #E2DED6` · `text #3D3A34` · `textMuted #6B665E`
· `border #CDC7BC` · `accent #6E7F73` · `danger #9A6A62`

**Alto contraste** — para baja visión. Fondo negro, amarillo saturado:

`background #000000` · `surface #141414` · `text #FFFFFF` · `textMuted #D0D0D0`
· `border #FFFFFF` · `accent #FFD400` · `danger #FF6B5E`

### Colores de categoría

Cada categoría del tablero tiene su color, siguiendo la convención **Fitzgerald
Key** que se usa en AAC. El color va en el **borde** de la celda, nunca como
relleno: el relleno compite con el pictograma, que es lo que el chico/a mira.

`Necesidades #E86A6A` · `Acciones #6AB04C` · `Comidas #E8A33D` ·
`Sentimientos #C56AC9` · `Social #F291B8`

En modo bajo estímulo estos colores se atenúan a un gris verdoso `#9AA39C`,
manteniendo la distinción entre categorías sin la saturación.

### Espaciado y tipografía

- Escala de espaciado: **4 / 8 / 16 / 24 px**.
- Radio de esquinas: **12 px** en tarjetas y botones, **10 px** en botones
  chicos.
- Tipografía del sistema. **Nada de fuentes decorativas ni condensadas.**
- Tamaños: título 26–30, subtítulo 16–18, cuerpo 15–17, ayuda 13–14. El texto
  bajo un pictograma va en 16 y semibold.

---

## Las pantallas

### 1. Login / Registro

**Quién la ve:** el adulto, la primera vez y cuando la sesión se cierra.

Una sola pantalla que alterna entre "entrar" y "crear cuenta" — quien la abre
por primera vez no tiene por qué adivinar dónde se crea la cuenta.

Contiene:

- Título grande "VozAAC" y un subtítulo que cambia según el modo.
- Campos: email y contraseña. En modo registro se suma "Nombre y apellido"
  arriba, y una ayuda que dice el mínimo de caracteres de la contraseña.
- Botón principal ancho: "Entrar" / "Crear cuenta".
- Enlace secundario para alternar de modo.
- Un segundo enlace, más apagado: **"Tengo un código de vinculación"**. Es por
  donde entra el celular del chico/a o el de otro responsable — no tienen
  cuenta propia y nunca la van a tener.
- Espacio para un mensaje de error bajo los campos.

El formulario centrado, con un ancho máximo de ~420 px para que en tablet no se
estire de lado a lado.

---

### 2. Selector de perfiles

**Quién la ve:** el adulto al entrar, y a veces el propio chico/a.

Título: "¿Quién va a usar el comunicador?"

Una grilla de tarjetas grandes, una por chico/a. Cada tarjeta lleva foto
circular (o la inicial del nombre sobre un placeholder si no hay foto), el
nombre en grande, y la edad debajo en texto apagado.

**Las tarjetas tienen que ser grandes**: muchas veces es el propio chico/a
quien se elige a sí mismo antes de empezar, y la puntería fina no se puede dar
por supuesta.

En el pie: "Agregar perfil" (botón principal), "Tengo una invitación" y "Cerrar
sesión" (secundarios).

Estado vacío: un texto que invita a crear el primero.

Dos diálogos modales:

- **Nuevo perfil**: campo de nombre y una ayuda que explica que el tablero
  arranca con vocabulario inicial.
- **Aceptar invitación**: un campo de código de 6 caracteres, centrado, con
  mucho espaciado entre letras (tipo código de verificación), y una ayuda que
  explica de qué se trata.

---

### 3. Comunicador (la pantalla principal)

**Quién la ve:** el chico/a. **Es la pantalla más importante de la app.**

Tres zonas apiladas:

**Arriba — barra de frase.** Los pictogramas que el chico/a fue tocando, en
fila horizontal como fichas con imagen y texto. A la derecha: botón "Hablar"
(grande, color de acento), y dos botones chicos: "←" para borrar el último y
"✕" para limpiar todo. Cuando está vacía muestra un texto guía apagado.

**Medio — tabs de categorías.** Una fila horizontal scrolleable. El tab
seleccionado se rellena con el color de su categoría y su texto va en blanco;
los demás quedan con borde del color y fondo neutro.

**Abajo — grilla de pictogramas.** Ocupa todo el espacio restante. Cada celda
tiene la imagen del pictograma arriba y su texto debajo, con un **borde grueso
de 3 px** del color de la categoría.

Lo que hace especial a esta grilla:

- El tamaño es configurable: **2x2, 2x3, 3x4 o 4x5**. Menos celdas significa
  celdas más grandes. Diseñá al menos 2x3 y 4x5 para ver los dos extremos.
- **Las celdas se reparten todo el alto disponible.** No son de tamaño fijo con
  espacio sobrante abajo: si son 4 celdas, cada una ocupa un cuarto de la
  pantalla.
- La disposición rota con el dispositivo: en apaisado el lado largo va
  horizontal, en vertical al revés. Las mismas celdas, acomodadas distinto.
- **Celdas urgentes**: las que avisan a los responsables llevan borde de 5 px
  en color `danger` en lugar del color de su categoría. Tienen que distinguirse
  de un vistazo, tanto para el chico/a como para el adulto que mira por encima
  del hombro.
- **Barra de progreso de sostenido**: cuando el filtro anti-temblor está
  activo, al apoyar el dedo aparece una barra que se llena en la base de la
  celda. No es decoración — sin ella el retardo se siente como que la app se
  colgó y el chico/a levanta el dedo justo antes de confirmar.

**Cartel de aviso enviado.** Cuando el chico/a toca un pictograma urgente
aparece una banda ancha sobre el pie, con texto blanco grande y centrado:

- Enviando: fondo `accent`, `Avisando "me duele"…`
- Enviado: fondo `accent`, `Avisado ✓ "me duele"`
- Falló: fondo `danger`, `No se pudo avisar "me duele"`

Se va solo a los pocos segundos.

**Pie.** El nombre del perfil a la izquierda, y a la derecha: "Avisos", "Modo
terapeuta" y "Cambiar perfil". En celular vertical las etiquetas se acortan
("Terapeuta", "Perfil"). Estos botones son deliberadamente **discretos**: son
para el adulto, y no tienen que competir con la grilla.

---

### 4. PIN del modo terapeuta

**Quién la ve:** el adulto, al querer entrar al editor.

Pantalla simple y centrada. Título "Modo terapeuta", subtítulo que pide el PIN
de 4 dígitos, un campo grande con los caracteres muy espaciados y ocultos, y
dos botones: "Cancelar" y "Entrar".

No es una segunda autenticación: es la barrera para que el chico/a no entre al
editor sin querer mientras usa el comunicador. Que se vea como un paso rápido,
no como un control de seguridad.

---

### 5. Editor del tablero

**Quién la ve:** el terapeuta o la familia, muchas veces **con el chico/a al
lado usando el comunicador**.

Encabezado: título "Editar tablero" y una fila de acciones: "Accesibilidad",
"Dispositivos", "Responsables", el indicador "Cambios sin guardar" (en color
`danger`), "Descartar", "Guardar cambios" (principal) y "Salir".

Cuerpo scrolleable:

1. Campo para agregar un pictograma por texto, con su botón "Agregar".
2. Sección "Banco ARASAAC": un buscador con resultados en grilla de miniaturas
   para elegir imágenes del banco público de pictogramas.
3. Sección "Pictogramas de [categoría]": la lista editable.

Cada fila de la lista tiene: miniatura, campo de texto editable, un **toggle
"Avisa" / "No avisa"** y el botón "Borrar".

El toggle "Avisa" es el que marca un pictograma como urgente. Cuando está
activo se rellena en `danger` con texto blanco; apagado queda con borde neutro
y texto apagado.

Un pictograma marcado para borrar **no desaparece**: queda con opacidad baja,
el texto tachado, y su botón cambia a "Deshacer". Los cambios no se escriben
hasta "Guardar cambios" — el terapeuta suele editar con el chico/a usando el
comunicador al lado, y ver los pictogramas desaparecer y reaparecer sería
confuso para quien está comunicándose.

---

### 6. Accesibilidad

**Quién la ve:** el terapeuta, dentro del modo terapeuta.

Pantalla scrolleable con cuatro secciones, cada una con su título y una línea
de ayuda que explica **para quién** sirve ese ajuste (no qué hace el control —
eso ya se ve):

1. **Tamaño de la cuadrícula** — cuatro opciones en fila: 2x2, 2x3, 3x4, 4x5.
   Cada una muestra el nombre y debajo la cantidad de celdas. La activa se
   rellena en `accent`.
2. **Paleta de color** — tres opciones: Estándar, Bajo estímulo, Alto
   contraste. Idealmente cada opción muestra una miniatura de su paleta.
3. **Filtro anti-temblor** — un switch para activarlo, y cuando está activo
   aparecen tres controles de tipo stepper (botón "−", valor grande, botón
   "+"): tiempo de sostenido en ms, tiempo de rebote en ms, y tolerancia de
   movimiento en px.
4. **Voz** — steppers para velocidad y tono, más un botón "Probar la voz".

Los steppers necesitan **botones grandes**: los usa un adulto, pero muchas
veces con el chico/a encima y sin poder mirar con atención.

Un indicador de guardado discreto en el encabezado (los cambios se guardan
solos) y un botón "Volver" al final.

---

### 7. Dispositivos vinculados

**Quién la ve:** el adulto que administra.

Título "Dispositivos" y botón "Volver".

**Sección "Vincular un dispositivo"**: una lista de opciones grandes y
tocables. Una por cada chico/a ("Dispositivo de Mía", con la ayuda "Abre
directo en su tablero") y una última para "Dispositivo de otro responsable"
("Ve todos los perfiles y recibe los avisos").

Al elegir una, la sección se reemplaza por un **panel con el código**: texto
que dice "Escribí este código en el otro dispositivo", el código de 6
caracteres **enorme y muy espaciado** (que se pueda leer en voz alta desde el
otro lado de la habitación), una ayuda que dice que vence en 15 minutos y se
usa una sola vez, y un botón "Listo".

**Sección "Vinculados"**: una lista con nombre del dispositivo, debajo el tipo
y a qué perfil está atado, y un botón "Desvincular" con borde `danger`.

Estado vacío: "Todavía no vinculaste ningún dispositivo."

---

### 8. Vincular este dispositivo

**Quién la ve:** quien está enrolando un dispositivo nuevo. **Se ve una sola
vez en la vida del dispositivo** — después la sesión no se vuelve a pedir
nunca.

Pantalla centrada: título "Vincular este dispositivo", un texto que explica que
hay que pedirle el código a quien configuró la app, un campo de código de 6
caracteres grande y espaciado, un campo opcional para el nombre del dispositivo
("Tablet de Mía"), y dos botones: "Volver" y "Vincular".

Aunque casi nadie la vea dos veces, vale la pena que sea clara: si algo sale
mal acá, el chico/a se queda sin comunicador.

---

### 9. Responsables

**Quién la ve:** cualquier adulto a cargo del chico/a.

Título "Responsables" y un subtítulo: "Quiénes pueden ver y editar el tablero
de [nombre]".

**Sección "Sumar a alguien"**: un campo opcional para el parentesco ("Mamá,
Papá, Hermano, Maestra…") y un botón "Generar invitación". Al generarla, la
sección se reemplaza por el panel con el código —mismo tratamiento visual que
el de dispositivos, código enorme y espaciado— con la ayuda de que vence en 48
horas.

**Lista de responsables**: cada fila con el nombre (el propio lleva "(vos)"),
debajo el parentesco y el email, y un botón "Quitar" (o "Salir" si es uno
mismo). Cuando hay un solo responsable el botón no aparece: no se puede quitar
al último, porque el perfil quedaría sin nadie que pueda verlo.

Todos los responsables pueden lo mismo. **No hay jerarquía y el diseño no debe
sugerir una**: nada de "administrador" o "invitado", ni de destacar a quien
creó el perfil.

---

### 10. Avisos (bandeja del responsable)

**Quién la ve:** el adulto. Puede estar mirándola a las 3 de la mañana.

Título "Avisos", con el número de pendientes entre paréntesis si hay alguno.

Lista de tarjetas. Cada una: la imagen del pictograma a la izquierda, el texto
en grande ("me duele"), debajo el nombre del chico/a y la hora (sólo la hora si
fue hoy; fecha y hora si fue antes), y a la derecha un botón "Lo vi".

**La distinción entre pendiente y atendido es lo más importante de la
pantalla:**

- **Pendiente**: borde de 3 px en `danger`, opacidad completa.
- **Atendido**: borde de 1 px neutro, opacidad reducida, sin botón, y una línea
  extra que dice "Visto por [nombre]".

Esa última línea importa: si la madre ya fue a ver al chico/a, el padre
necesita saberlo para no salir corriendo también.

Estado vacío: "No hay avisos. Acá van a aparecer cuando el chico/a toque un
pictograma urgente."

---

## Restricciones que no se pueden romper

Repetir esta sección en cada pedido a la herramienta de diseño.

> 1. **Áreas táctiles grandes.** Mínimo 44x44 px, y en el comunicador mucho
>    más: la celda entera es tocable, no sólo la imagen. La puntería fina no se
>    puede dar por supuesta.
>
> 2. **Nada de gestos.** Sin swipe para borrar, sin pull to refresh, sin
>    long-press como única forma de llegar a algo, sin menús ocultos detrás de
>    un ícono sin etiqueta. Cada acción es un botón visible con texto.
>
> 3. **Texto además de íconos.** Un ícono solo no alcanza: los adultos que usan
>    esto no son necesariamente usuarios habituales de apps.
>
> 4. **Contraste real.** Mínimo AA de WCAG en las tres paletas. En alto
>    contraste, más.
>
> 5. **Sin animaciones decorativas.** La única animación con sentido es la
>    barra de sostenido, que comunica cuánto falta. Nada de transiciones
>    elaboradas, parallax ni elementos que se muevan solos: pueden ser un
>    problema real para chicos/as con hipersensibilidad.
>
> 6. **El pictograma es lo que importa.** En la grilla, todo lo demás —bordes,
>    fondos, botones del pie— es secundario y tiene que ceder espacio y peso
>    visual a la imagen.
>
> 7. **Funciona en tablet apaisada y en celular vertical.** No asumir una sola
>    orientación ni un solo tamaño.
>
> 8. **Nada de modo oscuro automático.** La paleta la elige el terapeuta por
>    chico/a; no la decide el sistema operativo.
>
> 9. **Sin marca ni ilustraciones de relleno.** Nada de mascotas, formas
>    decorativas ni ilustraciones de fondo. El único contenido visual es el
>    pictograma.

---

## Orden sugerido para diseñar

1. **Comunicador** — es la pantalla que define el sistema visual; las demás se
   acomodan a ella.
2. **Selector de perfiles** — la segunda que más ve el chico/a.
3. **Avisos** y **Editor** — las dos que más usa el adulto.
4. El resto: Login, PIN, Accesibilidad, Dispositivos, Vincular, Responsables.

## Qué preguntar cuando haya diseños

Antes de implementar cualquier rediseño conviene chequear:

- ¿La grilla 4x5 en celular vertical sigue siendo usable, o ya es demasiado
  apretada? Es una de las preguntas abiertas del piloto.
- ¿El pictograma urgente se distingue lo suficiente sin depender sólo del
  color? (Hay chicos/as con dificultades de percepción del color.)
- ¿La barra de sostenido se ve mientras el dedo está tapando parte de la celda?
