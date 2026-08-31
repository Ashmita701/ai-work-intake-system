import { Module } from '@nestjs/common';

import { AI_PROVIDER } from './ai-provider.token';
import { MockAiProvider } from './mock-ai.provider';

@Module({
  providers: [
    MockAiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: MockAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
