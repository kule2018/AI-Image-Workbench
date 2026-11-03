import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as fs from 'fs';
import { Settings } from './settings/settings.entity';
import { HistoryItem } from './history/history.entity';
import { Canvas } from './canvas/canvas.entity';
import { LibraryItem } from './library/library.entity';

import { SettingsModule } from './settings/settings.module';
import { HistoryModule } from './history/history.module';
import { CanvasModule } from './canvas/canvas.module';
import { LibraryModule } from './library/library.module';
import { ProxyModule } from './proxy/proxy.module';
import { StorageModule } from './storage/storage.module';
import { BackupModule } from './backup/backup.module';
import { AppInfoModule } from './app-info/app-info.module';
import { FilesModule } from './files/files.module';
import { ComfyWsModule } from './comfy-ws/comfy-ws.module';

const frontendDist = process.env.FRONTEND_DIST
  ? (fs.existsSync(process.env.FRONTEND_DIST) ? process.env.FRONTEND_DIST : null)
  : (fs.existsSync('../frontend/dist') ? '../frontend/dist' : null);

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_image_workbench',
      charset: 'utf8mb4',
      entities: [Settings, HistoryItem, Canvas, LibraryItem],
      synchronize: true, // 开发期自动建表；生产请改为 false 并迁移
      autoLoadEntities: true,
    }),
    ...(frontendDist
      ? [ServeStaticModule.forRoot({ rootPath: frontendDist, exclude: ['/api/(.*)', '/output/(.*)', '/library/(.*)'] })]
      : []),
    SettingsModule,
    HistoryModule,
    CanvasModule,
    LibraryModule,
    ProxyModule,
    StorageModule,
    BackupModule,
    AppInfoModule,
    FilesModule,
    ComfyWsModule,
  ],
})
export class AppModule {}
