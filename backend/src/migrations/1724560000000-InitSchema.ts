import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1724560000000 implements MigrationInterface {
  name = 'InitSchema1724560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users (email);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ip_address VARCHAR(45),
        user_agent TEXT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS detections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_user_id UUID NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
        input_file_path TEXT NOT NULL,
        input_filename TEXT NOT NULL,
        input_content_type TEXT NOT NULL,
        input_size_bytes BIGINT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
        pedestrian_detected BOOLEAN NOT NULL DEFAULT FALSE,
        total_pedestrians INTEGER NOT NULL DEFAULT 0,
        detection_meta JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_detections_staff_user_id ON detections (staff_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_detections_created_at ON detections (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS detection_frames (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        detection_id UUID NOT NULL REFERENCES detections (id) ON DELETE CASCADE,
        frame_index INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        content_type TEXT,
        pedestrian_count INTEGER NOT NULL DEFAULT 0,
        boxes JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (detection_id, frame_index)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_detection_frames_detection_id ON detection_frames (detection_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS signal_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state VARCHAR(16) NOT NULL CHECK (state IN ('GREEN', 'YELLOW', 'RED')),
        triggered_by VARCHAR(16) NOT NULL DEFAULT 'auto' CHECK (triggered_by IN ('auto', 'admin')),
        detection_id UUID REFERENCES detections (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_signal_events_created_at ON signal_events (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS signal_config (
        id INT PRIMARY KEY,
        yellow_ms INT NOT NULL,
        red_ms INT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      INSERT INTO signal_config (id, yellow_ms, red_ms) VALUES (1, 3000, 20000)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('detection_frames', true);
    await queryRunner.dropTable('detections', true);
    await queryRunner.dropTable('refresh_tokens', true);
    await queryRunner.dropTable('staff_users', true);
    await queryRunner.dropTable('signal_events', true);
    await queryRunner.dropTable('signal_config', true);
  }
}