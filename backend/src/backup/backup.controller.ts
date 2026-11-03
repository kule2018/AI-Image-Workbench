import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BackupService } from './backup.service';
import { readRawBody, decodeDataUrl } from '../common/utils/file.util';

@Controller('api')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get('export-all')
  async exportAll(@Res() res: Response) {
    const zipBuf = await this.service.collectExportZip();
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="workbench_backup_' + Date.now() + '.zip"',
    });
    res.end(zipBuf);
  }

  @Post('import-all')
  async importAll(@Req() req: Request, @Res() res: Response) {
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    let zipBuf: Buffer;
    try {
      if (ct.includes('application/json')) {
        const body = req.body && req.body.dataUrl ? req.body : null;
        const decoded = body ? decodeDataUrl(body.dataUrl) : null;
        if (!decoded) return res.status(400).json({ error: '文件内容无效' });
        zipBuf = decoded.buffer;
      } else {
        zipBuf = await readRawBody(req);
      }
    } catch (e) {
      return res.status(413).json({ error: '备份包过大或上传中断：' + e.message });
    }
    if (!zipBuf || !zipBuf.length) return res.status(400).json({ error: '备份包为空' });
    try {
      const result = await this.service.applyImportZip(zipBuf);
      return res.json(result);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
}
