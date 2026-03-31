import { Injectable, Logger } from '@nestjs/common';
import type {
  RecordingDocument,
  DocumentTypeConfig,
  TestCaseGenerationContext,
} from '@docflow/shared';
import type { ChatMessage } from '../ai/text-generation.interface';

/**
 * Builds structured prompts for the LLM based on recording data,
 * configuration, and user guidance.
 */
@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  /**
   * Construct the full message array for a document generation request.
   */
  buildMessages(params: {
    globalSystemPrompt: string;
    docTypeConfig: DocumentTypeConfig;
    recording: RecordingDocument;
    documentTitle: string;
    guidance?: string;
    locale: string;
    testCaseContext?: TestCaseGenerationContext;
  }): ChatMessage[] {
    const {
      globalSystemPrompt,
      docTypeConfig,
      recording,
      documentTitle,
      guidance,
      locale,
      testCaseContext,
    } = params;

    // ── System prompt: global + doc-type specific ──
    const systemContent = this.buildSystemPrompt(
      globalSystemPrompt,
      docTypeConfig,
      locale,
    );

    // ── User prompt: recording data + instructions ──
    const userContent = this.buildUserPrompt(
      recording,
      documentTitle,
      docTypeConfig,
      guidance,
      locale,
      testCaseContext,
    );

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  private buildSystemPrompt(
    globalPrompt: string,
    docType: DocumentTypeConfig,
    locale: string,
  ): string {
    return [
      globalPrompt,
      '',
      `--- Document Type: ${docType.name} ---`,
      docType.systemPrompt,
      '',
      `Output language/locale: ${locale}`,
      'Output format: Markdown',
      'Do not include raw JSON in the output.',
      'Produce professional, well-structured documentation suitable for enterprise use.',
    ].join('\n');
  }

  private buildUserPrompt(
    recording: RecordingDocument,
    documentTitle: string,
    docType: DocumentTypeConfig,
    guidance: string | undefined,
    locale: string,
    testCaseContext: TestCaseGenerationContext | undefined,
  ): string {
    const sections: string[] = [];

    // Title
    sections.push(`# Document Title: ${documentTitle}`);
    sections.push(`Document Type: ${docType.name}`);
    sections.push('');

    // Recording metadata
    sections.push('## Recording Metadata');
    sections.push(`- Application: ${recording.metadata.productName}`);
    sections.push(`- Feature Area: ${recording.metadata.productArea}`);
    if (recording.metadata.applicationVersion) {
      sections.push(`- Version: ${recording.metadata.applicationVersion}`);
    }
    if (recording.metadata.environment) {
      sections.push(`- Environment: ${recording.metadata.environment}`);
    }
    sections.push(`- Recorded by: ${recording.metadata.createdBy}`);
    sections.push(`- Recorded at: ${recording.metadata.createdAtUtc}`);
    sections.push('');

    // Events
    sections.push('## Captured Events');
    sections.push(
      'The following events were captured during the recording session:',
    );
    sections.push('');
    for (const event of recording.events) {
      const timeStr = this.formatTimestamp(event.timestampMs);
      let line = `[${timeStr}] **${event.type}**`;
      if (event.description) line += `: ${event.description}`;
      if (event.url) line += ` (URL: ${event.url})`;
      if (event.selector) line += ` [${event.selector}]`;
      if (event.label) line += ` — "${event.label}"`;
      if (event.fieldName && event.value) {
        line += ` — Field "${event.fieldName}" = "${event.value}"`;
      }
      if (event.eventContext) {
        line += ` | Context: ${event.eventContext}`;
      }
      sections.push(`- ${line}`);
    }
    sections.push('');

    // Speech transcripts
    if (recording.speechTranscripts.length > 0) {
      sections.push('## Speech Narration Transcript');
      sections.push(
        'The user narrated the following while performing the actions:',
      );
      sections.push('');
      for (const seg of recording.speechTranscripts) {
        const timeStr = this.formatTimestamp(seg.timestampMs);
        sections.push(`- [${timeStr}] **${seg.speaker}**: "${seg.text}"`);
      }
      sections.push('');
    }

    if (
      docType.key !== 'test_case_suite' &&
      recording.screenshots &&
      recording.screenshots.length > 0
    ) {
      sections.push('## Key Screenshots');
      sections.push(
        'The following key screenshots were captured at important moments. Use them as cues for emphasis, sequencing, and screen-specific explanations:',
      );
      sections.push('');
      for (const shot of recording.screenshots.slice(0, 12)) {
        const timeStr = this.formatTimestamp(shot.timestampMs);
        const descriptor = [
          `reason=${shot.reason}`,
          shot.label ? `label="${shot.label}"` : undefined,
          shot.selector ? `selector=${shot.selector}` : undefined,
          shot.title ? `title="${shot.title}"` : undefined,
        ]
          .filter(Boolean)
          .join(', ');
        sections.push(`- [${timeStr}] Screenshot ${shot.id}: ${descriptor}`);
      }
      sections.push('');
    }

    // User guidance
    if (guidance) {
      sections.push('## Additional Guidance');
      sections.push(guidance);
      sections.push('');
    }

    if (docType.key === 'test_case_suite' && testCaseContext) {
      const contextRows = [
        ['Feature / Module', testCaseContext.featureName],
        ['Target Persona', testCaseContext.targetPersona],
        ['Acceptance Criteria', testCaseContext.acceptanceCriteria],
        ['Environment Context', testCaseContext.environmentContext],
        ['Risk Level', testCaseContext.riskLevel],
        ['Out of Scope', testCaseContext.outOfScope],
      ].filter(([, value]) => value && value.trim().length > 0);

      if (contextRows.length > 0) {
        sections.push('## Structured Test Case Inputs');
        for (const [label, value] of contextRows) {
          sections.push(`- ${label}: ${value}`);
        }
        sections.push('');
      }
    }

    // Final instruction
    sections.push('---');
    sections.push(
      `Based on the above recording data, generate a complete "${docType.name}" document titled "${documentTitle}" in ${locale} locale.`,
    );
    sections.push(
      'Use the events and narration to produce clear, professional content. Output in Markdown format.',
    );
    sections.push(
      'IMPORTANT: Do not include, mention, or reference any screenshot IDs, screenshot filenames, UUIDs, or technical identifiers anywhere in the output. These are internal technical details.',
    );
    if (docType.key === 'test_case_suite') {
      sections.push(
        'For every test case, each numbered step must be immediately followed by its own "Expected Result:" line inside the Steps content.',
      );
      sections.push(
        'Do not write all steps first and then provide one combined expected result for the whole case.',
      );
      sections.push(
        'Keep the top-level "Expected Result" field as the final overall case outcome only.',
      );
    }

    return sections.join('\n');
  }

  /** Convert milliseconds to MM:SS.mmm format */
  private formatTimestamp(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}


