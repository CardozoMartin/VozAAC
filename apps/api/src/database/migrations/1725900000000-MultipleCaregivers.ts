import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Varios responsables por chico/a — Módulo 9, paso 3.
 *
 * Hasta acá un perfil tenía un solo cuidador, así que la madre y el padre no
 * podían ver al mismo chico/a sin compartir la cuenta. Esta migración agrega
 * `profile_caregivers`, que pasa a definir el acceso, y `caregiver_invites`,
 * el código con el que se suma a alguien.
 *
 * `users.caregiverId` se conserva: sigue diciendo quién creó el perfil, y de
 * ahí cuelga la cascada de borrado. Lo que cambia es que ya no decide quién
 * puede ver qué.
 *
 * El backfill del medio es la parte que no se puede olvidar: sin él, después
 * de migrar nadie vería ningún perfil, porque el acceso pasaría a salir de una
 * tabla vacía.
 */
export class MultipleCaregivers1725900000000 implements MigrationInterface {
  name = 'MultipleCaregivers1725900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- profile_caregivers ---
    await queryRunner.query(`
      CREATE TABLE "profile_caregivers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "caregiverId" uuid NOT NULL,
        "relationship" character varying(60),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile_caregivers" PRIMARY KEY ("id")
      )
    `);
    // Único: sumar dos veces a la misma persona no significa nada distinto de
    // sumarla una, y con filas repetidas los listados mostrarían duplicados.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_profile_caregivers_pair" ON "profile_caregivers" ("userId", "caregiverId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profile_caregivers_user" ON "profile_caregivers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profile_caregivers_caregiver" ON "profile_caregivers" ("caregiverId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "profile_caregivers"
      ADD CONSTRAINT "FK_profile_caregivers_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "profile_caregivers"
      ADD CONSTRAINT "FK_profile_caregivers_caregiver"
      FOREIGN KEY ("caregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);

    /*
     * Backfill: cada perfil que ya existe queda a cargo de quien lo creó.
     *
     * Sin esto, al terminar la migración el acceso saldría de una tabla vacía
     * y ninguna familia vería a su hijo/a al abrir la app. Va antes de que la
     * API nueva empiece a leer de esta tabla, así que no hay ventana en la que
     * alguien quede afuera.
     */
    await queryRunner.query(`
      INSERT INTO "profile_caregivers" ("userId", "caregiverId")
      SELECT "id", "caregiverId" FROM "users"
    `);

    // --- caregiver_invites ---
    await queryRunner.query(`
      CREATE TABLE "caregiver_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(12) NOT NULL,
        "userId" uuid NOT NULL,
        "invitedByCaregiverId" uuid NOT NULL,
        "relationship" character varying(60),
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "acceptedByCaregiverId" uuid,
        "failedAttempts" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_caregiver_invites" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_caregiver_invites_code" ON "caregiver_invites" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_caregiver_invites_user" ON "caregiver_invites" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_caregiver_invites_inviter" ON "caregiver_invites" ("invitedByCaregiverId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "caregiver_invites"
      ADD CONSTRAINT "FK_caregiver_invites_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "caregiver_invites"
      ADD CONSTRAINT "FK_caregiver_invites_inviter"
      FOREIGN KEY ("invitedByCaregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);
  }

  /**
   * Revertir descarta los responsables agregados.
   *
   * Es inevitable: `users.caregiverId` guarda uno solo, así que no hay dónde
   * poner a los demás. Después de revertir, cada perfil vuelve a verse sólo
   * desde la cuenta que lo creó.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "caregiver_invites"`);
    await queryRunner.query(`DROP TABLE "profile_caregivers"`);
  }
}
