import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('api/app-info')
export class AppInfoController {
  @Get()
  appInfo(@Res() res: Response) {
    res.json({
      name: 'AI图片工作台',
      version: '1.5.0',
      serverTime: Date.now(),
      dataDir: 'data/',
      outputDir: 'output/',
    });
  }
}
