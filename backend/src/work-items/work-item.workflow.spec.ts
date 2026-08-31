import { BadRequestException } from '@nestjs/common';
import { WorkItemStatus } from '@prisma/client';

import { WorkItemWorkflow } from './work-item.workflow';

describe('WorkItemWorkflow', () => {
  const workflow = new WorkItemWorkflow();

  it('allows RECEIVED to ANALYSING', () => {
    expect(() =>
      workflow.assertTransition(
        WorkItemStatus.RECEIVED,
        WorkItemStatus.ANALYSING,
      ),
    ).not.toThrow();
  });

  it('rejects READY_FOR_REVIEW to RECEIVED', () => {
    expect(() =>
      workflow.assertTransition(
        WorkItemStatus.READY_FOR_REVIEW,
        WorkItemStatus.RECEIVED,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects COMPLETED to ANALYSING', () => {
    expect(() =>
      workflow.assertTransition(
        WorkItemStatus.COMPLETED,
        WorkItemStatus.ANALYSING,
      ),
    ).toThrow(BadRequestException);
  });
});
