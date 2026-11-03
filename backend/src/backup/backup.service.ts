import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../settings/settings.entity';
import { Canvas } from '../canvas/canvas.entity';
import { LibraryItem } from '../library/library.entity';
import { DIRS } from '../common/paths';
import { zipCreate, zipRead } from '../common/utils/zip.util';
import { safeName } from '../common/utils/file.util';
import * as fs from 'fs';

@Injectable()
export class BackupService {
  constructor(
    @InjectRepository(Settings) private settingsRepo: Repository<Settings>,
    @InjectRepository(Canvas) private canvasRepo: Repository<Canvas>,
    @InjectRepository(LibraryItem) private libraryRepo: Repository<LibraryItem>,
  ) {}

  // 全量导出：settings(DB) + 图片(output/imported) + 画布(DB) + 素材库(磁盘) -> zip
  async collectExportZip(): Promise<Buffer> {
    const settingsRow = await this.settingsRepo.findOne({ where: { id: 1 } });
    const settings = settingsRow?.data || {};
    (settings as any).workbenchFormat = true;

    const manifest = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      workbench: true,
      settingCount: Object.keys(settings).length,
      imageCount: 0,
      images: {},
      canvases: [],
      library: [],
    };

    const entries: { name: string; data: Buffer }[] = [
      { name: 'settings.json', data: Buffer.from(JSON.stringify(settings, null, 2), 'utf-8') },
    ];

    const imageDirs: [string, string][] = [[DIRS.output, ''], [DIRS.imported, 'imported_']];
    for (const [dir, prefix] of imageDirs) {
      let files: string[] = [];
      try { files = fs.readdirSync(dir); } catch (e) { /* 空 */ }
      for (const f of files) {
        const full = dir + '/' + f;
        if (!fs.statSync(full).isFile()) continue;
        entries.push({ name: 'images/' + prefix + f, data: fs.readFileSync(full) });
        manifest.images[prefix + f.replace(/\.[^.]+$/, '')] = { file: 'images/' + prefix + f };
        manifest.imageCount++;
      }
    }

    const canvases = await this.canvasRepo.find();
    for (const c of canvases) {
      entries.push({ name: 'canvases/' + c.id + '.json', data: Buffer.from(JSON.stringify(c.data, null, 2), 'utf-8') });
      manifest.canvases.push(c.id + '.json');
    }

    const libraryRows = await this.libraryRepo.find();
    for (const r of libraryRows) {
      const full = DIRS.library + '/' + r.file;
      if (fs.existsSync(full)) {
        entries.push({ name: 'library/' + r.file, data: fs.readFileSync(full) });
        manifest.library.push(r.file);
      }
    }

    entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8') });
    return zipCreate(entries);
  }

  // 全量导入：解包并落盘，settings 写入 DB 并返回给前端映射
  async applyImportZip(buf: Buffer): Promise<any> {
    const entries = zipRead(buf);
    const byName: Record<string, Buffer> = {};
    for (const e of entries) byName[e.name] = e.data;
    if (!byName['manifest.json']) throw new Error('无效的备份文件：缺少 manifest.json');
    const manifest = JSON.parse(byName['manifest.json'].toString('utf-8'));

    let settings: Record<string, any> = {};
    if (byName['settings.json']) {
      try { settings = JSON.parse(byName['settings.json'].toString('utf-8')); } catch (e) { settings = {}; }
    }
    // 写入 DB（前端随后会合并内置预设再次保存）
    let row = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!row) row = this.settingsRepo.create({ id: 1, data: {} });
    row.data = { ...(row.data || {}), ...settings };
    await this.settingsRepo.save(row);

    const importedImages: any[] = [];
    for (const [key, info] of Object.entries(manifest.images || {})) {
      const entry = byName[(info as any).file] || byName['images/' + key];
      if (!entry) continue;
      const fname = 'imported_' + safeName(key).replace(/[\\/:*?"<>|]/g, '_') + '.png';
      fs.writeFileSync(DIRS.imported + '/' + fname, entry);
      importedImages.push({ file: fname, url: '/output/imported/' + fname, prompt: (info as any).prompt || '', timestamp: (info as any).timestamp || Date.now() });
    }

    let canvasCount = 0;
    for (const [name, data] of Object.entries(byName)) {
      if (name.startsWith('canvases/') && name.endsWith('.json')) {
        try {
          const c = JSON.parse(data.toString('utf-8'));
          if (c && c.id) {
            let cr = await this.canvasRepo.findOne({ where: { id: c.id } });
            if (!cr) cr = this.canvasRepo.create({ id: c.id });
            cr.title = c.title; cr.updated_at = c.updated_at || Date.now(); cr.data = c;
            await this.canvasRepo.save(cr);
            canvasCount++;
          }
        } catch (e) { /* 跳过损坏 */ }
      }
    }

    let libCount = 0;
    for (const [name, data] of Object.entries(byName)) {
      if (name.startsWith('library/') && /\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
        const fn = safeName(name.split('/').pop() as string);
        fs.writeFileSync(DIRS.library + '/' + fn, data);
        const item = this.libraryRepo.create({ file: fn, url: '/library/' + fn, name: fn });
        await this.libraryRepo.save(item);
        libCount++;
      }
    }

    return { settings, importedImages, canvasCount, libCount, workbenchFormat: !!manifest.workbench };
  }
}
