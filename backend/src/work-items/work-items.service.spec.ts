import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WorkItem, WorkItemStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WorkItemWorkflow } from './work-item.workflow';
import { WorkItemsService } from './work-items.service';

const workItem: WorkItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  externalId: 'CRM-12345',
  title: 'Missing income document',
  description: 'The applicant has not provided their latest payslip.',
  status: WorkItemStatus.RECEIVED,
  category: null,
  priority: null,
  summary: null,
  recommendedAction: null,
  analysisError: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('WorkItemsService', () => {
  const prisma = {
    workItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const aiProvider = { analyse: jest.fn() };
  const service = new WorkItemsService(
    prisma,
    new WorkItemWorkflow(),
    aiProvider,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a RECEIVED work item using only client-supplied fields', async () => {
    prisma.workItem.create = jest.fn().mockResolvedValue(workItem);

    await expect(
      service.create({
        externalId: workItem.externalId,
        title: workItem.title,
        description: workItem.description,
      }),
    ).resolves.toEqual({ workItem, created: true });

    expect(prisma.workItem.create).toHaveBeenCalledWith({
      data: {
        externalId: workItem.externalId,
        title: workItem.title,
        description: workItem.description,
        status: WorkItemStatus.RECEIVED,
      },
    });
  });

  it('returns the existing item after an externalId unique-constraint collision', async () => {
    prisma.workItem.create = jest.fn().mockRejectedValue({ code: 'P2002' });
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);

    await expect(
      service.create({
        externalId: workItem.externalId,
        title: workItem.title,
        description: workItem.description,
      }),
    ).resolves.toEqual({ workItem, created: false });

    expect(prisma.workItem.findUnique).toHaveBeenCalledWith({
      where: { externalId: workItem.externalId },
    });
  });

  it('orders the list by newest work item first', async () => {
    prisma.workItem.findMany = jest.fn().mockResolvedValue([workItem]);

    await expect(service.findAll()).resolves.toEqual([workItem]);
    expect(prisma.workItem.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws a 404-style exception when a work item is missing', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.findOne(workItem.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('moves a RECEIVED item to READY_FOR_REVIEW and saves valid AI analysis', async () => {
    const analysis = {
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: 'The applicant needs to provide their latest payslip.',
      recommendedAction: 'Request the missing payslip from the applicant.',
    };
    const analysedWorkItem = {
      ...workItem,
      ...analysis,
      status: WorkItemStatus.READY_FOR_REVIEW,
    };
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);
    prisma.workItem.update = jest
      .fn()
      .mockResolvedValueOnce({ ...workItem, status: WorkItemStatus.ANALYSING })
      .mockResolvedValueOnce(analysedWorkItem);
    aiProvider.analyse.mockResolvedValue(analysis);

    await expect(service.analyse(workItem.id)).resolves.toEqual(analysedWorkItem);

    expect(aiProvider.analyse).toHaveBeenCalledWith({
      title: workItem.title,
      description: workItem.description,
    });
    expect(prisma.workItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: workItem.id },
      data: {
        analysisError: null,
        status: WorkItemStatus.ANALYSING,
      },
    });
    expect(prisma.workItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: workItem.id },
      data: {
        ...analysis,
        analysisError: null,
        status: WorkItemStatus.READY_FOR_REVIEW,
      },
    });
  });

  it('moves an item to FAILED and records an error when the AI provider fails', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(workItem);
    aiProvider.analyse.mockRejectedValue(new Error('AI provider unavailable.'));

    await expect(service.analyse(workItem.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.workItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: workItem.id },
      data: {
        analysisError: 'AI provider unavailable.',
        status: WorkItemStatus.FAILED,
      },
    });
  });

  it('moves an item to FAILED without saving an invalid AI response', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(workItem);
    aiProvider.analyse.mockResolvedValue({
      category: '',
      priority: 'HIGH',
      summary: 'A summary',
      recommendedAction: 'An action',
    });

    await expect(service.analyse(workItem.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.workItem.update).toHaveBeenLastCalledWith({
      where: { id: workItem.id },
      data: {
        analysisError:
          'AI provider returned an invalid analysis response: category must be a non-empty string.',
        status: WorkItemStatus.FAILED,
      },
    });
  });

  it('rejects an AI response with an invalid priority', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(workItem);
    aiProvider.analyse.mockResolvedValue({
      category: 'DOCUMENT_REQUEST',
      priority: 'URGENT',
      summary: 'A summary',
      recommendedAction: 'An action',
    });

    await expect(service.analyse(workItem.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.workItem.update).toHaveBeenLastCalledWith({
      where: { id: workItem.id },
      data: {
        analysisError:
          'AI provider returned an invalid analysis response: priority must be LOW, MEDIUM, or HIGH.',
        status: WorkItemStatus.FAILED,
      },
    });
  });

  it('rejects an AI response with a malformed required field', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(workItem);
    aiProvider.analyse.mockResolvedValue({
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: null,
      recommendedAction: 'An action',
    });

    await expect(service.analyse(workItem.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.workItem.update).toHaveBeenLastCalledWith({
      where: { id: workItem.id },
      data: {
        analysisError:
          'AI provider returned an invalid analysis response: summary must be a non-empty string.',
        status: WorkItemStatus.FAILED,
      },
    });
  });

  it('rejects analysis for an invalid starting status', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue({
      ...workItem,
      status: WorkItemStatus.COMPLETED,
    });

    await expect(service.analyse(workItem.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(aiProvider.analyse).not.toHaveBeenCalled();
    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('retries a FAILED item and saves a successful AI analysis', async () => {
    const failedWorkItem = {
      ...workItem,
      analysisError: 'Previous AI provider failure.',
      status: WorkItemStatus.FAILED,
    };
    const analysis = {
      category: 'DOCUMENT_REQUEST',
      priority: 'HIGH',
      summary: 'The applicant needs to provide their latest payslip.',
      recommendedAction: 'Request the missing payslip from the applicant.',
    };
    const retriedWorkItem = {
      ...failedWorkItem,
      ...analysis,
      analysisError: null,
      status: WorkItemStatus.READY_FOR_REVIEW,
    };
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(failedWorkItem);
    prisma.workItem.update = jest
      .fn()
      .mockResolvedValueOnce({ ...failedWorkItem, status: WorkItemStatus.ANALYSING })
      .mockResolvedValueOnce(retriedWorkItem);
    aiProvider.analyse.mockResolvedValue(analysis);

    await expect(service.retry(workItem.id)).resolves.toEqual(retriedWorkItem);

    expect(prisma.workItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: workItem.id },
      data: {
        analysisError: null,
        status: WorkItemStatus.ANALYSING,
      },
    });
    expect(prisma.workItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: workItem.id },
      data: {
        ...analysis,
        analysisError: null,
        status: WorkItemStatus.READY_FOR_REVIEW,
      },
    });
  });

  it('returns a FAILED item to FAILED and records a new error when retry fails', async () => {
    const failedWorkItem = {
      ...workItem,
      analysisError: 'Previous AI provider failure.',
      status: WorkItemStatus.FAILED,
    };
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(failedWorkItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(failedWorkItem);
    aiProvider.analyse.mockRejectedValue(new Error('AI provider timed out.'));

    await expect(service.retry(workItem.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.workItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: workItem.id },
      data: {
        analysisError: null,
        status: WorkItemStatus.ANALYSING,
      },
    });
    expect(prisma.workItem.update).toHaveBeenLastCalledWith({
      where: { id: workItem.id },
      data: {
        analysisError: 'AI provider timed out.',
        status: WorkItemStatus.FAILED,
      },
    });
  });

  it('rejects retry for a non-FAILED item', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);

    await expect(service.retry(workItem.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(aiProvider.analyse).not.toHaveBeenCalled();
    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('returns 404 when retrying an unknown item', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.retry(workItem.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(aiProvider.analyse).not.toHaveBeenCalled();
    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('completes a READY_FOR_REVIEW item', async () => {
    const readyForReviewWorkItem = {
      ...workItem,
      status: WorkItemStatus.READY_FOR_REVIEW,
    };
    const completedWorkItem = {
      ...readyForReviewWorkItem,
      status: WorkItemStatus.COMPLETED,
    };
    prisma.workItem.findUnique = jest
      .fn()
      .mockResolvedValue(readyForReviewWorkItem);
    prisma.workItem.update = jest.fn().mockResolvedValue(completedWorkItem);

    await expect(service.complete(workItem.id)).resolves.toEqual(completedWorkItem);
    expect(prisma.workItem.update).toHaveBeenCalledWith({
      where: { id: workItem.id },
      data: { status: WorkItemStatus.COMPLETED },
    });
  });

  it('rejects RECEIVED to COMPLETED', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue(workItem);

    await expect(service.complete(workItem.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('rejects FAILED to COMPLETED', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue({
      ...workItem,
      status: WorkItemStatus.FAILED,
    });

    await expect(service.complete(workItem.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('rejects a transition from COMPLETED to another status', async () => {
    prisma.workItem.findUnique = jest.fn().mockResolvedValue({
      ...workItem,
      status: WorkItemStatus.COMPLETED,
    });

    await expect(
      service.transitionStatus(workItem.id, WorkItemStatus.ANALYSING),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });
});
