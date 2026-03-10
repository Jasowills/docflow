import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/app-config';
import { SUPABASE_CLIENT } from '../database/supabase.providers';

@Injectable()
export class ScreenshotStorageService {
  private readonly logger = new Logger(ScreenshotStorageService.name);

  constructor(
    private readonly config: AppConfig,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {
    if (!this.isEnabled()) {
      this.logger.warn(
        'Supabase Storage screenshot storage is disabled. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.',
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(
      this.config.supabaseUrl &&
        this.config.supabaseServiceRoleKey &&
        this.config.supabaseStorageBucket,
    );
  }

  async uploadDataUrl(dataUrl: string, objectPath: string): Promise<string | null> {
    if (!this.isEnabled() || !dataUrl?.startsWith('data:image/')) {
      return null;
    }

    const parsed = this.parseDataUrl(dataUrl);
    if (!parsed) return null;

    try {
      const bucket = this.config.supabaseStorageBucket;
      const uploadResult = await this.supabase.storage.from(bucket).upload(objectPath, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: true,
        cacheControl: '31536000',
      });

      if (uploadResult.error) {
        this.logger.warn(
          `Supabase upload failed for ${objectPath}: ${uploadResult.error.message}`,
        );
        return null;
      }

      const signed = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, this.config.supabaseStorageSignedUrlTtlSeconds);

      if (signed.error) {
        this.logger.warn(
          `Signed URL generation failed for ${objectPath}: ${signed.error.message}`,
        );
        const { data } = this.supabase.storage.from(bucket).getPublicUrl(objectPath);
        return data.publicUrl || null;
      }

      return signed.data.signedUrl;
    } catch (error) {
      this.logger.warn(
        `Supabase Storage upload failed for ${objectPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;

    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }
}
