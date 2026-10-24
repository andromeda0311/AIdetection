import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetectionThreshold1724560000003 implements MigrationInterface {
  name = 'AddDetectionThreshold1724560000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE signal_config
      ADD COLUMN IF NOT EXISTS detection_threshold_ms INTEGER;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE signal_config
      DROP COLUMN IF EXISTS detection_threshold_ms;
    `);
  }
}
