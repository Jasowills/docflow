import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from '../src/documents/documents.service';
import { DocumentsRepository } from '../src/documents/documents.repository';
import { RecordingsRepository } from '../src/recordings/recordings.repository';
import { PromptBuilderService } from '../src/documents/prompt-builder.service';
import { AdminService } from '../src/admin/admin.service';
import { AuditService } from '../src/common/services/audit.service';
import {
  TEXT_GENERATION_PROVIDER,
  ITextGenerationProvider,
} from '../src/ai/text-generation.interface';
import type { RecordingDocument, SystemConfig, UserContext } from '@docflow/shared';

describe('DocumentsService (integration with mocked LLM)', () => {
  let service: DocumentsService;
  let mockAiProvider: jest.Mocked<ITextGenerationProvider>;
  let mockDocumentsRepo: Partial<jest.Mocked<DocumentsRepository>>;
  let mockRecordingsRepo: Partial<jest.Mocked<RecordingsRepository>>;
  let mockAdminService: Partial<jest.Mocked<AdminService>>;
  let mockAuditService: Partial<jest.Mocked<AuditService>>;

  const testUser: UserContext = {
    userId: 'user-123',
    email: 'tester@routectrl.com',
    displayName: 'Test User',
    roles: [],
  };

  const testRecording: RecordingDocument = {
    metadata: {
      recordingId: 'rec-001',
      name: 'Create Route',
      createdAtUtc: '2026-02-23T08:30:00Z',
      createdBy: 'tester@routectrl.com',
      productName: 'RouteCTRL',
      productArea: 'Operator App',
    },
    events: [
      {
        timestampMs: 0,
        type: 'navigation',
        url: 'https://app.routectrl.com/calendar',
        title: 'Calendar',
        description: 'Opened calendar',
      },
    ],
    speechTranscripts: [],
    userId: 'user-123',
    uploadedAtUtc: '2026-02-23T08:31:00Z',
  };

  const testConfig: SystemConfig = {
    configType: 'system',
    globalSystemPrompt: 'You are a technical writer.',
    documentTypes: [
      {
        key: 'tutorial',
        name: 'Tutorial',
        description: 'Step by step tutorial',
        systemPrompt: 'Generate a tutorial.',
        isActive: true,
        sortOrder: 1,
        createdAtUtc: '2026-01-01T00:00:00Z',
      },
    ],
    lastModifiedAtUtc: '2026-01-01T00:00:00Z',
    lastModifiedBy: 'system',
  };

  beforeEach(async () => {
    mockAiProvider = {
      providerName: 'mock',
      generate: jest.fn().mockResolvedValue({
        content: '# Tutorial\n\nThis is the generated tutorial content.',
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      }),
    };

    mockDocumentsRepo = {
      insertMany: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };

    mockRecordingsRepo = {
      findByRecordingId: jest.fn().mockResolvedValue(testRecording),
    };

    mockAdminService = {
      getConfig: jest.fn().mockResolvedValue(testConfig),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        PromptBuilderService,
        { provide: DocumentsRepository, useValue: mockDocumentsRepo },
        { provide: RecordingsRepository, useValue: mockRecordingsRepo },
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: TEXT_GENERATION_PROVIDER, useValue: mockAiProvider },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should generate a document and persist it', async () => {
    const result = await service.generate(
      {
        recordingId: 'rec-001',
        documentTypes: ['tutorial'],
        documentTitle: 'How to Create a Route',
        locale: 'en-AU',
      },
      testUser,
    );

    expect(result).toHaveLength(1);
    expect(result[0].documentType).toBe('tutorial');
    expect(result[0].documentTitle).toBe('How to Create a Route');
    expect(result[0].content).toContain('Tutorial');
    expect(result[0].createdBy).toBe('user-123');
    expect(result[0].recordingName).toBe('Create Route');
    expect(result[0].productArea).toBe('Operator App');

    expect(mockAiProvider.generate).toHaveBeenCalledTimes(1);
    expect(mockDocumentsRepo.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ documentType: 'tutorial' }),
      ]),
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'generate_documentation' }),
    );
  });

  it('should throw NotFoundException for unknown recording', async () => {
    mockRecordingsRepo.findByRecordingId!.mockResolvedValue(null);

    await expect(
      service.generate(
        {
          recordingId: 'unknown',
          documentTypes: ['tutorial'],
          documentTitle: 'Test',
          locale: 'en-AU',
        },
        testUser,
      ),
    ).rejects.toThrow('not found');
  });

  it('should throw BadRequestException for unknown document type', async () => {
    await expect(
      service.generate(
        {
          recordingId: 'rec-001',
          documentTypes: ['nonexistent_type'],
          documentTitle: 'Test',
          locale: 'en-AU',
        },
        testUser,
      ),
    ).rejects.toThrow('not found or inactive');
  });

  it('should generate multiple document types in one request', async () => {
    const configWithMultipleTypes: SystemConfig = {
      ...testConfig,
      documentTypes: [
        ...testConfig.documentTypes,
        {
          key: 'release_notes',
          name: 'Release Notes',
          description: 'Release notes',
          systemPrompt: 'Generate release notes.',
          isActive: true,
          sortOrder: 2,
          createdAtUtc: '2026-01-01T00:00:00Z',
        },
      ],
    };
    mockAdminService.getConfig!.mockResolvedValue(configWithMultipleTypes);

    const result = await service.generate(
      {
        recordingId: 'rec-001',
        documentTypes: ['tutorial', 'release_notes'],
        documentTitle: 'Multi Generate',
        locale: 'en-AU',
      },
      testUser,
    );

    expect(result).toHaveLength(2);
    expect(mockAiProvider.generate).toHaveBeenCalledTimes(2);
  });
});

