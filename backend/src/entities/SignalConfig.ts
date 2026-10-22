import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('signal_config')
export class SignalConfig {
  @PrimaryColumn({ type: 'int' })
  id!: number; // always 1

  @Column({ name: 'yellow_ms', type: 'int' })
  yellowMs!: number;

  @Column({ name: 'red_ms', type: 'int' })
  redMs!: number;

  @Column({ name: 'mode', type: 'varchar', length: 10, default: 'auto' })
  mode!: 'auto' | 'manual';

  @Column({ name: 'manual_green_ms', type: 'int', nullable: true })
  manualGreenMs!: number | null;

  @Column({ name: 'manual_yellow_ms', type: 'int', nullable: true })
  manualYellowMs!: number | null;

  @Column({ name: 'manual_red_ms', type: 'int', nullable: true })
  manualRedMs!: number | null;

  @Column({ name: 'manual_ped_walk_ms', type: 'int', nullable: true })
  manualPedWalkMs!: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}