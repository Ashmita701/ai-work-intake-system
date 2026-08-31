export type WorkItemStatus =
  | 'RECEIVED'
  | 'ANALYSING'
  | 'READY_FOR_REVIEW'
  | 'FAILED'
  | 'COMPLETED';

export interface WorkItem {
  id: string;
  externalId: string;
  title: string;
  description: string;
  status: WorkItemStatus;
  category: string | null;
  priority: string | null;
  summary: string | null;
  recommendedAction: string | null;
  analysisError: string | null;
  createdAt: string;
  updatedAt: string;
}
