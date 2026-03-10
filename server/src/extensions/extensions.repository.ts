import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type { ExtensionReleaseInfo } from '@docflow/shared';

@Injectable()
export class ExtensionsRepository {
  private readonly logger = new Logger(ExtensionsRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async upsertRelease(doc: ExtensionReleaseInfo): Promise<ExtensionReleaseInfo> {
    const { error } = await this.supabase.from('extension_releases').upsert(
      {
        version: doc.version,
        download_url: doc.downloadUrl,
        notes: doc.notes || null,
        published_by: doc.publishedBy || null,
        published_at_utc: doc.publishedAtUtc,
      },
      { onConflict: 'version' },
    );
    if (error) {
      this.logger.error(`Failed to save extension release ${doc.version}: ${error.message}`);
      throw new Error('Failed to save extension release.');
    }
    return doc;
  }

  async getLatestRelease(): Promise<ExtensionReleaseInfo | null> {
    const { data, error } = await this.supabase
      .from('extension_releases')
      .select('*')
      .order('published_at_utc', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to load latest extension release: ${error.message}`);
      throw new Error('Failed to load extension release.');
    }
    if (!data) return null;
    return {
      version: String(data.version || ''),
      downloadUrl: String(data.download_url || ''),
      publishedAtUtc: String(data.published_at_utc || ''),
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      publishedBy: typeof data.published_by === 'string' ? data.published_by : undefined,
    };
  }
}
