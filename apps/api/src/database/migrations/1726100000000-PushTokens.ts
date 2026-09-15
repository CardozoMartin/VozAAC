import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tokens de push — Módulo 9, paso 5.
 *
 * Guarda a qué teléfonos hay que mandarle el aviso cuando el chico/a toca un
 * pictograma urgente. Hasta ahora el aviso quedaba en `alerts` y la app lo
 * descubría por polling; esta tabla es lo que permite que suene sin que nadie
 * abra la app.
 *
 * El token es de la instalación de la app, no de la persona: se pierde al
 * reinstalar. Por eso la app lo reenvía en cada arranque y la columna es única
 * —un teléfono, una fila— con el cuidador actualizándose encima si el aparato
 * cambia de manos.
 */
export class PushTokens1726100000000 implements MigrationInterface {
  name = 'PushTokens1726100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(200) NOT NULL,
        "platform" character varying(16) NOT NULL,
        "caregiverId" uuid NOT NULL,
        "deviceSessionId" uuid,
        "lastSeenAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_tokens" PRIMARY KEY ("id")
      )
    `);

    // Único para que el upsert del registro tenga contra qué chocar: si el
    // mismo teléfono entra con otra cuenta, se reasigna la fila en vez de
    // quedar dos y mandarle el aviso también al dueño anterior.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_push_tokens_token" ON "push_tokens" ("token")`,
    );
    // Sostiene la consulta del envío: todos los tokens de los responsables de
    // un chico/a.
    await queryRunner.query(
      `CREATE INDEX "IDX_push_tokens_caregiver" ON "push_tokens" ("caregiverId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_push_tokens_device_session" ON "push_tokens" ("deviceSessionId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "push_tokens"
      ADD CONSTRAINT "FK_push_tokens_caregiver"
      FOREIGN KEY ("caregiverId") REFERENCES "caregivers"("id") ON DELETE CASCADE
    `);
    // Si se revoca el dispositivo, su token se va con él: es la misma decisión
    // de "revocar surte efecto enseguida" que ya toma device_sessions.
    await queryRunner.query(`
      ALTER TABLE "push_tokens"
      ADD CONSTRAINT "FK_push_tokens_device_session"
      FOREIGN KEY ("deviceSessionId") REFERENCES "device_sessions"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_tokens" DROP CONSTRAINT "FK_push_tokens_device_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_tokens" DROP CONSTRAINT "FK_push_tokens_caregiver"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_push_tokens_device_session"`);
    await queryRunner.query(`DROP INDEX "IDX_push_tokens_caregiver"`);
    await queryRunner.query(`DROP INDEX "IDX_push_tokens_token"`);
    await queryRunner.query(`DROP TABLE "push_tokens"`);
  }
}
