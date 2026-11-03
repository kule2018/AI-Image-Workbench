import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  async get(@Res() res: Response) {
    const data = await this.service.getSettings();
    res.json(data);
  }

  @Post()
  async save(@Body() body: Record<string, any>, @Res() res: Response) {
    const merged = await this.service.saveSettings(body || {});
    res.json({ ok: true });
  }
}
