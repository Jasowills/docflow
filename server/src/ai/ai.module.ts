import { Module, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { TEXT_GENERATION_PROVIDER } from './text-generation.interface';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Module({
  providers: [
    OpenRouterProvider,
    {
      provide: TEXT_GENERATION_PROVIDER,
      useFactory: (config: AppConfig, openRouter: OpenRouterProvider) => {
        const logger = new Logger('AiModule');
        if (config.aiProvider !== 'openrouter') {
          throw new Error(
            `Unsupported AI provider: ${config.aiProvider}. DocFlow is configured to use OpenRouter only.`,
          );
        }
        logger.log('AI text generation provider: openrouter');
        return openRouter;
      },
      inject: [AppConfig, OpenRouterProvider],
    },
  ],
  exports: [TEXT_GENERATION_PROVIDER],
})
export class AiModule {}
