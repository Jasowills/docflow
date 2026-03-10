import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { CommonModule } from '../common/common.module';
import { RecordingsModule } from '../recordings/recordings.module';

@Module({
  imports: [CommonModule, RecordingsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
