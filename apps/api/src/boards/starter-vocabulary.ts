/**
 * Vocabulario inicial de un tablero nuevo.
 *
 * Un perfil recién creado tiene que abrir con algo usable: una grilla vacía no
 * le sirve al chico/a ni le muestra al terapeuta cómo se arma el tablero. Esto
 * es un punto de partida para editar, no una propuesta cerrada — el Módulo 4
 * existe justamente para que cada chico/a termine con su propio vocabulario.
 *
 * Las categorías y los colores siguen la convención Fitzgerald Key, que los
 * terapeutas ya reconocen: verde para acciones, naranja para sustantivos,
 * azul para descriptores, rosa para expresiones sociales. Rojo para
 * necesidades, que va primero a propósito: pedir agua, el baño o avisar un
 * dolor es lo que más urge poder decir.
 *
 * Los arasaacId están verificados contra la API real del banco. Se guardan
 * como id y no como URL armada a mano para que la forma de la URL viva en un
 * solo lugar (ArasaacService.imageUrl) y un cambio del CDN no obligue a
 * reescribir esta tabla.
 */
export interface StarterCategory {
  name: string;
  color: string;
  words: { text: string; arasaacId: number; isUrgent?: boolean }[];
}

export const STARTER_VOCABULARY: StarterCategory[] = [
  {
    name: 'Necesidades',
    color: '#E86A6A',
    words: [
      { text: 'Agua', arasaacId: 32464 },
      { text: 'Baño', arasaacId: 6929 },
      // Los dos únicos que avisan por defecto (Módulo 9, paso 4). El resto lo
      // marca la familia con el uso: si todo notifica, el responsable silencia
      // las notificaciones y se pierden justo las que importan.
      { text: 'Ayuda', arasaacId: 12252, isUrgent: true },
      { text: 'Dolor', arasaacId: 2367, isUrgent: true },
      { text: 'Tengo hambre', arasaacId: 35559 },
      { text: 'Tengo frío', arasaacId: 4652 },
    ],
  },
  {
    name: 'Acciones',
    color: '#6AB04C',
    words: [
      { text: 'Quiero', arasaacId: 5441 },
      { text: 'Jugar', arasaacId: 23392 },
      { text: 'Comer', arasaacId: 6456 },
      { text: 'Dormir', arasaacId: 6479 },
      { text: 'Ir', arasaacId: 8142 },
      { text: 'Mirar', arasaacId: 6564 },
    ],
  },
  {
    name: 'Comidas',
    color: '#E8A33D',
    words: [
      { text: 'Pan', arasaacId: 2494 },
      { text: 'Leche', arasaacId: 2445 },
      { text: 'Fruta', arasaacId: 28339 },
      { text: 'Galletitas', arasaacId: 8312 },
      { text: 'Fideos', arasaacId: 8584 },
    ],
  },
  {
    name: 'Sentimientos',
    color: '#C56AC9',
    words: [
      { text: 'Contento', arasaacId: 35547 },
      { text: 'Triste', arasaacId: 35545 },
      // "enfadado" en ARASAAC; se muestra como "Enojado", que es lo que se
      // dice acá. Comparte la serie 355xx con las otras emociones, así que el
      // estilo del dibujo es el mismo.
      { text: 'Enojado', arasaacId: 35539 },
      { text: 'Cansado', arasaacId: 35537 },
    ],
  },
  {
    name: 'Social',
    color: '#F291B8',
    words: [
      { text: 'Hola', arasaacId: 6522 },
      { text: 'Chau', arasaacId: 6028 },
      { text: 'Gracias', arasaacId: 8129 },
      { text: 'Por favor', arasaacId: 8195 },
      { text: 'Sí', arasaacId: 5584 },
      { text: 'No', arasaacId: 5526 },
    ],
  },
];

/** Cuántos pictogramas trae un tablero nuevo. */
export const STARTER_PICTOGRAM_COUNT = STARTER_VOCABULARY.reduce(
  (total, category) => total + category.words.length,
  0,
);
