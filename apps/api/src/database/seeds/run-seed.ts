import * as bcrypt from 'bcrypt';
import { CaregiverRole, PictogramSource } from '@vozaac/shared';
import dataSource from '../data-source';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { User } from '../../users/entities/user.entity';
import { Board } from '../../boards/entities/board.entity';
import { Category } from '../../categories/entities/category.entity';
import { Pictogram } from '../../pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../../accessibility/entities/accessibility-settings.entity';

/**
 * Datos de ejemplo para desarrollo y para la demo de la defensa.
 *
 * El vocabulario inicial sigue las categorías habituales de un tablero AAC
 * básico. Los colores respetan la convención Fitzgerald Key, que los
 * terapeutas ya reconocen: verde para acciones, naranja para sustantivos,
 * azul para descriptores, rosa para expresiones sociales.
 *
 * La contraseña del cuidador de demo es fija y está a la vista a propósito:
 * estos datos son para desarrollo y para la defensa, nunca para producción.
 */

/** Contraseña del cuidador de demostración. Sólo para desarrollo. */
const DEMO_PASSWORD = 'vozaac-demo';

const VOCABULARY: Record<string, { color: string; words: string[] }> = {
  Necesidades: {
    color: '#E86A6A',
    words: ['Agua', 'Baño', 'Ayuda', 'Dolor', 'Tengo hambre', 'Tengo frío'],
  },
  Acciones: {
    color: '#6AB04C',
    words: ['Quiero', 'Jugar', 'Comer', 'Dormir', 'Ir', 'Mirar'],
  },
  Comidas: {
    color: '#E8A33D',
    words: ['Pan', 'Leche', 'Fruta', 'Galletitas', 'Fideos'],
  },
  Sentimientos: {
    color: '#C56AC9',
    words: ['Contento', 'Triste', 'Enojado', 'Cansado'],
  },
  Social: {
    color: '#F291B8',
    words: ['Hola', 'Chau', 'Gracias', 'Por favor', 'Sí', 'No'],
  },
};

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('Conectado a la base de datos');

  const caregiverRepo = dataSource.getRepository(Caregiver);
  const userRepo = dataSource.getRepository(User);
  const boardRepo = dataSource.getRepository(Board);
  const categoryRepo = dataSource.getRepository(Category);
  const pictogramRepo = dataSource.getRepository(Pictogram);
  const settingsRepo = dataSource.getRepository(AccessibilitySettings);

  const email = 'demo@vozaac.local';
  const existing = await caregiverRepo.findOne({ where: { email } });
  if (existing) {
    console.log('El seed ya fue ejecutado. Usá "npm run db:reset" para empezar de cero.');
    await dataSource.destroy();
    return;
  }

  const caregiver = await caregiverRepo.save(
    caregiverRepo.create({
      email,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      fullName: 'Terapeuta de demostración',
      role: CaregiverRole.THERAPIST,
    }),
  );

  const user = await userRepo.save(
    userRepo.create({ name: 'Mateo', birthDate: '2018-05-14', caregiverId: caregiver.id }),
  );

  await settingsRepo.save(settingsRepo.create({ userId: user.id }));

  const board = await boardRepo.save(
    boardRepo.create({ name: 'Tablero principal', userId: user.id, isDefault: true }),
  );

  let categoryOrder = 0;
  let pictogramCount = 0;

  for (const [name, { color, words }] of Object.entries(VOCABULARY)) {
    const category = await categoryRepo.save(
      categoryRepo.create({ name, color, order: categoryOrder++, boardId: board.id }),
    );

    await pictogramRepo.save(
      words.map((text, index) =>
        pictogramRepo.create({
          text,
          // Placeholder hasta integrar el banco ARASAAC (Módulo 4).
          imageUrl: `https://static.arasaac.org/pictograms/placeholder/${encodeURIComponent(text)}.png`,
          categoryId: category.id,
          source: PictogramSource.CUSTOM,
          order: index,
        }),
      ),
    );
    pictogramCount += words.length;
  }

  console.log(
    `Seed completo: 1 cuidador, 1 usuario, ${categoryOrder} categorías, ${pictogramCount} pictogramas`,
  );
  console.log(`Cuidador de demo: ${email} / ${DEMO_PASSWORD}`);

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Falló el seed:', error);
  process.exit(1);
});
