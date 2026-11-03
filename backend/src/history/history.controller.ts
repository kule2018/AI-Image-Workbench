import { Controller, Get, Post, Body, Query, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { HistoryService } from './history.service';
import { DIRS } from '../common/paths';
import { decodeDataUrl, extFromMime, genImageName } from '../common/utils/file.util';

@Controller('api/history')
export class HistoryController {
  constructor(private readonly service: HistoryService) {}

  @Get()
  async list(
    @Query('engine') engine: string,
    @Query('limit') limit: string,
    @Res() res: Response,
  ) {
    const result = await this.service.getList(engine, parseInt(limit || '0', 10));
    res.json(result);
  }

  @Post()
  async create(@Body() body: any, @Res() res: Response) {
    if (body?.action === 'delete') {
      await this.service.deleteByTimestamps(body.timestamps || []);
    } else if (body?.action === 'clear') {
      await this.service.clear();
    } else if (Array.isArray(body?.items)) {
      await this.service.prepend(body.items);
    } else if (body?.item) {
      await this.service.append(body.item);
    }
    const result = await this.service.getList();
    res.json({ ok: true, total: result.total });
  }

  // 生成图落盘（对应原 /api/history/save-image）
  @Post('save-image')
  async saveImage(@Body() body: any, @Res() res: Response) {
    const decoded = decodeDataUrl(body?.dataUrl);
    if (!decoded) { res.status(400).json({ error: 'dataUrl 无效' }); return; }
    const ext = extFromMime(decoded.mime);
    const name = genImageName(ext);
    fs.writeFileSync(DIRS.output + '/' + name, decoded.buffer);
    res.json({ url: '/output/' + name, file: name });
  }
}
