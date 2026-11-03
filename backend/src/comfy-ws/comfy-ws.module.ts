import { Module } from '@nestjs/common';
import { ComfyWsService } from './comfy-ws.service';

@Module({
  providers: [ComfyWsService],
})
export class ComfyWsModule {}
