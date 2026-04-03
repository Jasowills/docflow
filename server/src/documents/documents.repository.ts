import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type {
  GeneratedDocument,
  DocumentListQuery,
  PaginatedResponse,
  DocumentSummary,
} from '@docflow/shared';

@Injectable()
export class DocumentsRepository {
  private readonly logger = new Logger(DocumentsRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async insert(doc: GeneratedDocument): Promise<void> {
    await this.insertMany([doc]);
  }

  async insertMany(docs: GeneratedDocument[], workspaceId?: string): Promise<void> {
    if (docs.length === 0) return;
    const rows = docs.map((doc) => {
      const row: Record<string, unknown> = {
        document_id: doc.documentId,
        recording_id: doc.recordingId,
        document_type: doc.documentType,
        document_title: doc.documentTitle,
        content: doc.content,
        locale: doc.locale,
        created_at_utc: doc.createdAtUtc,
        created_by: doc.createdBy,
        created_by_name: doc.createdByName || null,
        last_modified_at_utc: doc.lastModifiedAtUtc || null,
        last_modified_by: doc.lastModifiedBy || null,
        recording_name: doc.recordingName,
        product_area: doc.productArea,
        folder: doc.folder || null,
      };
      if (workspaceId) row.workspace_id = workspaceId;
      return row;
    });
    const { error } = await this.supabase.from('documents').insert(rows);
    if (error) {
      this.logger.error(`Failed to save documents: ${error.message}`);
      throw new Error('Failed to save generated documents.');
    }
  }

  async findById(documentId: string): Promise<GeneratedDocument | null> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('document_id', documentId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to load document ${documentId}: ${error.message}`);
      throw new Error('Failed to load document.');
    }
    if (!data) return null;
    return {
      documentId: String(data.document_id || ''),
      recordingId: String(data.recording_id || ''),
      documentType: String(data.document_type || ''),
      documentTitle: String(data.document_title || ''),
      content: String(data.content || ''),
      locale: String(data.locale || 'en-AU'),
      createdAtUtc: String(data.created_at_utc || ''),
      createdBy: String(data.created_by || ''),
      createdByName: typeof data.created_by_name === 'string' ? data.created_by_name : undefined,
      lastModifiedAtUtc:
        typeof data.last_modified_at_utc === 'string' ? data.last_modified_at_utc : undefined,
      lastModifiedBy:
        typeof data.last_modified_by === 'string' ? data.last_modified_by : undefined,
      recordingName: String(data.recording_name || ''),
      productArea: String(data.product_area || ''),
      folder: typeof data.folder === 'string' ? data.folder : undefined,
    };
  }

  async findAll(
    query: DocumentListQuery,
    workspaceId?: string,
  ): Promise<PaginatedResponse<DocumentSummary>> {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    let request = this.supabase
      .from('documents')
      .select(
        'document_id, document_title, document_type, recording_id, recording_name, product_area, folder, created_at_utc, created_by',
        { count: 'exact' },
      )
      .order('created_at_utc', { ascending: false });

    if (workspaceId) request = request.eq('workspace_id', workspaceId);
    if (query.documentType) request = request.eq('document_type', query.documentType);
    if (query.productArea) request = request.eq('product_area', query.productArea);
    if (query.folder) request = request.eq('folder', query.folder.trim());
    if (query.search) request = request.ilike('document_title', `%${query.search.trim()}%`);
    if (query.dateFrom) request = request.gte('created_at_utc', query.dateFrom);
    if (query.dateTo) request = request.lte('created_at_utc', query.dateTo);

    const { data, error, count } = await request.range(skip, skip + pageSize - 1);
    if (error) {
      this.logger.error(`Failed to list documents: ${error.message}`);
      throw new Error('Failed to list documents.');
    }

    const items = ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      documentId: String(row.document_id || ''),
      documentTitle: String(row.document_title || ''),
      documentType: String(row.document_type || ''),
      recordingId: String(row.recording_id || ''),
      recordingName: String(row.recording_name || ''),
      productArea: String(row.product_area || ''),
      folder: typeof row.folder === 'string' ? row.folder : undefined,
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
    }));

    return {
      items,
      total: count || 0,
      page,
      pageSize,
      hasMore: skip + items.length < (count || 0),
    };
  }

  async findSummariesByIds(
    documentIds: string[],
    userIds?: string[],
  ): Promise<DocumentSummary[]> {
    const ids = Array.from(new Set(documentIds.map((value) => value.trim()).filter(Boolean)));
    if (ids.length === 0) {
      return [];
    }

    let request = this.supabase
      .from('documents')
      .select(
        'document_id, document_title, document_type, recording_id, recording_name, product_area, folder, created_at_utc, created_by',
      )
      .in('document_id', ids);

    if (userIds?.length) {
      request = request.in('created_by', userIds);
    }

    const { data, error } = await request;
    if (error) {
      this.logger.error(`Failed to load document summaries by id: ${error.message}`);
      throw new Error('Failed to load documents.');
    }

    const summaries = ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      documentId: String(row.document_id || ''),
      documentTitle: String(row.document_title || ''),
      documentType: String(row.document_type || ''),
      recordingId: String(row.recording_id || ''),
      recordingName: String(row.recording_name || ''),
      productArea: String(row.product_area || ''),
      folder: typeof row.folder === 'string' ? row.folder : undefined,
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
    }));

    const index = new Map(summaries.map((summary) => [summary.documentId, summary]));
    return ids.map((id) => index.get(id)).filter(Boolean) as DocumentSummary[];
  }

  async deleteById(documentId: string, userId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('documents')
      .delete({ count: 'exact' })
      .eq('document_id', documentId)
      .eq('created_by', userId);
    if (error) {
      this.logger.error(`Failed to delete document ${documentId}: ${error.message}`);
      throw new Error('Failed to delete document.');
    }
    return (count || 0) > 0;
  }

  async updateFolder(
    documentId: string,
    folder: string,
    modifiedBy: string,
  ): Promise<GeneratedDocument | null> {
    const { error } = await this.supabase
      .from('documents')
      .update({
        folder,
        last_modified_at_utc: new Date().toISOString(),
        last_modified_by: modifiedBy,
      })
      .eq('document_id', documentId);
    if (error) {
      this.logger.error(`Failed to update document folder ${documentId}: ${error.message}`);
      throw new Error('Failed to update document folder.');
    }
    return this.findById(documentId);
  }
}
