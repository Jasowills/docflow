import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import { AuditService } from '../common/services/audit.service';
import { ScreenshotStorageService } from '../recordings/screenshot-storage.service';
import type {
  SystemConfig,
  UserContext,
  UpsertDocumentTypeRequest,
  DocumentTypeConfig,
  UpsertFolderConfigRequest,
  FolderConfig,
} from '@docflow/shared';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly repository: AdminRepository,
    private readonly auditService: AuditService,
    private readonly screenshotStorage: ScreenshotStorageService,
  ) {}

  async getConfig(): Promise<SystemConfig> {
    return this.repository.getConfig();
  }

  async updateGlobalPrompt(
    prompt: string,
    user: UserContext,
  ): Promise<SystemConfig> {
    const config = await this.repository.updateGlobalPrompt(
      prompt,
      user.userId,
    );

    await this.auditService.log({
      action: 'update_global_prompt',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      details: { promptLength: prompt.length },
    });

    this.logger.log(`Global system prompt updated by ${user.email}`);
    return config;
  }

  async upsertDocumentType(
    dto: UpsertDocumentTypeRequest,
    user: UserContext,
  ): Promise<SystemConfig> {
    const docType: DocumentTypeConfig = {
      key: dto.key,
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder ?? 99,
      createdAtUtc: new Date().toISOString(),
    };

    const config = await this.repository.upsertDocumentType(
      docType,
      user.userId,
    );

    await this.auditService.log({
      action: 'upsert_document_type',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      resourceId: dto.key,
      details: { name: dto.name, isActive: dto.isActive },
    });

    this.logger.log(
      `Document type "${dto.key}" upserted by ${user.email}`,
    );
    return config;
  }

  async deleteDocumentType(
    key: string,
    user: UserContext,
  ): Promise<SystemConfig> {
    const config = await this.repository.deleteDocumentType(
      key,
      user.userId,
    );

    await this.auditService.log({
      action: 'delete_document_type',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      resourceId: key,
    });

    this.logger.log(
      `Document type "${key}" deleted by ${user.email}`,
    );
    return config;
  }

  async upsertFolderConfig(
    dto: UpsertFolderConfigRequest,
    user: UserContext,
  ): Promise<SystemConfig> {
    const folderConfig: FolderConfig = {
      key: dto.key,
      displayName: dto.displayName,
      tag: dto.tag,
      description: dto.description,
      previewImageUrl: dto.previewImageUrl,
      sortOrder: dto.sortOrder ?? 99,
      createdAtUtc: new Date().toISOString(),
    };

    const config = await this.repository.upsertFolderConfig(folderConfig, user.userId);

    await this.auditService.log({
      action: 'upsert_folder_config',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      resourceId: dto.key,
      details: {
        displayName: dto.displayName,
        tag: dto.tag,
        hasPreviewImage: !!dto.previewImageUrl,
      },
    });

    this.logger.log(`Folder config "${dto.key}" upserted by ${user.email}`);
    return config;
  }

  async deleteFolderConfig(
    key: string,
    user: UserContext,
  ): Promise<SystemConfig> {
    const config = await this.repository.deleteFolderConfig(key, user.userId);

    await this.auditService.log({
      action: 'delete_folder_config',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      resourceId: key,
    });

    this.logger.log(`Folder config "${key}" deleted by ${user.email}`);
    return config;
  }

  async uploadFolderPreviewImage(
    dataUrl: string,
    folderKey: string | undefined,
    user: UserContext,
  ): Promise<{ url: string }> {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new BadRequestException('A valid image file is required');
    }
    if (!this.screenshotStorage.isEnabled()) {
      throw new BadRequestException(
        'Image storage is not configured. Configure Supabase Storage first.',
      );
    }

    const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch?.[1] || 'image/jpeg';
    const extension = mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
      ? 'webp'
      : 'jpg';
    const safeFolder = String(folderKey || 'misc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'misc';
    const blobPath = `folder-previews/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

    const url = await this.screenshotStorage.uploadDataUrl(dataUrl, blobPath);
    if (!url) {
      throw new BadRequestException('Failed to upload preview image');
    }

    await this.auditService.log({
      action: 'upload_folder_preview_image',
      userId: user.userId,
      userEmail: user.email,
      userName: user.displayName,
      resourceType: 'config',
      resourceId: folderKey || 'misc',
      details: {
        blobPath,
      },
    });

    return { url };
  }
}

