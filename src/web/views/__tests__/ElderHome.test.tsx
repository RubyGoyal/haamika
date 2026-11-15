/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { ElderHomeView } from '../ElderHomeView.js';
import { I18nProvider } from '../../i18n/index.js';

expect.extend(matchers);

const mockSchedule = {
  date: '2025-05-10',
  currentSlot: 'morning',
  nextAppointment: {
    doctorName: 'Dr. Mehta',
    specialty: 'Cardiology',
    place: 'Max Hospital',
    startsAt: '2025-05-12T10:00:00Z',
  },
  slots: [
    {
      slot: 'morning',
      items: [
        {
          id: 'med-1',
          type: 'medicine',
          name: 'Amlodipine',
          slot: 'morning',
          status: 'pending',
          medicine: {
            strength: '5 mg',
            purpose: 'Blood pressure control',
            pillColor: 'white',
            pillShape: 'round',
            foodInstruction: 'after_food',
          },
        },
      ],
    },
  ],
};

const mockProposals = [
  {
    id: 'prop-1',
    circleId: 'c1',
    type: 'add_medicine',
    payload: {
      medicineId: 'med-calcium',
      medicineName: 'Calcium + Vitamin D3',
      strength: '500 mg',
      purpose: 'Bone strength',
      slots: ['afternoon'],
    },
    proposedBy: 'rohan',
    status: 'pending',
    createdAt: '2025-05-10T08:00:00Z',
  },
];

describe('ElderHomeView', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('/api/schedule/today')) {
        return Promise.resolve(new Response(JSON.stringify(mockSchedule), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/proposals')) {
        return Promise.resolve(new Response(JSON.stringify(mockProposals), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.includes('/api/members')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'm1', name: 'Kamla Devi', role: 'elder' }]), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (u.endsWith('/api/me')) {
        return Promise.resolve(new Response(JSON.stringify({ circle: { preferredName: 'Amma' } }), { headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }));
    });
  });

  it('R4, R8, R9: renders Now card, consent cards, and passes axe check with zero violations', async () => {
    const onSignOut = vi.fn();
    const { container } = render(
      <I18nProvider initialLang="en">
        <ElderHomeView onSignOut={onSignOut} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Amlodipine/i)).toBeDefined();
      expect(screen.getByText(/Calcium \+ Vitamin D3/i)).toBeDefined();
    });

    // Zero axe violations on elder screen!
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('R9: approves a proposal via keyboard navigation only', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <I18nProvider initialLang="en">
        <ElderHomeView onSignOut={vi.fn()} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Calcium \+ Vitamin D3/i)).toBeDefined();
    });

    // Find the Okay button on the consent card
    const okayBtn = screen.getByRole('button', { name: /✓ okay/i });

    // Focus and hit Enter
    okayBtn.focus();
    expect(document.activeElement).toBe(okayBtn);
    await user.keyboard('{Enter}');

    // Verify decide proposal API was called
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/proposals/prop-1/decide'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
