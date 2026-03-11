import { HttpException, Injectable, Logger } from '@nestjs/common';
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
    const requestedMaxTokens = options?.maxTokens ?? this.config.aiMaxTokens;

    this.logger.debug(
      `OpenRouter: generating with ${messages.length} messages, model=${this.model}, max_tokens=${requestedMaxTokens}`,
    );

    const candidates = buildMaxTokenCandidates(requestedMaxTokens);
    let lastError: unknown = null;

    for (const maxTokens of candidates) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: options?.temperature ?? this.config.aiTemperature,
          max_tokens: maxTokens,
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
      } catch (error) {
        lastError = error;
        if (!isOpenRouterBudgetError(error)) {
          throw error;
        }

        this.logger.warn(
          `OpenRouter rejected max_tokens=${maxTokens} due to budget/credit constraints. Retrying with a lower ceiling if available.`,
        );
      }
    }

    if (isOpenRouterBudgetError(lastError)) {
      throw new HttpException(
        'OpenRouter credit limit reached for the current token budget. Top up credits or lower AI_MAX_TOKENS to 2048-4096.',
        402,
      );
    }

    throw lastError instanceof Error ? lastError : new Error('OpenRouter generation failed');
  }
}

function buildMaxTokenCandidates(requestedMaxTokens: number): number[] {
  const normalized = Math.max(512, requestedMaxTokens);
  const fallbackSteps = [4096, 3072, 2048, 1536, 1024, 768, 512];
  const candidates = [normalized, ...fallbackSteps.filter((value) => value < normalized)];
  return Array.from(new Set(candidates));
}

function isOpenRouterBudgetError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = 'status' in error ? Number((error as { status?: unknown }).status) : NaN;
  const message =
    'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : '';

  return (
    status === 402 &&
    (
      message.includes('requires more credits') ||
      message.includes('fewer max_tokens') ||
      message.includes('can only afford')
    )
  );
}
