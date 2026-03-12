import { Module, forwardRef } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { PromptBuilderService } from './prompt-builder.service';
import { RecordingsModule } from '../recordings/recordings.module';
import { AdminModule } from '../admin/admin.module';
import { AiModule } from '../ai/ai.module';
import { CommonModule } from '../common/common.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    RecordingsModule,
    forwardRef(() => AdminModule),
    AiModule,
    CommonModule,
    RealtimeModule,
    AuthModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, PromptBuilderService],
  exports: [DocumentsService, DocumentsRepository],
})
export class DocumentsModule {}
