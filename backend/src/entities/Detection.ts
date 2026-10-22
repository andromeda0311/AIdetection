import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { StaffUser } from './StaffUser.js';

export enum DetectionStatusEnum {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('detections')
@Index(['staffUserId'])
@Index(['createdAt'])
export class Detection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'staff_user_id', type: 'uuid' })
  staffUserId!: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_user_id' })
  staffUser!: StaffUser;

  @Column({ name: 'input_file_path', type: 'text' })
  inputFilePath!: string;

  @Column({ name: 'input_filename', type: 'text' })
  inputFilename!: string;

  @Column({ name: 'input_content_type', type: 'text' })
  inputContentType!: string;

  @Column({ name: 'input_size_bytes', type: 'bigint' })
  inputSizeBytes!: number;

  @Column({ type: 'enum', enum: DetectionStatusEnum, default: DetectionStatusEnum.PROCESSING })
  status!: DetectionStatusEnum;

  @Column({ name: 'pedestrian_detected', type: 'boolean', default: false })
  pedestrianDetected!: boolean;

  @Column({ name: 'total_pedestrians', type: 'int', default: 0 })
  totalPedestrians!: number;

  @Column({ name: 'detection_meta', type: 'jsonb', nullable: true })
  detectionMeta!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @OneToMany('DetectionFrame', 'detection', { cascade: true })
  frames!: 'DetectionFrame'[];
}