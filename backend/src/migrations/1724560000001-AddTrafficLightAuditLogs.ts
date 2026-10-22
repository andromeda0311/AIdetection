import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrafficLightAuditLogs1724560000001 implements MigrationInterface {
  name = 'AddTrafficLightAuditLogs1724560000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS traffic_light_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        signal_event_id UUID REFERENCES signal_events (id) ON DELETE SET NULL,
        state VARCHAR(16) NOT NULL CHECK (state IN ('GREEN', 'YELLOW', 'RED')),
        triggered_by VARCHAR(16) NOT NULL CHECK (triggered_by IN ('auto', 'admin')),
        detection_id UUID REFERENCES detections (id) ON DELETE SET NULL,
        arduino_transport VARCHAR(16) NOT NULL CHECK (arduino_transport IN ('log', 'serial', 'http')),
        user_id UUID REFERENCES staff_users (id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_light_audit_logs_created_at ON traffic_light_audit_logs (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_light_audit_logs_state ON traffic_light_audit_logs (state);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_light_audit_logs_triggered_by ON traffic_light_audit_logs (triggered_by);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_light_audit_logs_signal_event_id ON traffic_light_audit_logs (signal_event_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('traffic_light_audit_logs', true);
  }
}