import { Entity, PrimaryColumn, Column } from 'typeorm';

// 画布：每张画布一行
@Entity('canvas')
export class Canvas {
  @PrimaryColumn({ type: 'varchar', length: 160 })
  id: string;

  @Column('varchar', { length: 255, nullable: true })
  title: string;

  @Column('bigint', { nullable: true })
  updated_at: number;

  @Column('json', { nullable: true })
  data: Record<string, any>;
}
