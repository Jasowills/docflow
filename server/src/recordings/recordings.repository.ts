import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type {
  RecordingDocument,
  RecordingListQuery,
  PaginatedResponse,
  RecordingSummary,
} from '@docflow/shared';

@Injectable()
export class RecordingsRepository {
  private readonly logger = new Logger(RecordingsRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async insert(recording: RecordingDocument, workspaceId?: string): Promise<void> {
    const payload: Record<string, unknown> = {
      recording_id: recording.metadata.recordingId,
      recording_name: recording.metadata.name,
      product_area: recording.metadata.productArea,
      metadata: recording.metadata,
      events: recording.events,
      speech_transcripts: recording.speechTranscripts,
      screenshots: recording.screenshots || [],
      user_id: recording.userId,
      uploaded_at_utc: recording.uploadedAtUtc,
      last_modified_at_utc: recording.lastModifiedAtUtc || null,
      event_count: recording.events.length,
      transcript_count: recording.speechTranscripts.length,
      screenshot_count: (recording.screenshots || []).length,
    };
    if (workspaceId) payload.workspace_id = workspaceId;

    const { error } = await this.supabase.from('recordings').insert(payload);
    if (error) {
      this.logger.error(`Failed to save recording ${recording.metadata.recordingId}: ${error.message}`);
      throw new Error('Failed to save recording.');
    }
  }

  async findByRecordingId(recordingId: string): Promise<RecordingDocument | null> {
    const { data, error } = await this.supabase
      .from('recordings')
      .select('*')
      .eq('recording_id', recordingId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to load recording ${recordingId}: ${error.message}`);
      throw new Error('Failed to load recording.');
    }
    return data ? this.fromRow(data as Record<string, unknown>) : null;
  }

  async findByIdentifier(recordingId: string, userIds?: string[]): Promise<RecordingDocument | null> {
    if (!userIds?.length) {
      return this.findByRecordingId(recordingId);
    }

    const { data, error } = await this.supabase
      .from('recordings')
      .select('*')
      .eq('recording_id', recordingId)
      .in('user_id', userIds)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to load recording ${recordingId}: ${error.message}`);
      throw new Error('Failed to load recording.');
    }
    return data ? this.fromRow(data as Record<string, unknown>) : null;
  }

  async findAll(
    query: RecordingListQuery,
    workspaceId?: string,
  ): Promise<PaginatedResponse<RecordingSummary>> {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    let request = this.supabase
      .from('recordings')
      .select('recording_id, metadata, uploaded_at_utc, event_count, transcript_count, screenshot_count', {
        count: 'exact',
      })
      .order('uploaded_at_utc', { ascending: false });

    if (workspaceId) request = request.eq('workspace_id', workspaceId);
    if (query.search) request = request.ilike('recording_name', `%${query.search.trim()}%`);
    if (query.productArea) request = request.eq('product_area', query.productArea);

    const { data, error, count } = await request.range(skip, skip + pageSize - 1);
    if (error) {
      this.logger.error(`Failed to list recordings: ${error.message}`);
      throw new Error('Failed to list recordings.');
    }

    const items = ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      recordingId: String(row.recording_id || ''),
      metadata: row.metadata as RecordingDocument['metadata'],
      uploadedAtUtc: String(row.uploaded_at_utc || ''),
      eventCount: Number(row.event_count || 0),
      transcriptCount: Number(row.transcript_count || 0),
      screenshotCount: Number(row.screenshot_count || 0),
    }));

    return {
      items,
      total: count || 0,
      page,
      pageSize,
      hasMore: skip + items.length < (count || 0),
    };
  }

  async deleteByRecordingId(recordingId: string, userId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('recordings')
      .delete({ count: 'exact' })
      .eq('recording_id', recordingId)
      .eq('user_id', userId);
    if (error) {
      this.logger.error(`Failed to delete recording ${recordingId}: ${error.message}`);
      throw new Error('Failed to delete recording.');
    }
    return (count || 0) > 0;
  }

  async deleteByIdentifier(recordingId: string, userId: string): Promise<boolean> {
    return this.deleteByRecordingId(recordingId, userId);
  }

  private fromRow(row: Record<string, unknown>): RecordingDocument {
    return {
      metadata: row.metadata as RecordingDocument['metadata'],
      events: Array.isArray(row.events) ? (row.events as RecordingDocument['events']) : [],
      speechTranscripts: Array.isArray(row.speech_transcripts)
        ? (row.speech_transcripts as RecordingDocument['speechTranscripts'])
        : [],
      screenshots: Array.isArray(row.screenshots)
        ? (row.screenshots as RecordingDocument['screenshots'])
        : [],
      userId: String(row.user_id || ''),
      uploadedAtUtc: String(row.uploaded_at_utc || ''),
      lastModifiedAtUtc:
        typeof row.last_modified_at_utc === 'string' ? row.last_modified_at_utc : undefined,
      workspaceId: typeof row.workspace_id === 'string' ? row.workspace_id : undefined,
    };
  }
}
