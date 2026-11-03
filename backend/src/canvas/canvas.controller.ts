import { Controller, Get, Post, Delete, Body, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { CanvasService } from './canvas.service';

@Controller('api/canvases')
export class CanvasController {
  constructor(private readonly service: CanvasService) {}

  @Get()
  async list(@Res() res: Response) {
    res.json(await this.service.list());
  }

  @Post()
  async save(@Body() body: any, @Res() res: Response) {
    await this.service.save(body);
    res.json({ ok: true });
  }

  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const data = await this.service.get(id);
    if (!data) { res.status(404).json({ error: '画布不存在' }); return; }
    res.json(data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.service.delete(id);
    res.json({ ok: true });
  }
}
