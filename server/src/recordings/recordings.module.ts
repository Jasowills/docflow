import { Module } from '@nestjs/common';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { RecordingsRepository } from './recordings.repository';
import { ScreenshotStorageService } from './screenshot-storage.service';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [CommonModule, AuthModule, RealtimeModule],
  controllers: [RecordingsController],
  providers: [RecordingsService, RecordingsRepository, ScreenshotStorageService],
  exports: [RecordingsService, RecordingsRepository, ScreenshotStorageService],
})
export class RecordingsModule {}
