import { Entity, PrimaryColumn, Column } from 'typeorm';

// 设置：单行之 key-value 集合（与原始 settings.json 整体对应，前端按补丁合并）
@Entity('settings')
export class Settings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column('json', { nullable: true })
  data: Record<string, any> = {};
}
