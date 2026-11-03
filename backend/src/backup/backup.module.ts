import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settings } from '../settings/settings.entity';
import { Canvas } from '../canvas/canvas.entity';
import { LibraryItem } from '../library/library.entity';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Settings, Canvas, LibraryItem])],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
