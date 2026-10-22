import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Detection } from './Detection.js';
import type { DetectionBox } from '../services/detection.client.js';

@Entity('detection_frames')
@Index(['detectionId'])
@Unique(['detection', 'frameIndex'])
export class DetectionFrame {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'detection_id', type: 'uuid' })
  detectionId!: string;

  @ManyToOne(() => Detection, (d) => d.frames, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'detection_id' })
  detection!: Detection;

  @Column({ name: 'frame_index', type: 'int' })
  frameIndex!: number;

  @Column({ name: 'file_path', type: 'text' })
  filePath!: string;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType!: string | null;

  @Column({ name: 'pedestrian_count', type: 'int', default: 0 })
  pedestrianCount!: number;

  @Column({ name: 'boxes', type: 'jsonb', default: '[]' })
  boxes!: DetectionBox[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}