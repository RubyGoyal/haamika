/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, replayOfflineQueue, clearOfflineStateAndCaches } from '../client.js';

describe('API Client Offline Queuing (R8, SPEC §4.11 / Correction 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('queues /api/events offline when network fails with deterministic ID', async () => {
    // Simulate offline or network failure
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const eventPayload = {
      date: '2026-11-15',
      slot: 'morning',
      itemType: 'medicine' as const,
      itemId: 'med-123',
      status: 'taken',
    };

    const res = await api.post<{ ok: boolean; id: string; offline: boolean }>(
      '/api/events',
      eventPayload,
    );

    expect(res.offline).toBe(true);
    expect(res.id).toBe('2026-11-15_morning_medicine_med-123');

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem('haamika_offline_events') || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].itemId).toBe('med-123');
  });

  it('replays offline queue once online', async () => {
    localStorage.setItem(
      'haamika_offline_events',
      JSON.stringify([
        {
          date: '2026-11-15',
          slot: 'morning',
          itemType: 'medicine',
          itemId: 'med-1',
          status: 'taken',
        },
      ]),
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const count = await replayOfflineQueue();
    expect(count).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Queue is cleared after successful replay
    const remaining = JSON.parse(localStorage.getItem('haamika_offline_events') || '[]');
    expect(remaining).toHaveLength(0);
  });

  it('clears offline queue on sign-out via clearOfflineStateAndCaches', () => {
    localStorage.setItem('haamika_offline_events', JSON.stringify([{ itemId: 'x' }]));
    clearOfflineStateAndCaches();
    expect(localStorage.getItem('haamika_offline_events')).toBeNull();
  });
});
