import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistoryItem } from './history.entity';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(HistoryItem)
    private readonly repo: Repository<HistoryItem>,
  ) {}

  async getList(engine?: string, limit = 0): Promise<{ items: any[]; total: number }> {
    const all = await this.repo.find({ order: { id: 'DESC' } });
    const total = all.length;
    let list = all.map((r) => r.data);
    if (engine) list = list.filter((i) => i && i.engine === engine);
    if (limit > 0) list = list.slice(0, limit);
    return { items: list, total };
  }

  // 追加一条（对应原 unshift）
  async append(item: Record<string, any>): Promise<void> {
    const row = this.repo.create({
      engine: item?.engine || '',
      timestamp: item?.timestamp || Date.now(),
      data: item,
    });
    await this.repo.save(row);
  }

  // 前置合并一批（对应原 body.items.concat(items)）
  async prepend(items: Record<string, any>[]): Promise<void> {
    for (const item of items || []) {
      const row = this.repo.create({
        engine: item?.engine || '',
        timestamp: item?.timestamp || Date.now(),
        data: item,
      });
      await this.repo.save(row);
    }
  }

  async deleteByTimestamps(timestamps: number[]): Promise<void> {
    if (!timestamps || !timestamps.length) return;
    const rows = await this.repo.find();
    const tsSet = new Set(timestamps);
    const toRemove = rows.filter((r) => tsSet.has(Number(r.timestamp)));
    if (toRemove.length) await this.repo.remove(toRemove);
  }

  async clear(): Promise<void> {
    await this.repo.clear();
  }
}
