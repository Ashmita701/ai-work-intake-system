import type { WorkItem } from '../types/work-item';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new Error(getErrorMessage(errorBody, response.status));
  }

  return response.json() as Promise<T>;
}

function getErrorMessage(errorBody: unknown, status: number): string {
  if (errorBody && typeof errorBody === 'object' && 'message' in errorBody) {
    const message = errorBody.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  return `Request failed with status ${status}.`;
}

export const workItemsApi = {
  list: (): Promise<WorkItem[]> => request('/work-items'),
  analyse: (id: string): Promise<WorkItem> =>
    request(`/work-items/${id}/analyse`, { method: 'POST' }),
  retry: (id: string): Promise<WorkItem> =>
    request(`/work-items/${id}/retry`, { method: 'POST' }),
  complete: (id: string): Promise<WorkItem> =>
    request(`/work-items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED' }),
    }),
};
