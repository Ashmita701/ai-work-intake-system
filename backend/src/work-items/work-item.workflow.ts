import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkItemStatus } from '@prisma/client';

@Injectable()
export class WorkItemWorkflow {
  private readonly allowedTransitions: Readonly<
    Record<WorkItemStatus, readonly WorkItemStatus[]>
  > = {
    [WorkItemStatus.RECEIVED]: [WorkItemStatus.ANALYSING],
    [WorkItemStatus.ANALYSING]: [
      WorkItemStatus.READY_FOR_REVIEW,
      WorkItemStatus.FAILED,
    ],
    [WorkItemStatus.FAILED]: [WorkItemStatus.ANALYSING],
    [WorkItemStatus.READY_FOR_REVIEW]: [WorkItemStatus.COMPLETED],
    [WorkItemStatus.COMPLETED]: [],
  };

  assertTransition(
    currentStatus: WorkItemStatus,
    nextStatus: WorkItemStatus,
  ): void {
    if (this.allowedTransitions[currentStatus].includes(nextStatus)) {
      return;
    }

    throw new BadRequestException(
      `Cannot transition a work item from ${currentStatus} to ${nextStatus}.`,
    );
  }

  assertCanStartAnalysis(currentStatus: WorkItemStatus): void {
    this.assertRequiredAnalysisStartStatus(
      currentStatus,
      WorkItemStatus.RECEIVED,
      'Analysis can only be started for RECEIVED work items.',
    );
  }

  assertCanRetryAnalysis(currentStatus: WorkItemStatus): void {
    this.assertRequiredAnalysisStartStatus(
      currentStatus,
      WorkItemStatus.FAILED,
      'Analysis can only be retried for FAILED work items.',
    );
  }

  private assertRequiredAnalysisStartStatus(
    currentStatus: WorkItemStatus,
    requiredStatus: WorkItemStatus,
    message: string,
  ): void {
    if (currentStatus !== requiredStatus) {
      throw new BadRequestException(message);
    }

    this.assertTransition(currentStatus, WorkItemStatus.ANALYSING);
  }
}
