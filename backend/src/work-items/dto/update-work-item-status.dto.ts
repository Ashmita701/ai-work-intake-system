import { WorkItemStatus } from '@prisma/client';
import { Equals, IsEnum } from 'class-validator';

export class UpdateWorkItemStatusDto {
  @IsEnum(WorkItemStatus)
  @Equals(WorkItemStatus.COMPLETED)
  status: WorkItemStatus;
}
