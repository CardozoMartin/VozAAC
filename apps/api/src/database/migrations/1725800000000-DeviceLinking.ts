import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vinculación de dispositivos — Módulo 9.
 *
 * Agrega device_sessions —la sesión permanente de un dispositivo enrolado— y
 * link_codes, el código de un solo uso con el que se enrola.
 */
export class DeviceLinking1725800000000 implements MigrationInterface {
  name = 'DeviceLinking1725800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."device_sessions_kind_enum" AS ENUM('child', 'caregiver')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."link_codes_kind_enum" AS ENUM('child', 'caregiver')`,
    );

    // --- device_sessions ---
    await queryRunner.query(`
      CREATE TABLE "device_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "kind" "public"."device_sessions_kind_enum" NOT NULL,
        "refreshTokenHash" character varying(64) NOT NULL,
        "caregiverId" uuid NOT NULL,
        "userId" uuid,
        "lastSeenAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_sessions" PRIMARY KEY ("id")
      )
    `);
    // Único porque el hash es la credencial: dos sesiones con el mismo hash
    // significaría que un refresh token abre dos dispositivos.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_device_sessions_token" ON "device_sessions" ("refreshTokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_device_sessions_caregiver" ON "device_sessions" ("caregiverId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_device_sessions_user" ON "device_sessions" ("userId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "device_sessions"
      ADD CONSTRAINT "FK_device_sessions_caregiver"
      FOREIGN KEY ("caregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);
    // CASCADE también sobre el perfil: si se borra el chico/a, el dispositivo
    // que abría en su tablero ya no tiene a dónde abrir.
    await queryRunner.query(`
      ALTER TABLE "device_sessions"
      ADD CONSTRAINT "FK_device_sessions_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // --- link_codes ---
    await queryRunner.query(`
      CREATE TABLE "link_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(12) NOT NULL,
        "kind" "public"."link_codes_kind_enum" NOT NULL,
        "caregiverId" uuid NOT NULL,
        "userId" uuid,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "failedAttempts" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_link_codes" PRIMARY KEY ("id")
      )
    `);
    // Único: el canje busca por código, y dos filas con el mismo dejarían el
    // resultado a merced del orden del plan de consulta.
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_link_codes_code" ON "link_codes" ("code")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_codes_caregiver" ON "link_codes" ("caregiverId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "link_codes"
      ADD CONSTRAINT "FK_link_codes_caregiver"
      FOREIGN KEY ("caregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "link_codes"
      ADD CONSTRAINT "FK_link_codes_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "link_codes"`);
    await queryRunner.query(`DROP TABLE "device_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."link_codes_kind_enum"`);
    await queryRunner.query(`DROP TYPE "public"."device_sessions_kind_enum"`);
  }
}
