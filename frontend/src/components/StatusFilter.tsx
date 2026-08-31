import type { WorkItemStatus } from '../types/work-item';

export type StatusFilterValue = 'ALL' | WorkItemStatus;

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (status: StatusFilterValue) => void;
}

const statuses: StatusFilterValue[] = [
  'ALL',
  'RECEIVED',
  'ANALYSING',
  'READY_FOR_REVIEW',
  'FAILED',
  'COMPLETED',
];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <label className="filter-label">
      Filter by status
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StatusFilterValue)}
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status === 'ALL' ? 'All' : status}
          </option>
        ))}
      </select>
    </label>
  );
}
