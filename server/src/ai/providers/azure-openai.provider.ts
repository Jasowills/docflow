import { Injectable, Logger } from '@nestjs/common';
import { AzureOpenAI } from 'openai';
import { AppConfig } from '../../config/app-config';
import type {
  ITextGenerationProvider,
  ChatMessage,
  TextGenerationOptions,
  TextGenerationResult,
} from '../text-generation.interface';

@Injectable()
export class AzureOpenAiProvider implements ITextGenerationProvider {
  readonly providerName = 'azure-openai';
  private readonly logger = new Logger(AzureOpenAiProvider.name);
  private readonly client: AzureOpenAI;
  private readonly model: string;

  constructor(private readonly config: AppConfig) {
    this.client = new AzureOpenAI({
      apiKey: config.azureOpenAiApiKey,
      endpoint: config.azureOpenAiEndpoint,
      apiVersion: config.azureOpenAiApiVersion,
      deployment: config.azureOpenAiDeploymentName,
    });
    this.model = config.azureOpenAiDeploymentName;
  }

  async generate(
    messages: ChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    const systemMessages = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean);
    const conversationMessages = messages.filter(
      (message) => message.role !== 'system',
    );
    const payload = {
      model: this.model,
      instructions: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
      input: conversationMessages.map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.content }],
      })),
      max_output_tokens: options?.maxTokens ?? this.config.aiMaxTokens,
    };

    this.logger.log(
      `Azure OpenAI request payload: ${JSON.stringify(payload)}`,
    );

    try {
      const response = await this.client.responses.create(payload as any);

      return {
        content: this.extractText(response),
        model: (response as any).model || this.model,
        usage: (response as any).usage
          ? {
              promptTokens: (response as any).usage.input_tokens ?? 0,
              completionTokens: (response as any).usage.output_tokens ?? 0,
              totalTokens: (response as any).usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error: any) {
      const details =
        error?.error ??
        error?.response?.data ??
        error?.response?.body ??
        error?.cause ??
        error?.message;

      this.logger.error(
        `Azure OpenAI generation failed for model=${this.model}: ${typeof details === 'string' ? details : JSON.stringify(details)}`,
      );
      throw error;
    }
  }

  private extractText(response: any): string {
    if (typeof response?.output_text === 'string' && response.output_text.trim()) {
      return response.output_text;
    }

    const output = Array.isArray(response?.output) ? response.output : [];
    const chunks: string[] = [];

    for (const item of output) {
      const contents = Array.isArray(item?.content) ? item.content : [];
      for (const content of contents) {
        if (typeof content?.text === 'string' && content.text.trim()) {
          chunks.push(content.text);
        }
      }
    }

    return chunks.join('\n\n').trim();
  }
}
