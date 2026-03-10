import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DocumentsRepository } from './documents.repository';
import { RecordingsRepository } from '../recordings/recordings.repository';
import { PromptBuilderService } from './prompt-builder.service';
import { AdminService } from '../admin/admin.service';
import { AuditService } from '../common/services/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  TEXT_GENERATION_PROVIDER,
  ITextGenerationProvider,
} from '../ai/text-generation.interface';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import type {
  GeneratedDocument,
  UserContext,
  DocumentListQuery,
  PaginatedResponse,
  DocumentSummary,
} from '@docflow/shared';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly recordingsRepository: RecordingsRepository,
    private readonly promptBuilder: PromptBuilderService,
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(TEXT_GENERATION_PROVIDER)
    private readonly aiProvider: ITextGenerationProvider,
  ) {}

  async generate(
    dto: GenerateDocumentDto,
    user: UserContext,
  ): Promise<GeneratedDocument[]> {
    // 1. Load recording
    const recording = await this.recordingsRepository.findByIdentifier(
      dto.recordingId,
    );
    if (!recording) {
      throw new NotFoundException(
        `Recording ${dto.recordingId} not found`,
      );
    }

    // 2. Load system config
    const config = await this.adminService.getConfig();
    const locale = dto.locale || 'en-AU';
    const targetFolder = this.normalizeFolderName(dto.folder || 'Unfiled');

    // 3. Generate for each requested document type
    const generatedDocs: GeneratedDocument[] = [];

    for (const typeKey of dto.documentTypes) {
      const docTypeConfig = config.documentTypes.find(
        (dt) => dt.key === typeKey && dt.isActive,
      );
      if (!docTypeConfig) {
        throw new BadRequestException(
          `Document type "${typeKey}" not found or inactive`,
        );
      }

      // Build prompt
      const messages = this.promptBuilder.buildMessages({
        globalSystemPrompt: config.globalSystemPrompt,
        docTypeConfig,
        recording,
        documentTitle: dto.documentTitle,
        guidance: dto.guidance,
        locale,
        testCaseContext: dto.testCaseContext,
      });

      this.logger.log(
        `Generating ${docTypeConfig.name} for recording "${recording.metadata.name}" using ${this.aiProvider.providerName}`,
      );

      // Call AI provider
      const result = await this.aiProvider.generate(messages);

      this.logger.log(
        `Generated ${docTypeConfig.name}: ${result.usage?.totalTokens ?? '?'} tokens used`,
      );

      const doc: GeneratedDocument = {
        documentId: uuidv4(),
        recordingId: recording.metadata.recordingId,
        documentType: typeKey,
        documentTitle: dto.documentTitle,
        content:
          typeKey === 'test_case_suite'
            ? result.content
            : this.appendScreenshotsToMarkdown(result.content, recording),
        locale,
        createdAtUtc: new Date().toISOString(),
        createdBy: user.userId,
        createdByName: user.displayName || user.email,
        recordingName: recording.metadata.name,
        productArea: recording.metadata.productArea,
        folder: targetFolder,
      };

      generatedDocs.push(doc);
    }

    // 4. Persist all generated documents
    await this.documentsRepository.insertMany(generatedDocs);
    for (const doc of generatedDocs) {
      this.realtimeGateway.emitDocumentPersisted(user.userId, {
        documentId: doc.documentId,
        documentTitle: doc.documentTitle,
        documentType: doc.documentType,
        createdAtUtc: doc.createdAtUtc,
      });
    }

    // 5. Audit
    await this.auditService.log({
      action: 'generate_documentation',
      userId: user.userId,
      userEmail: user.email,
      resourceType: 'document',
      details: {
        recordingId: recording.metadata.recordingId,
        documentTypes: dto.documentTypes,
        documentTitle: dto.documentTitle,
        documentsGenerated: generatedDocs.length,
      },
    });

    return generatedDocs;
  }

  private appendScreenshotsToMarkdown(content: string, recording: { screenshots?: Array<{
    id: string;
    timestampMs: number;
    reason: string;
    label?: string;
    imageDataUrl?: string;
    imageUrl?: string;
    thumbnailDataUrl?: string;
    thumbnailUrl?: string;
  }> }): string {
    const shots = (recording.screenshots ?? [])
      .filter(
        (shot) =>
          (typeof shot.imageUrl === 'string' && shot.imageUrl.startsWith('http')) ||
          (typeof shot.imageDataUrl === 'string' && shot.imageDataUrl.startsWith('data:image/')),
      )
      .slice(0, 8);

    if (shots.length === 0) {
      return content;
    }

    const shotsById = new Map(shots.map((shot) => [shot.id.toLowerCase(), shot]));
    const injected = new Set<string>();
    const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
    const lines = content.trim().split('\n');
    const outputLines: string[] = [];

    for (const line of lines) {
      outputLines.push(line);
      const idsInLine = Array.from(line.matchAll(uuidRegex)).map((m) => m[1]?.toLowerCase()).filter(Boolean) as string[];
      if (idsInLine.length === 0) continue;

      for (const id of idsInLine) {
        const shot = shotsById.get(id);
        if (!shot || injected.has(id)) continue;
        injected.add(id);
        const alt = (shot.label || `${shot.reason} at ${shot.timestampMs}ms`)
          .replace(/\|/g, ' ')
          .trim();
        const image = shot.imageUrl || shot.imageDataUrl || shot.thumbnailUrl || shot.thumbnailDataUrl;
        outputLines.push('');
        outputLines.push(`![${alt}](${image})`);
      }
    }

    const output = outputLines.join('\n');

    // Keep a fallback section only for screenshots never referenced in steps.
    const leftovers = shots.filter((shot) => !injected.has(shot.id.toLowerCase()));
    if (leftovers.length === 0) {
      return `${output}\n`;
    }

    const fallbackLines: string[] = [];
    fallbackLines.push('');
    fallbackLines.push('---');
    fallbackLines.push('');
    fallbackLines.push('## Additional Visual References');
    fallbackLines.push('');
    for (const shot of leftovers) {
      const alt = (shot.label || `${shot.reason} at ${shot.timestampMs}ms`)
        .replace(/\|/g, ' ')
        .trim();
      const image = shot.imageUrl || shot.imageDataUrl || shot.thumbnailUrl || shot.thumbnailDataUrl;
      fallbackLines.push(`### Screenshot ${shot.id}`);
      fallbackLines.push(`![${alt}](${image})`);
      fallbackLines.push('');
    }

    return `${output}\n${fallbackLines.join('\n')}\n`;
  }

  async getById(documentId: string): Promise<GeneratedDocument> {
    const doc = await this.documentsRepository.findById(documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return doc;
  }

  async list(
    _user: UserContext,
    query: DocumentListQuery,
  ): Promise<PaginatedResponse<DocumentSummary>> {
    return this.documentsRepository.findAll(query);
  }

  async updateFolder(
    documentId: string,
    folderName: string,
    user: UserContext,
  ): Promise<GeneratedDocument> {
    const normalizedFolder = this.normalizeFolderName(folderName);
    const updated = await this.documentsRepository.updateFolder(
      documentId,
      normalizedFolder,
      user.userId,
    );
    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    await this.auditService.log({
      action: 'move_document_folder',
      userId: user.userId,
      userEmail: user.email,
      resourceType: 'document',
      resourceId: documentId,
      details: {
        documentTitle: updated.documentTitle,
        folder: normalizedFolder,
      },
    });

    return updated;
  }

  async delete(documentId: string, user: UserContext): Promise<void> {
    const existing = await this.documentsRepository.findById(documentId);
    if (!existing) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (existing.createdBy !== user.userId) {
      throw new ForbiddenException('You cannot delete another user\'s document.');
    }

    const deleted = await this.documentsRepository.deleteById(
      documentId,
      user.userId,
    );
    if (!deleted) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    await this.auditService.log({
      action: 'delete_document',
      userId: user.userId,
      userEmail: user.email,
      resourceType: 'document',
      resourceId: documentId,
    });
  }

  private normalizeFolderName(rawFolder: string): string {
    const trimmed = String(rawFolder || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Folder name is required');
    }
    if (trimmed.length > 80) {
      throw new BadRequestException('Folder name must be 80 characters or less');
    }
    if (trimmed.toLowerCase() === 'unfiled') return 'Unfiled';
    return trimmed;
  }
}

