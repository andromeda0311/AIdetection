import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SignalStateEnum {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum TriggeredByEnum {
  AUTO = 'auto',
  ADMIN = 'admin',
}

@Entity('signal_events')
@Index(['createdAt'])
export class SignalEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: SignalStateEnum })
  state!: SignalStateEnum;

  @Column({ type: 'enum', enum: TriggeredByEnum, name: 'triggered_by' })
  triggeredBy!: TriggeredByEnum;

  @Column({ type: 'uuid', nullable: true, name: 'detection_id' })
  detectionId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}