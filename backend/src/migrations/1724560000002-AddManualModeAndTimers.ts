import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualModeAndTimers1724560000002 implements MigrationInterface {
  name = 'AddManualModeAndTimers1724560000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE signal_config
      ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
      ADD COLUMN IF NOT EXISTS manual_green_ms INTEGER,
      ADD COLUMN IF NOT EXISTS manual_yellow_ms INTEGER,
      ADD COLUMN IF NOT EXISTS manual_red_ms INTEGER,
      ADD COLUMN IF NOT EXISTS manual_ped_walk_ms INTEGER;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE signal_config
      DROP COLUMN IF EXISTS mode,
      DROP COLUMN IF EXISTS manual_green_ms,
      DROP COLUMN IF EXISTS manual_yellow_ms,
      DROP COLUMN IF EXISTS manual_red_ms,
      DROP COLUMN IF EXISTS manual_ped_walk_ms;
    `);
  }
}