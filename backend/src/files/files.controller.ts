import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DIRS } from '../common/paths';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

@Controller()
export class FilesController {
  @Get('output/*')
  serveOutput(@Req() req: Request, @Res() res: Response) {
    const pathname = String(req.url).split('?')[0];
    const rel = pathname.slice('/output/'.length);
    const full = path.resolve(DIRS.output, rel);
    if (full !== DIRS.output && !full.startsWith(DIRS.output + path.sep)) { res.status(403).end(); return; }
    this.send(res, full);
  }

  @Get('library/*')
  serveLibrary(@Req() req: Request, @Res() res: Response) {
    const pathname = String(req.url).split('?')[0];
    const rel = pathname.slice('/library/'.length);
    const full = path.resolve(DIRS.library, rel);
    if (full !== DIRS.library && !full.startsWith(DIRS.library + path.sep)) { res.status(403).end(); return; }
    this.send(res, full);
  }

  private send(res: Response, full: string) {
    fs.readFile(full, (err, data) => {
      if (err) { res.status(404).send('404 Not Found'); return; }
      const ext = path.extname(full).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.end(data);
    });
  }
}
