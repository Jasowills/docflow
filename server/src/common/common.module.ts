import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}
