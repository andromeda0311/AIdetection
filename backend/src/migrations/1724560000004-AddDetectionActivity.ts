import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetectionActivity1724560000004 implements MigrationInterface {
  name = 'AddDetectionActivity1724560000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS detection_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        people_count INTEGER NOT NULL DEFAULT 0,
        triggered_cycle BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_detection_activity_occurred_at ON detection_activity (occurred_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('detection_activity', true);
  }
}
