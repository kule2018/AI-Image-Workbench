import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// 历史记录：每一条生图记录一行（对应原 history.json 数组中的一项）
@Entity('history')
export class HistoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 64, nullable: true })
  engine: string;

  @Column('bigint', { nullable: true })
  timestamp: number;

  @Column('json', { nullable: true })
  data: Record<string, any>;
}
