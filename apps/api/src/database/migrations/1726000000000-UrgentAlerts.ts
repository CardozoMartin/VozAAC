import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pictogramas urgentes y alertas — Módulo 9, paso 4.
 *
 * Agrega `pictograms.isUrgent` —qué celdas avisan al tocarse— y la tabla
 * `alerts`, donde se guarda cada aviso hasta que un responsable lo atiende.
 *
 * `isUrgent` arranca en false para todos los pictogramas existentes, que es lo
 * correcto: el terapeuta marca a mano el puñado que corresponde. Si todo
 * notificara, las notificaciones se volverían ruido y el responsable las
 * silenciaría — y ahí se perderían justo las que importan.
 */
export class UrgentAlerts1726000000000 implements MigrationInterface {
  name = 'UrgentAlerts1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pictograms" ADD "isUrgent" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "pictogramId" uuid,
        "pictogramText" character varying(120) NOT NULL,
        "pictogramImageUrl" character varying(500),
        "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
        "acknowledgedByCaregiverId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alerts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_alerts_user" ON "alerts" ("userId")`);
    // Sostiene la consulta que corre cada veinte segundos: las alertas de un
    // chico/a, de la más nueva a la más vieja.
    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_user_occurred" ON "alerts" ("userId", "occurredAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    // SET NULL y no CASCADE: borrar el pictograma no puede borrar el aviso. El
    // responsable tiene que poder mirar después qué avisó el chico/a esa
    // noche, aunque el tablero haya cambiado desde entonces.
    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_pictogram"
      FOREIGN KEY ("pictogramId") REFERENCES "pictograms"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_acknowledged_by"
      FOREIGN KEY ("acknowledgedByCaregiverId") REFERENCES "caregivers"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`ALTER TABLE "pictograms" DROP COLUMN "isUrgent"`);
  }
}
