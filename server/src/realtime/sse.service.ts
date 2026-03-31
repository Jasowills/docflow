import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';

export interface SseClient {
  userId: string;
  response: Response;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private readonly clients = new Map<string, SseClient>();

  addClient(userId: string, response: Response): void {
    this.clients.set(userId, { userId, response });
    this.logger.debug(`SSE client connected: ${userId} (${this.clients.size} total)`);
  }

  removeClient(userId: string): void {
    this.clients.delete(userId);
    this.logger.debug(`SSE client disconnected: ${userId} (${this.clients.size} total)`);
  }

  sendEvent(userId: string, event: string, data: unknown): void {
    const client = this.clients.get(userId);
    if (!client) {
      this.logger.debug(`SSE client not found: ${userId}`);
      return;
    }

    try {
      const message = this.formatEvent(event, data);
      client.response.write(message);
    } catch (error) {
      this.logger.warn(`Failed to send SSE event to ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      this.removeClient(userId);
    }
  }

  sendRecordingPersisted(userId: string, payload: {
    recordingId: string;
    name: string;
    uploadedAtUtc: string;
    eventCount: number;
  }): void {
    this.sendEvent(userId, 'recording.persisted', payload);
  }

  sendDocumentPersisted(userId: string, payload: {
    documentId: string;
    documentTitle: string;
    documentType: string;
    createdAtUtc: string;
  }): void {
    this.sendEvent(userId, 'document.persisted', payload);
  }

  private formatEvent(event: string, data: unknown): string {
    const id = Date.now();
    const jsonData = JSON.stringify(data);
    return `id: ${id}\nevent: ${event}\ndata: ${jsonData}\n\n`;
  }

  onModuleDestroy(): void {
    this.logger.log(`Cleaning up ${this.clients.size} SSE clients`);
    for (const [userId, client] of this.clients) {
      try {
        client.response.end();
      } catch {
        // Ignore cleanup errors
      }
      this.clients.delete(userId);
    }
  }
}
