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
export class OpenRouterProvider implements ITextGenerationProvider {
  readonly providerName = 'openrouter';
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: AppConfig) {
    this.client = new OpenAI({
      apiKey: config.openRouterApiKey,
      baseURL: config.openRouterBaseUrl,
      defaultHeaders: {
        'HTTP-Referer': config.openRouterSiteUrl,
        'X-Title': config.openRouterAppName,
      },
    });
    this.model = config.openRouterModel;
  }

  async generate(
    messages: ChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    this.logger.debug(
      `OpenRouter: generating with ${messages.length} messages, model=${this.model}`,
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: options?.temperature ?? this.config.aiTemperature,
      max_tokens: options?.maxTokens ?? this.config.aiMaxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      model: response.model || this.model,
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
