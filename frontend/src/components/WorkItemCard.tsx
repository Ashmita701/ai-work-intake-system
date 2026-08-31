import type { WorkItem } from '../types/work-item';

export type WorkItemAction = 'analyse' | 'retry' | 'complete';

interface WorkItemCardProps {
  workItem: WorkItem;
  isActionLoading: boolean;
  onAction: (id: string, action: WorkItemAction) => void;
}

const actionsByStatus: Partial<
  Record<WorkItem['status'], { action: WorkItemAction; label: string }>
> = {
  RECEIVED: { action: 'analyse', label: 'Analyse' },
  FAILED: { action: 'retry', label: 'Retry' },
  READY_FOR_REVIEW: { action: 'complete', label: 'Complete' },
};

export function WorkItemCard({
  workItem,
  isActionLoading,
  onAction,
}: WorkItemCardProps) {
  const action = actionsByStatus[workItem.status];
  const hasAnalysis =
    workItem.category ||
    workItem.priority ||
    workItem.summary ||
    workItem.recommendedAction;

  return (
    <article className="work-item-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{workItem.title}</h2>
          <p className="external-id">{workItem.externalId}</p>
        </div>
        <span className="status">{workItem.status}</span>
      </div>

      <p className="description">{workItem.description}</p>

      {hasAnalysis && (
        <section className="analysis" aria-label="AI analysis">
          <h3>AI analysis</h3>
          {workItem.category && <p>Category: {workItem.category}</p>}
          {workItem.priority && <p>Priority: {workItem.priority}</p>}
          {workItem.summary && <p>Summary: {workItem.summary}</p>}
          {workItem.recommendedAction && (
            <p>Recommended action: {workItem.recommendedAction}</p>
          )}
        </section>
      )}

      {workItem.status === 'FAILED' && workItem.analysisError && (
        <section className="analysis" aria-label="Analysis failure reason">
          <h3>Analysis failure reason</h3>
          <p>{workItem.analysisError}</p>
        </section>
      )}

      {action && (
        <button
          className="action-button"
          disabled={isActionLoading}
          onClick={() => onAction(workItem.id, action.action)}
          type="button"
        >
          {isActionLoading ? `${action.label}…` : action.label}
        </button>
      )}
    </article>
  );
}
