import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** One row per pedestrian event on the dashboard: a person appearing or the automatic cycle that followed. */
@Entity('detection_activity')
@Index(['occurredAt'])
export class DetectionActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ name: 'people_count', type: 'int', default: 0 })
  peopleCount!: number;

  @Column({ name: 'triggered_cycle', type: 'boolean', default: false })
  triggeredCycle!: boolean;
}
