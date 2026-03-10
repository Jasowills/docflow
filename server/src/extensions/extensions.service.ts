import { Injectable, Logger } from '@nestjs/common';
import { ExtensionsRepository } from './extensions.repository';
import { PublishExtensionReleaseDto } from './dto/publish-extension-release.dto';
import type { ExtensionReleaseInfo, UserContext } from '@docflow/shared';

@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  constructor(private readonly repository: ExtensionsRepository) {}

  async publishRelease(
    dto: PublishExtensionReleaseDto,
    user?: UserContext,
  ): Promise<ExtensionReleaseInfo> {
    const release: ExtensionReleaseInfo = {
      version: dto.version.trim(),
      downloadUrl: dto.downloadUrl.trim(),
      notes: dto.notes?.trim() || undefined,
      publishedBy: user?.email || 'build-pipeline',
      publishedAtUtc: new Date().toISOString(),
    };
    const saved = await this.repository.upsertRelease(release);
    this.logger.log(`Published extension release v${saved.version}`);
    return saved;
  }

  async getLatestRelease(): Promise<ExtensionReleaseInfo | null> {
    return this.repository.getLatestRelease();
  }
}

