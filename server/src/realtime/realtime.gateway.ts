import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SseService } from './sse.service';

export interface RecordingPersistedEvent {
  recordingId: string;
  name: string;
  uploadedAtUtc: string;
  eventCount: number;
}

export interface DocumentPersistedEvent {
  documentId: string;
  documentTitle: string;
  documentType: string;
  createdAtUtc: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Optional() @Inject(SseService) private readonly sseService: SseService,
  ) {}

  handleConnection(client: Socket) {
    const userId = this.extractUserId(client);
    if (!userId) {
      this.logger.warn(`Socket ${client.id} connected without userId`);
      return;
    }
    client.join(this.userRoom(userId));
    this.logger.debug(`Socket ${client.id} joined room ${this.userRoom(userId)}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('realtime.join')
  joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId?: string },
  ) {
    const userId = payload?.userId || this.extractUserId(client);
    if (!userId) return { ok: false };
    client.join(this.userRoom(userId));
    return { ok: true };
  }

  emitRecordingPersisted(userId: string, event: RecordingPersistedEvent) {
    this.server.to(this.userRoom(userId)).emit('recording.persisted', event);
    this.sseService?.sendRecordingPersisted(userId, event);
  }

  emitDocumentPersisted(userId: string, event: DocumentPersistedEvent) {
    this.server.to(this.userRoom(userId)).emit('document.persisted', event);
    this.sseService?.sendDocumentPersisted(userId, event);
  }

  private extractUserId(client: Socket): string {
    const authUserId = client.handshake.auth?.userId;
    const queryUserId = client.handshake.query?.userId;
    return String(authUserId || queryUserId || '').trim();
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
