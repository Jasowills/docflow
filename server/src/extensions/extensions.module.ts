import { Module } from '@nestjs/common';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { ExtensionPublishGuard } from './extension-publish.guard';

@Module({
  controllers: [ExtensionsController],
  providers: [ExtensionsRepository, ExtensionsService, ExtensionPublishGuard],
  exports: [ExtensionsService],
})
export class ExtensionsModule {}
