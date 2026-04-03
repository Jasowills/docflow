import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { RecordingsRepository } from './recordings.repository';
import { ScreenshotStorageService } from './screenshot-storage.service';
import { AuditService } from '../common/services/audit.service';
import { UploadRecordingDto } from './dto/upload-recording.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type {
  RecordingDocument,
  UserContext,
  RecordingListQuery,
  PaginatedResponse,
  RecordingSummary,
} from '@docflow/shared';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    private readonly repository: RecordingsRepository,
    private readonly screenshotStorage: ScreenshotStorageService,
    private readonly auditService: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async upload(
    dto: UploadRecordingDto,
    user: UserContext,
  ): Promise<RecordingDocument> {
    // Check for duplicate
    const existing = await this.repository.findByRecordingId(
      dto.metadata.recordingId,
    );
    if (existing) {
      throw new ConflictException(
        `Recording ${dto.metadata.recordingId} already exists`,
      );
    }

    const screenshots = await this.persistScreenshots(
      dto.metadata.recordingId,
      dto.screenshots ?? [],
    );

    const doc: RecordingDocument = {
      metadata: {
        ...dto.metadata,
        createdBy: user.email || user.userId,
      },
      events: dto.events,
      speechTranscripts: dto.speechTranscripts,
      screenshots,
      userId: user.userId,
      uploadedAtUtc: new Date().toISOString(),
    };

    await this.repository.insert(doc, user.workspaceId);

    this.realtimeGateway.emitRecordingPersisted(user.userId, {
      recordingId: doc.metadata.recordingId,
      name: doc.metadata.name,
      uploadedAtUtc: doc.uploadedAtUtc,
      eventCount: doc.events.length,
    });

    await this.auditService.log({
      action: 'upload_recording',
      userId: user.userId,
      userEmail: user.email,
      resourceType: 'recording',
      resourceId: dto.metadata.recordingId,
      details: {
        name: dto.metadata.name,
        productArea: dto.metadata.productArea,
        eventCount: dto.events.length,
        transcriptCount: dto.speechTranscripts.length,
        screenshotCount: screenshots.length,
      },
    });

    this.logger.log(
      `Recording uploaded: ${dto.metadata.name} (${dto.metadata.recordingId}) by ${user.email}`,
    );

    return doc;
  }

  private async persistScreenshots(
    recordingId: string,
    screenshots: Array<{
      id: string;
      timestampMs: number;
      eventSequence?: number;
      reason: 'click' | 'form_interaction' | 'navigation' | 'state_change';
      url?: string;
      title?: string;
      selector?: string;
      label?: string;
      imageDataUrl: string;
      thumbnailDataUrl?: string;
    }>,
  ): Promise<Array<{
    id: string;
    timestampMs: number;
    eventSequence?: number;
    reason: 'click' | 'form_interaction' | 'navigation' | 'state_change';
    url?: string;
    title?: string;
    selector?: string;
    label?: string;
    imageDataUrl?: string;
    thumbnailDataUrl?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
  }>> {
    if (screenshots.length === 0) return [];

    const uploaded = await Promise.all(
      screenshots.map(async (shot) => {
        const base = `recordings/${recordingId}/${shot.id}`;
        const imageUrl = await this.screenshotStorage.uploadDataUrl(
          shot.imageDataUrl,
          `${base}.jpg`,
        );
        const thumbnailUrl = shot.thumbnailDataUrl
          ? await this.screenshotStorage.uploadDataUrl(
              shot.thumbnailDataUrl,
              `${base}-thumb.jpg`,
            )
          : null;

        return {
          id: shot.id,
          timestampMs: shot.timestampMs,
          eventSequence: shot.eventSequence,
          reason: shot.reason,
          url: shot.url,
          title: shot.title,
          selector: shot.selector,
          label: shot.label,
          imageUrl: imageUrl || undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          // Keep inline data URLs as fallback in case blob URLs are private/unreachable.
          imageDataUrl: shot.imageDataUrl,
          thumbnailDataUrl: shot.thumbnailDataUrl,
        };
      }),
    );

    return uploaded;
  }

  async getById(
    recordingId: string,
    user: UserContext,
  ): Promise<RecordingDocument> {
    const recording = await this.repository.findByRecordingId(recordingId);
    if (!recording) {
      throw new NotFoundException(`Recording ${recordingId} not found`);
    }
    if (recording.userId !== user.userId) {
      // Only allow viewing recordings you own (cross-workspace protection)
      throw new ForbiddenException('You do not have access to this recording.');
    }
    return recording;
  }

  async list(
    query: RecordingListQuery,
    user: UserContext,
  ): Promise<PaginatedResponse<RecordingSummary>> {
    return this.repository.findAll(query, user.workspaceId);
  }

  async delete(recordingId: string, user: UserContext): Promise<void> {
    const existing = await this.repository.findByRecordingId(recordingId);
    if (!existing) {
      throw new NotFoundException(`Recording ${recordingId} not found`);
    }

    if (existing.userId !== user.userId) {
      throw new ForbiddenException(
        'You cannot delete another user\'s recording.',
      );
    }

    const deleted = await this.repository.deleteByIdentifier(
      recordingId,
      user.userId,
    );
    if (!deleted) {
      throw new NotFoundException(`Recording ${recordingId} not found`);
    }

    await this.auditService.log({
      action: 'delete_recording',
      userId: user.userId,
      userEmail: user.email,
      resourceType: 'recording',
      resourceId: recordingId,
    });
  }
}

