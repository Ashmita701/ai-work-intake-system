import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { WorkItemWorkflow } from './work-item.workflow';

@Module({
  imports: [AiModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService, WorkItemWorkflow],
})
export class WorkItemsModule {}
