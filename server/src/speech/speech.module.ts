import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';

@Module({
  imports: [AuthModule],
  controllers: [SpeechController],
  providers: [SpeechService],
  exports: [SpeechService],
})
export class SpeechModule {}
