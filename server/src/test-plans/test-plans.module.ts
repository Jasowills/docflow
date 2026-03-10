import { Module } from '@nestjs/common';
import { TestPlansController } from './test-plans.controller';
import { TestPlansRepository } from './test-plans.repository';
import { TestPlansService } from './test-plans.service';

@Module({
  controllers: [TestPlansController],
  providers: [TestPlansRepository, TestPlansService],
  exports: [TestPlansRepository, TestPlansService],
})
export class TestPlansModule {}
