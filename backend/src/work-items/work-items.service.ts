import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { WorkItem, WorkItemStatus } from '@prisma/client';

import { AI_PROVIDER } from '../ai/ai-provider.token';
import type {
  AiProvider,
  WorkItemAnalysis,
} from '../ai/ai-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkItemDto } from './dto/create-work-item.dto';
import { WorkItemWorkflow } from './work-item.workflow';

export interface CreateWorkItemResult {
  workItem: WorkItem;
  created: boolean;
}

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkItemWorkflow,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async create(createWorkItemDto: CreateWorkItemDto): Promise<CreateWorkItemResult> {
    try {
      const workItem = await this.prisma.workItem.create({
        data: {
          externalId: createWorkItemDto.externalId,
          title: createWorkItemDto.title,
          description: createWorkItemDto.description,
          status: WorkItemStatus.RECEIVED,
        },
      });

      return { workItem, created: true };
    } catch (error: unknown) {
      if (!this.isExternalIdUniqueConstraintError(error)) {
        throw error;
      }

      const workItem = await this.prisma.workItem.findUnique({
        where: { externalId: createWorkItemDto.externalId },
      });

      // The database has enforced uniqueness. If the row cannot be read after
      // a collision, propagate the original error rather than returning a false result.
      if (!workItem) {
        throw error;
      }

      return { workItem, created: false };
    }
  }

  findAll(): Promise<WorkItem[]> {
    return this.prisma.workItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<WorkItem> {
    const workItem = await this.prisma.workItem.findUnique({ where: { id } });

    if (!workItem) {
      throw new NotFoundException(`Work item with id '${id}' was not found.`);
    }

    return workItem;
  }

  async transitionStatus(
    id: string,
    nextStatus: WorkItemStatus,
  ): Promise<WorkItem> {
    const workItem = await this.findOne(id);
    this.workflow.assertTransition(workItem.status, nextStatus);

    return this.prisma.workItem.update({
      where: { id },
      data: { status: nextStatus },
    });
  }

  async analyse(id: string): Promise<WorkItem> {
    const workItem = await this.findOne(id);
    this.workflow.assertCanStartAnalysis(workItem.status);

    return this.runAnalysis(workItem);
  }

  async retry(id: string): Promise<WorkItem> {
    const workItem = await this.findOne(id);
    this.workflow.assertCanRetryAnalysis(workItem.status);

    return this.runAnalysis(workItem);
  }

  async complete(id: string): Promise<WorkItem> {
    const workItem = await this.findOne(id);
    this.workflow.assertTransition(workItem.status, WorkItemStatus.COMPLETED);

    return this.prisma.workItem.update({
      where: { id },
      data: { status: WorkItemStatus.COMPLETED },
    });
  }

  private async runAnalysis(workItem: WorkItem): Promise<WorkItem> {
    await this.prisma.workItem.update({
      where: { id: workItem.id },
      data: {
        analysisError: null,
        status: WorkItemStatus.ANALYSING,
      },
    });

    try {
      const analysis = this.validateAnalysis(
        await this.getAnalysisFromProvider(workItem),
      );
      this.workflow.assertTransition(
        WorkItemStatus.ANALYSING,
        WorkItemStatus.READY_FOR_REVIEW,
      );

      return await this.prisma.workItem.update({
        where: { id: workItem.id },
        data: {
          ...analysis,
          analysisError: null,
          status: WorkItemStatus.READY_FOR_REVIEW,
        },
      });
    } catch (error: unknown) {
      const analysisError = this.getAnalysisError(error);
      this.workflow.assertTransition(
        WorkItemStatus.ANALYSING,
        WorkItemStatus.FAILED,
      );

      await this.prisma.workItem.update({
        where: { id: workItem.id },
        data: {
          analysisError,
          status: WorkItemStatus.FAILED,
        },
      });

      throw new InternalServerErrorException('Work item analysis failed.');
    }
  }

  private isExternalIdUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return false;
    }

    return error.code === 'P2002';
  }

  private async getAnalysisFromProvider(
    workItem: WorkItem,
  ): Promise<WorkItemAnalysis> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        this.aiProvider.analyse({
          title: workItem.title,
          description: workItem.description,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('AI provider timed out.')),
            10_000,
          );
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private validateAnalysis(analysis: unknown): WorkItemAnalysis {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('AI provider returned an invalid analysis response.');
    }

    const fields = ['category', 'priority', 'summary', 'recommendedAction'] as const;
    const value = analysis as Record<string, unknown>;
    const normalized = {} as Record<(typeof fields)[number], string>;

    for (const field of fields) {
      const fieldValue = value[field];
      if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
        throw new Error(
          `AI provider returned an invalid analysis response: ${field} must be a non-empty string.`,
        );
      }
      normalized[field] = fieldValue.trim();
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(normalized.priority)) {
      throw new Error(
        'AI provider returned an invalid analysis response: priority must be LOW, MEDIUM, or HIGH.',
      );
    }

    return normalized as WorkItemAnalysis;
  }

  private getAnalysisError(error: unknown): string {
    return error instanceof Error ? error.message : 'AI provider analysis failed.';
  }
}
