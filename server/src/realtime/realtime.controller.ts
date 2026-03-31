import { Controller, Get, Req, Res, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { SseService } from './sse.service';
import type { UserContext } from '@docflow/shared';

@ApiTags('Realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly sseService: SseService) {}

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'SSE stream for real-time events' })
  async streamEvents(
    @CurrentUser() user: UserContext,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.sseService.addClient(user.userId, res);

    res.write(`: connected\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.sseService.removeClient(user.userId);
    });
  }
}
