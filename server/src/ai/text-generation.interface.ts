// ─────────────────────────────────────────────────────────────
// Provider-agnostic text generation interface
// ─────────────────────────────────────────────────────────────

/** A single message in the conversation to the LLM */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options for text generation */
export interface TextGenerationOptions {
  temperature?: number;
  maxTokens?: number;
}

/** Result from text generation */
export interface TextGenerationResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Provider-agnostic interface for text generation.
 * Implement this for each AI provider (Azure OpenAI, OpenAI, Anthropic, etc.)
 */
export interface ITextGenerationProvider {
  /** Unique identifier for this provider */
  readonly providerName: string;

  /**
   * Generate text from a sequence of chat messages.
   * @param messages - The conversation messages including system prompt
   * @param options  - Generation options (temperature, max tokens)
   * @returns The generated text and metadata
   */
  generate(
    messages: ChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult>;
}

/** Injection token for the active text generation provider */
export const TEXT_GENERATION_PROVIDER = 'TEXT_GENERATION_PROVIDER';
