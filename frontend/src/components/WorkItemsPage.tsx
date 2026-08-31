import { useCallback, useEffect, useMemo, useState } from 'react';

import { workItemsApi } from '../api/work-items';
import type { WorkItem } from '../types/work-item';
import { StatusFilter, type StatusFilterValue } from './StatusFilter';
import { WorkItemCard, type WorkItemAction } from './WorkItemCard';

export function WorkItemsPage() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkItems = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      setWorkItems(await workItemsApi.list());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load work items.',
      );
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWorkItems();
  }, [loadWorkItems]);

  const visibleWorkItems = useMemo(
    () =>
      statusFilter === 'ALL'
        ? workItems
        : workItems.filter((workItem) => workItem.status === statusFilter),
    [statusFilter, workItems],
  );

  async function handleAction(id: string, action: WorkItemAction) {
    setActionItemId(id);
    setError(null);

    try {
      if (action === 'analyse') {
        await workItemsApi.analyse(id);
      } else if (action === 'retry') {
        await workItemsApi.retry(id);
      } else {
        await workItemsApi.complete(id);
      }

      await loadWorkItems(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update the work item.',
      );
    } finally {
      setActionItemId(null);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Work items</h1>
        </div>
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </header>

      {error && <p className="error-message">{error}</p>}

      {isLoading ? (
        <p className="loading-state">Loading work items…</p>
      ) : visibleWorkItems.length === 0 ? (
        <p className="empty-state">No work items match this filter.</p>
      ) : (
        <section className="work-item-grid" aria-label="Work items">
          {visibleWorkItems.map((workItem) => (
            <WorkItemCard
              key={workItem.id}
              workItem={workItem}
              isActionLoading={actionItemId === workItem.id}
              onAction={handleAction}
            />
          ))}
        </section>
      )}
    </main>
  );
}
