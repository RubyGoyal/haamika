/**
 * API client for Haamika web.
 * Uses credentials: 'same-origin' for cookie sessions.
 * Includes offline queuing for /api/events with deterministic IDs (SPEC §4.11 / Correction 2).
 */

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const OFFLINE_QUEUE_KEY = 'haamika_offline_events';

export interface OfflineEvent {
  date: string;
  slot: string;
  itemType: 'medicine' | 'routine';
  itemId: string;
  status: string;
  reason?: string;
  reading?: string;
}

function getOfflineQueue(): OfflineEvent[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineEvent[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore localStorage quota errors
  }
}

export function clearOfflineStateAndCaches(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // ignore
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
  }
}

export async function replayOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let replayedCount = 0;
  const remaining: OfflineEvent[] = [];

  for (const item of queue) {
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        credentials: 'same-origin',
      });
      replayedCount++;
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return replayedCount;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    replayOfflineQueue().catch(() => {});
  });
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (isOffline && endpoint === '/api/events' && options.method === 'POST') {
    try {
      const parsedBody = JSON.parse(options.body as string) as OfflineEvent;
      const queue = getOfflineQueue();
      queue.push(parsedBody);
      saveOfflineQueue(queue);
      const deterministicId = `${parsedBody.date}_${parsedBody.slot}_${parsedBody.itemType}_${parsedBody.itemId}`;
      return { ok: true, id: deterministicId, offline: true } as unknown as T;
    } catch {
      // fallback to network fetch attempt
    }
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'same-origin',
    });

    const contentType = res.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const errorMsg =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Request failed with status ${res.status}`;
      throw new ApiError(errorMsg, res.status, data);
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;

    // Network error while posting an event: queue offline
    if (endpoint === '/api/events' && options.method === 'POST' && options.body) {
      try {
        const parsedBody = JSON.parse(options.body as string) as OfflineEvent;
        const queue = getOfflineQueue();
        queue.push(parsedBody);
        saveOfflineQueue(queue);
        const deterministicId = `${parsedBody.date}_${parsedBody.slot}_${parsedBody.itemType}_${parsedBody.itemId}`;
        return { ok: true, id: deterministicId, offline: true } as unknown as T;
      } catch {
        // rethrow original error
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
