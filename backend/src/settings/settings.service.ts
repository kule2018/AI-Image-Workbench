import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly repo: Repository<Settings>,
  ) {}

  async getSettings(): Promise<Record<string, any>> {
    const row = await this.repo.findOne({ where: { id: 1 } });
    return row?.data || {};
  }

  // 合并补丁（对应原 server.js 的 Object.assign 语义）
  async saveSettings(patch: Record<string, any>): Promise<Record<string, any>> {
    let row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) {
      row = this.repo.create({ id: 1, data: {} });
    }
    row.data = { ...(row.data || {}), ...(patch || {}) };
    await this.repo.save(row);
    return row.data;
  }
}
