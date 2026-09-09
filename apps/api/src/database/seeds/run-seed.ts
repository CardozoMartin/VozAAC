import * as bcrypt from 'bcrypt';
import { CaregiverRole, PictogramSource } from '@vozaac/shared';
import dataSource from '../data-source';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';
import { User } from '../../users/entities/user.entity';
import { ProfileCaregiver } from '../../users/entities/profile-caregiver.entity';
import { Board } from '../../boards/entities/board.entity';
import { Category } from '../../categories/entities/category.entity';
import { Pictogram } from '../../pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../../accessibility/entities/accessibility-settings.entity';
import { STARTER_VOCABULARY } from '../../boards/starter-vocabulary';

/**
 * Datos de ejemplo para desarrollo y para la demo de la defensa.
 *
 * El vocabulario sale de STARTER_VOCABULARY, el mismo con el que nace
 * cualquier perfil nuevo: así la demo muestra exactamente lo que va a ver una
 * familia al crear el suyo, y no una versión paralela que se desactualiza.
 *
 * La contraseña del cuidador de demo es fija y está a la vista a propósito:
 * estos datos son para desarrollo y para la defensa, nunca para producción.
 */

/** Contraseña del cuidador de demostración. Sólo para desarrollo. */
const DEMO_PASSWORD = 'vozaac-demo';

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('Conectado a la base de datos');

  const caregiverRepo = dataSource.getRepository(Caregiver);
  const userRepo = dataSource.getRepository(User);
  const linkRepo = dataSource.getRepository(ProfileCaregiver);
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

  /*
   * Un segundo responsable del mismo chico/a (Módulo 9, paso 3).
   *
   * El seed deja dos a propósito: es la situación normal de una familia, y en
   * la demo permite mostrar que ambos entran con su propia cuenta y ven el
   * mismo tablero. Con uno solo, el caso que justifica la tabla intermedia
   * quedaría invisible.
   */
  const otroResponsable = await caregiverRepo.save(
    caregiverRepo.create({
      email: 'familia@vozaac.local',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      fullName: 'Madre de Mateo',
      role: CaregiverRole.FAMILY,
    }),
  );

  await linkRepo.save([
    linkRepo.create({ userId: user.id, caregiverId: caregiver.id, relationship: 'Terapeuta' }),
    linkRepo.create({
      userId: user.id,
      caregiverId: otroResponsable.id,
      relationship: 'Mamá',
    }),
  ]);

  await settingsRepo.save(settingsRepo.create({ userId: user.id }));

  const board = await boardRepo.save(
    boardRepo.create({ name: 'Tablero principal', userId: user.id, isDefault: true }),
  );

  let categoryOrder = 0;
  let pictogramCount = 0;

  for (const starter of STARTER_VOCABULARY) {
    const category = await categoryRepo.save(
      categoryRepo.create({
        name: starter.name,
        color: starter.color,
        order: categoryOrder++,
        boardId: board.id,
      }),
    );

    await pictogramRepo.save(
      starter.words.map((word, index) =>
        pictogramRepo.create({
          text: word.text,
          imageUrl: `https://static.arasaac.org/pictograms/${word.arasaacId}/${word.arasaacId}_300.png`,
          categoryId: category.id,
          source: PictogramSource.ARASAAC,
          arasaacId: word.arasaacId,
          isUrgent: word.isUrgent ?? false,
          order: index,
        }),
      ),
    );
    pictogramCount += starter.words.length;
  }

  console.log(
    `Seed completo: 2 responsables, 1 usuario, ${categoryOrder} categorías, ${pictogramCount} pictogramas`,
  );
  // Las dos cuentas ven al mismo Mateo: es lo que hay que mostrar en la demo.
  console.log(`Terapeuta: ${email} / ${DEMO_PASSWORD}`);
  console.log(`Mamá:      ${otroResponsable.email} / ${DEMO_PASSWORD}`);

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Falló el seed:', error);
  process.exit(1);
});
