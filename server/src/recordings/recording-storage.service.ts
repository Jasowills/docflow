import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import { AppConfig } from '../config/app-config';

@Injectable()
export class RecordingStorageService {
  private readonly logger = new Logger(RecordingStorageService.name);
  private readonly isEnabled: boolean;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: AppConfig,
  ) {
    this.isEnabled = !!(
      this.config.supabaseUrl &&
      this.config.supabaseServiceRoleKey &&
      this.config.supabaseStorageBucket
    );
  }

  /**
   * Generate a signed upload URL for the extension to upload a recording JSON file directly.
   */
  async generateUploadUrl(recordingId: string): Promise<string | null> {
    if (!this.isEnabled) return null;

    const bucket = this.config.supabaseStorageBucket;
    const objectPath = `recordings/${recordingId}.json`;

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath);

      if (error) {
        this.logger.error(`Failed to create signed upload URL: ${error.message}`);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      this.logger.error(`Error creating signed upload URL: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Read a recording JSON file from Storage and return its contents.
   */
  async readRecordingFromStorage(recordingId: string): Promise<Record<string, unknown> | null> {
    if (!this.isEnabled) return null;

    const bucket = this.config.supabaseStorageBucket;
    const objectPath = `recordings/${recordingId}.json`;

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .download(objectPath);

      if (error) {
        this.logger.error(`Failed to download recording from Storage: ${error.message}`);
        return null;
      }

      const text = await data.text();
      return JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`Error reading recording from Storage: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Delete a recording JSON file from Storage.
   */
  async deleteFromStorage(recordingId: string): Promise<void> {
    if (!this.isEnabled) return;

    const bucket = this.config.supabaseStorageBucket;
    const objectPath = `recordings/${recordingId}.json`;

    try {
      await this.supabase.storage.from(bucket).remove([objectPath]);
    } catch (error) {
      this.logger.warn(`Failed to delete recording from Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
