import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SignalEvent } from './SignalEvent.js';
import { Detection } from './Detection.js';
import { StaffUser } from './StaffUser.js';
import { SignalStateEnum, TriggeredByEnum } from './SignalEvent.js';

export enum ArduinoTransportEnum {
  LOG = 'log',
  SERIAL = 'serial',
  HTTP = 'http',
}

@Entity('traffic_light_audit_logs')
@Index(['createdAt'])
@Index(['state'])
@Index(['triggeredBy'])
export class TrafficLightAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'signal_event_id', type: 'uuid', nullable: true })
  signalEventId!: string | null;

  @ManyToOne(() => SignalEvent, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'signal_event_id' })
  signalEvent!: SignalEvent | null;

  @Column({ type: 'enum', enum: SignalStateEnum })
  state!: SignalStateEnum;

  @Column({ type: 'enum', enum: TriggeredByEnum, name: 'triggered_by' })
  triggeredBy!: TriggeredByEnum;

  @Column({ name: 'detection_id', type: 'uuid', nullable: true })
  detectionId!: string | null;

  @ManyToOne(() => Detection, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'detection_id' })
  detection!: Detection | null;

  @Column({ name: 'arduino_transport', type: 'varchar', length: 16 })
  arduinoTransport!: ArduinoTransportEnum;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: StaffUser | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}