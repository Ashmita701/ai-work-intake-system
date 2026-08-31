import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { WorkItem } from '@prisma/client';
import type { Response } from 'express';

import { CreateWorkItemDto } from './dto/create-work-item.dto';
import { UpdateWorkItemStatusDto } from './dto/update-work-item-status.dto';
import { WorkItemsService } from './work-items.service';

export interface CreateWorkItemResponse {
  workItem: WorkItem;
  created: boolean;
  message?: string;
}

@Controller('work-items')
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Post()
  async create(
    @Body() createWorkItemDto: CreateWorkItemDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateWorkItemResponse> {
    const result = await this.workItemsService.create(createWorkItemDto);

    if (!result.created) {
      response.status(HttpStatus.OK);
      return {
        workItem: result.workItem,
        created: false,
        message:
          'A work item with this externalId already exists; the existing work item was returned.',
      };
    }

    return { workItem: result.workItem, created: true };
  }

  @Get()
  findAll(): Promise<WorkItem[]> {
    return this.workItemsService.findAll();
  }

  @Post(':id/analyse')
  analyse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<WorkItem> {
    return this.workItemsService.analyse(id);
  }

  @Post(':id/retry')
  retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<WorkItem> {
    return this.workItemsService.retry(id);
  }

  @Patch(':id/status')
  complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() _: UpdateWorkItemStatusDto,
  ): Promise<WorkItem> {
    return this.workItemsService.complete(id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<WorkItem> {
    return this.workItemsService.findOne(id);
  }
}
