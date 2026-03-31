import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SseService } from './sse.service';
import { RealtimeController } from './realtime.controller';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeGateway, SseService],
  exports: [RealtimeGateway, SseService],
})
export class RealtimeModule {}

