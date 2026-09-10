/**
 * Tokens visuales de la app.
 *
 * Hasta acá cada pantalla resolvía sus tamaños a mano, y el resultado era que
 * el mismo rol visual terminaba escrito distinto en cada archivo: seis
 * tamaños de título, seis radios de esquina, y botones que dependían del
 * padding que hubiera elegido cada pantalla. Nada de eso se ve como una
 * decisión de diseño; se ve como descuido, y en una app que se defiende como
 * tesis conviene que no sea así.
 *
 * Estos tokens son la escala del documento de diseño (docs/prompt-diseno-
 * pantallas.md) puesta en un solo lugar. La regla es simple: una pantalla
 * elige un token, no inventa un número.
 */

/**
 * Escala tipográfica.
 *
 * Cada entrada es un rol, no una medida: una pantalla pide `title` porque eso
 * es un título, y si mañana los títulos crecen cambian todos juntos. Los
 * nombres salen del documento de diseño para que el código y el documento se
 * puedan leer en paralelo.
 */
export const typography = {
  /** Título de pantalla. */
  title: { fontSize: 26, fontWeight: '800' },
  /** Título de un diálogo o de una sección dentro de una pantalla. */
  sectionTitle: { fontSize: 22, fontWeight: '700' },
  /** Subtítulo bajo el título de pantalla. */
  subtitle: { fontSize: 17, fontWeight: '600' },
  /** Texto corriente. */
  body: { fontSize: 16, fontWeight: '400' },
  /** Texto de un botón. */
  button: { fontSize: 17, fontWeight: '700' },
  /** Texto bajo un pictograma en la grilla. */
  pictogram: { fontSize: 16, fontWeight: '600' },
  /** Línea de ayuda, metadatos, texto secundario. */
  caption: { fontSize: 14, fontWeight: '400' },
} as const;

/**
 * Tipografía del código de vinculación.
 *
 * Va aparte del resto de la escala porque no se lee como texto: se dicta en
 * voz alta desde el otro lado de la habitación, o se copia mirando dos
 * dispositivos a la vez. Por eso es grande y con mucho espacio entre letras,
 * y por eso el mismo tratamiento tiene que valer en las cuatro pantallas
 * donde aparece un código —vincular, dispositivos, responsables y el PIN—,
 * que hoy usan cuatro combinaciones distintas.
 */
export const codeTypography = {
  /** El código mostrado para que alguien lo lea y lo dicte. */
  display: { fontSize: 40, fontWeight: '800', letterSpacing: 10 },
  /** El campo donde se escribe un código o el PIN. */
  input: { fontSize: 32, fontWeight: '700', letterSpacing: 10 },
} as const;

/**
 * Radios de esquina.
 *
 * Tres valores alcanzan para todo: el documento de diseño pide 12 en tarjetas
 * y botones y 10 en botones chicos, y `pill` queda para lo que es
 * deliberadamente circular, como la foto de un perfil.
 */
export const radius = {
  card: 12,
  button: 12,
  buttonSmall: 10,
  pill: 999,
} as const;

/**
 * Área táctil mínima.
 *
 * Es la restricción número uno del documento de diseño y la única que no se
 * negocia: 44 px es el mínimo de las guías de accesibilidad de Apple y de
 * WCAG, y acá importa más que en una app común porque del otro lado hay
 * chicos y chicas con dificultades motrices, y adultos tocando el teléfono
 * con una mano mientras sostienen al chico/a con la otra.
 *
 * Antes esto dependía del padding que cada pantalla hubiera elegido, así que
 * en la práctica no estaba garantizado en ningún lado. Como `minHeight`, en
 * cambio, se cumple aunque el texto del botón sea corto.
 */
export const touchTarget = { minHeight: 44 } as const;

/**
 * Ancho máximo de un formulario centrado.
 *
 * Sin esto, en una tablet apaisada los campos se estiran de lado a lado y la
 * línea se vuelve incómoda de leer y de apuntar.
 */
export const maxFormWidth = 420;
