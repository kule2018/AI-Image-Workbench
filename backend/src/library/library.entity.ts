import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// 素材库：每个上传素材一行（二进制文件落盘，元数据存 MySQL）
@Entity('library')
export class LibraryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 255 })
  file: string;

  @Column('varchar', { length: 255 })
  url: string;

  @Column('varchar', { length: 255, nullable: true })
  name: string;

  @Column('bigint')
  created_at: number;
}
