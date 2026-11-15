/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { FamilyDashboardView } from '../FamilyDashboardView.js';
import { I18nProvider } from '../../i18n/index.js';

expect.extend(matchers);

const mockAdherence = {
  overall7d: { percentage: 85, taken: 18, total: 21 },
  overall30d: { percentage: 90, taken: 75, total: 83 },
  byMedicine: [{ medicineId: 'm1', medicineName: 'Metformin', percentage: 70 }],
  bySlot: [{ slot: 'night', percentage: 60 }],
  dailyStats: [
    { date: '2025-05-01', dayName: 'Mon', percentage: 100, taken: 3, total: 3 },
    { date: '2025-05-02', dayName: 'Tue', percentage: 66, taken: 2, total: 3 },
  ],
  insights: [
    {
      type: 'slot_missed',
      slot: 'night',
      missCount: 4,
      message: 'Night doses are often missed (4 times in the last 7 days).',
      suggestion: 'Consider moving the night dose time 30 minutes earlier.',
    },
  ],
};

describe('FamilyDashboardView', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.endsWith('/api/me')) {
        return Promise.resolve(new Response(JSON.stringify({ circle: { preferredName: 'Amma' } }), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/adherence')) {
        return Promise.resolve(new Response(JSON.stringify(mockAdherence), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/medicines')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/routines')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/proposals')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/appointments')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/members')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'm1', name: 'Rohan', role: 'family' }]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/activity')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/outbox')) {
        return Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }));
    });
  });

  it('R4, R6: renders overview tab with adherence %, insights, and passes axe audit', async () => {
    const { container } = render(
      <I18nProvider initialLang="en">
        <FamilyDashboardView onSignOut={vi.fn()} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeDefined();
      expect(screen.getByText(/Night doses are often missed/i)).toBeDefined();
    });

    // Zero axe violations on family overview!
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
