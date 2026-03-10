import { PromptBuilderService } from '../src/documents/prompt-builder.service';
import type { RecordingDocument, DocumentTypeConfig } from '@docflow/shared';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  const mockRecording: RecordingDocument = {
    metadata: {
      recordingId: 'rec-001',
      name: 'Create Pickup Route',
      createdAtUtc: '2026-02-23T08:30:00Z',
      createdBy: 'tester@routectrl.com',
      productName: 'RouteCTRL',
      productArea: 'Operator App',
      applicationVersion: '4.2.0',
      environment: 'UAT',
    },
    events: [
      {
        timestampMs: 0,
        type: 'navigation',
        url: 'https://app.routectrl.com/calendar',
        title: 'RouteCTRL Calendar',
        description: 'User opened Route calendar',
      },
      {
        timestampMs: 5234,
        type: 'click',
        selector: 'button#create-route',
        label: 'Create Route',
        description: 'User clicks Create Route',
      },
      {
        timestampMs: 11000,
        type: 'input',
        selector: "input[name='routeName']",
        fieldName: 'Route Name',
        value: 'Enviro Pickup Run',
        description: 'User enters route name',
      },
    ],
    speechTranscripts: [
      {
        timestampMs: 2000,
        speaker: 'host',
        text: 'In this recording we will create a new pickup route.',
      },
    ],
    userId: 'user-123',
    uploadedAtUtc: '2026-02-23T08:31:00Z',
  };

  const mockDocType: DocumentTypeConfig = {
    key: 'tutorial',
    name: 'Tutorial Documentation',
    description: 'Step-by-step tutorial',
    systemPrompt: 'Generate a step-by-step tutorial document.',
    isActive: true,
    sortOrder: 2,
    createdAtUtc: '2026-01-01T00:00:00Z',
  };

  const globalPrompt = 'You are a professional technical writer for RouteCTRL.';

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('should produce exactly 2 messages (system + user)', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'How to Create a Pickup Route',
      locale: 'en-AU',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('should include global prompt and doc type prompt in system message', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const system = messages[0].content;
    expect(system).toContain(globalPrompt);
    expect(system).toContain(mockDocType.systemPrompt);
    expect(system).toContain('Tutorial Documentation');
    expect(system).toContain('en-AU');
  });

  it('should include recording metadata in user message', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).toContain('RouteCTRL');
    expect(user).toContain('Operator App');
    expect(user).toContain('4.2.0');
    expect(user).toContain('UAT');
    expect(user).toContain('tester@routectrl.com');
  });

  it('should include all events with timestamps', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).toContain('navigation');
    expect(user).toContain('click');
    expect(user).toContain('input');
    expect(user).toContain('Create Route');
    expect(user).toContain('Enviro Pickup Run');
  });

  it('should include speech transcripts', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).toContain('Speech Narration Transcript');
    expect(user).toContain('create a new pickup route');
  });

  it('should include user guidance when provided', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      guidance: 'Focus on the multi-day planning workflow',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).toContain('Additional Guidance');
    expect(user).toContain('multi-day planning workflow');
  });

  it('should omit guidance section when not provided', () => {
    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: mockRecording,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).not.toContain('Additional Guidance');
  });

  it('should omit speech section when no transcripts exist', () => {
    const recordingNoSpeech = {
      ...mockRecording,
      speechTranscripts: [],
    };

    const messages = service.buildMessages({
      globalSystemPrompt: globalPrompt,
      docTypeConfig: mockDocType,
      recording: recordingNoSpeech,
      documentTitle: 'Test Doc',
      locale: 'en-AU',
    });

    const user = messages[1].content;
    expect(user).not.toContain('Speech Narration Transcript');
  });
});


