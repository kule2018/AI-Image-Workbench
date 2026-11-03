import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [LibraryModule],
  controllers: [StorageController],
})
export class StorageModule {}
