import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}
