import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { LibraryService } from './library.service';

@Controller('api/library')
export class LibraryController {
  constructor(private readonly service: LibraryService) {}

  @Post('upload')
  async upload(@Body() body: any, @Res() res: Response) {
    const result = await this.service.upload(body?.dataUrl);
    res.json(result);
  }
}
