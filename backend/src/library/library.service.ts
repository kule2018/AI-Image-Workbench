import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryItem } from './library.entity';
import { DIRS } from '../common/paths';
import { decodeDataUrl, extFromMime, genImageName, safeName } from '../common/utils/file.util';
import * as fs from 'fs';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LibraryItem)
    private readonly repo: Repository<LibraryItem>,
  ) {}

  // 上传素材（dataUrl -> 落盘 + 入库）
  async upload(dataUrl: string): Promise<{ url: string; file: string }> {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) throw new Error('dataUrl 无效');
    const ext = extFromMime(decoded.mime);
    const name = Date.now() + '_' + genImageName(ext).split('_').pop();
    const safe = safeName(name);
    fs.writeFileSync(DIRS.library + '/' + safe, decoded.buffer);
    const url = '/library/' + safe;
    const item = this.repo.create({ file: safe, url, name: safe, created_at: Date.now() });
    await this.repo.save(item);
    return { url, file: safe };
  }

  async findAll(): Promise<LibraryItem[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async deleteFile(file: string): Promise<void> {
    const safe = safeName(file);
    const full = DIRS.library + '/' + safe;
    try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch (e) { /* 忽略 */ }
    await this.repo.delete({ file: safe });
  }
}
