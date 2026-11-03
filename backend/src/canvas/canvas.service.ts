import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Canvas } from './canvas.entity';

@Injectable()
export class CanvasService {
  constructor(
    @InjectRepository(Canvas)
    private readonly repo: Repository<Canvas>,
  ) {}

  async list(): Promise<{ items: any[] }> {
    const rows = await this.repo.find();
    const items = rows
      .map((r) => ({ id: r.id, title: r.title, updated_at: r.updated_at }))
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    return { items };
  }

  async save(canvas: Record<string, any>): Promise<void> {
    if (!canvas?.id) throw new Error('缺少 id');
    let row = await this.repo.findOne({ where: { id: canvas.id } });
    if (!row) row = this.repo.create({ id: canvas.id });
    row.title = canvas.title;
    row.updated_at = Date.now();
    row.data = canvas;
    await this.repo.save(row);
  }

  async get(id: string): Promise<Record<string, any> | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? row.data : null;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
