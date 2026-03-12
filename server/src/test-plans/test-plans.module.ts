import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { TestPlansController } from './test-plans.controller';
import { TestPlansRepository } from './test-plans.repository';
import { TestPlansService } from './test-plans.service';

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [TestPlansController],
  providers: [TestPlansRepository, TestPlansService],
  exports: [TestPlansRepository, TestPlansService],
})
export class TestPlansModule {}
