import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial — Módulo 1.
 *
 * Crea las siete entidades centrales y sus relaciones:
 * caregivers, users, boards, categories, pictograms,
 * accessibility_settings y usage_logs.
 */
export class InitialSchema1725700000000 implements MigrationInterface {
  name = 'InitialSchema1725700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- Enums ---
    await queryRunner.query(
      `CREATE TYPE "public"."caregivers_role_enum" AS ENUM('family', 'therapist')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pictograms_source_enum" AS ENUM('arasaac', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accessibility_settings_gridsize_enum" AS ENUM('2x2', '2x3', '3x4', '4x5')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accessibility_settings_colormode_enum" AS ENUM('standard', 'low_stimulus', 'high_contrast')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."usage_logs_eventtype_enum" AS ENUM('pictogram_tap', 'phrase_spoken', 'phrase_cleared')`,
    );

    // --- caregivers ---
    await queryRunner.query(`
      CREATE TABLE "caregivers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "fullName" character varying(120) NOT NULL,
        "role" "public"."caregivers_role_enum" NOT NULL DEFAULT 'family',
        "therapistPinHash" character varying(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_caregivers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_caregivers_email" ON "caregivers" ("email")`);

    // --- users ---
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "birthDate" date,
        "photoUrl" character varying(500),
        "caregiverId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_caregiverId" ON "users" ("caregiverId")`);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_caregiver"
      FOREIGN KEY ("caregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);

    // --- boards ---
    await queryRunner.query(`
      CREATE TABLE "boards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_boards" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_boards_userId" ON "boards" ("userId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_boards_user_name" ON "boards" ("userId", "name")`,
    );
    await queryRunner.query(`
      ALTER TABLE "boards"
      ADD CONSTRAINT "FK_boards_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // --- categories ---
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(80) NOT NULL,
        "color" character varying(7) NOT NULL DEFAULT '#4A90D9',
        "icon" character varying(80),
        "order" integer NOT NULL DEFAULT 0,
        "boardId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_categories_boardId" ON "categories" ("boardId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_categories_board_name" ON "categories" ("boardId", "name")`,
    );
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "FK_categories_board"
      FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE
    `);

    // --- pictograms ---
    await queryRunner.query(`
      CREATE TABLE "pictograms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "text" character varying(120) NOT NULL,
        "imageUrl" character varying(500) NOT NULL,
        "audioUrl" character varying(500),
        "source" "public"."pictograms_source_enum" NOT NULL DEFAULT 'custom',
        "arasaacId" integer,
        "order" integer NOT NULL DEFAULT 0,
        "categoryId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pictograms" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_pictograms_categoryId" ON "pictograms" ("categoryId")`,
    );
    // Regla del Módulo 1: un concepto no se repite dentro de una categoría.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pictograms_category_text" ON "pictograms" ("categoryId", "text")`,
    );
    await queryRunner.query(`
      ALTER TABLE "pictograms"
      ADD CONSTRAINT "FK_pictograms_category"
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE
    `);

    // --- accessibility_settings ---
    await queryRunner.query(`
      CREATE TABLE "accessibility_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "gridSize" "public"."accessibility_settings_gridsize_enum" NOT NULL DEFAULT '2x3',
        "colorMode" "public"."accessibility_settings_colormode_enum" NOT NULL DEFAULT 'standard',
        "tremorFilterEnabled" boolean NOT NULL DEFAULT false,
        "holdToConfirmMs" integer NOT NULL DEFAULT 300,
        "debounceMs" integer NOT NULL DEFAULT 500,
        "moveTolerancePx" integer NOT NULL DEFAULT 20,
        "speechRate" double precision NOT NULL DEFAULT 1,
        "speechPitch" double precision NOT NULL DEFAULT 1,
        "voiceId" character varying(120),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accessibility_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_accessibility_settings_userId" UNIQUE ("userId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "accessibility_settings"
      ADD CONSTRAINT "FK_accessibility_settings_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // --- usage_logs ---
    await queryRunner.query(`
      CREATE TABLE "usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "pictogramId" uuid,
        "pictogramTextSnapshot" character varying(120),
        "eventType" "public"."usage_logs_eventtype_enum" NOT NULL,
        "phraseText" text,
        "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usage_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_usage_logs_userId" ON "usage_logs" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_logs_occurredAt" ON "usage_logs" ("occurredAt")`,
    );
    // Sostiene las consultas por rango de fechas del Módulo 6.
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_logs_user_occurredAt" ON "usage_logs" ("userId", "occurredAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "usage_logs"
      ADD CONSTRAINT "FK_usage_logs_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    // SET NULL y no CASCADE: borrar un pictograma no borra el historial de uso.
    await queryRunner.query(`
      ALTER TABLE "usage_logs"
      ADD CONSTRAINT "FK_usage_logs_pictogram"
      FOREIGN KEY ("pictogramId") REFERENCES "pictograms"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "usage_logs"`);
    await queryRunner.query(`DROP TABLE "accessibility_settings"`);
    await queryRunner.query(`DROP TABLE "pictograms"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "boards"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "caregivers"`);

    await queryRunner.query(`DROP TYPE "public"."usage_logs_eventtype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."accessibility_settings_colormode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."accessibility_settings_gridsize_enum"`);
    await queryRunner.query(`DROP TYPE "public"."pictograms_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."caregivers_role_enum"`);
  }
}
