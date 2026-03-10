import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfig } from '../../config/app-config';
import type {
  ITextGenerationProvider,
  ChatMessage,
  TextGenerationOptions,
  TextGenerationResult,
} from '../text-generation.interface';

@Injectable()
export class OpenAiProvider implements ITextGenerationProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: AppConfig) {
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
    this.model = config.openAiModel;
  }

  async generate(
    messages: ChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    this.logger.debug(
      `OpenAI: generating with ${messages.length} messages, model=${this.model}`,
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? this.config.aiTemperature,
      max_tokens: options?.maxTokens ?? this.config.aiMaxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}
