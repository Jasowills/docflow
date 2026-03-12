import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppConfig } from '../../config/app-config';
import type {
  ITextGenerationProvider,
  ChatMessage,
  TextGenerationOptions,
  TextGenerationResult,
} from '../text-generation.interface';

@Injectable()
export class AnthropicProvider implements ITextGenerationProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly config: AppConfig) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.anthropicModel;
  }

  async generate(
    messages: ChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    this.logger.debug(
      `Anthropic: generating with ${messages.length} messages, model=${this.model}`,
    );

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? this.config.aiMaxTokens,
      temperature: options?.temperature ?? this.config.aiTemperature,
      system: systemMessage?.content,
      messages: conversationMessages,
    });

    const textBlock = response.content.find(
      (block): block is { type: 'text'; text: string } => block.type === 'text',
    );
    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
