import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkItemsModule } from './work-items/work-items.module';

@Module({
  imports: [PrismaModule, WorkItemsModule, AiModule],
})
export class AppModule {}
