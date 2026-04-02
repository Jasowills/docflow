import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { EmailService } from './services/email.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService, EmailService],
  exports: [AuditService, EmailService],
})
export class CommonModule {}
