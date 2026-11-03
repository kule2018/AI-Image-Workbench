import { Controller, Get, Post, Query, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { DIRS } from '../common/paths';
import { safeName } from '../common/utils/file.util';
import { LibraryService } from '../library/library.service';

@Controller('api/storage-files')
export class StorageController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  async list(
    @Query('dir') dir: string,
    @Query('sub') sub: string,
    @Res() res: Response,
  ) {
    if (dir === 'library') {
      const rows = await this.libraryService.findAll();
      return res.json({
        items: rows.map((r) => ({
          name: r.file,
          size: 0,
          mtime: r.created_at,
          url: r.url,
        })),
      });
    }
    const base = sub === 'imported' ? DIRS.imported : DIRS.output;
    const items: any[] = [];
    try {
      for (const f of fs.readdirSync(base)) {
        const full = base + '/' + f;
        const st = fs.statSync(full);
        if (st.isFile()) items.push({ name: f, size: st.size, mtime: st.mtimeMs });
      }
    } catch (e) { /* 空目录 */ }
    items.sort((a, b) => b.mtime - a.mtime);
    res.json({ items });
  }

  @Post('delete')
  async delete(@Body() body: any, @Res() res: Response) {
    const sub = body?.sub || '';
    if (body?.dir === 'library') {
      for (const name of (body.names || [])) await this.libraryService.deleteFile(name);
    } else {
      const base = sub === 'imported' ? DIRS.imported : DIRS.output;
      for (const name of (body.names || [])) {
        const full = base + '/' + safeName(name);
        try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch (e) { /* 忽略 */ }
      }
    }
    res.json({ ok: true });
  }
}
