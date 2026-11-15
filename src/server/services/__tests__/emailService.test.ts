/**
 * Unit tests for emailService (R7).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';
import { sendOrLogEmail, sendDueReminders, setTransporter } from '../emailService.js';
import { loadConfig } from '../../config.js';
import type { DueReminder } from '../reminderEngine.js';
import type { Repository } from '../../repositories/repository.js';

let repo: Repository;

beforeEach(() => {
  loadConfig({
    SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long!',
    CRON_SECRET: 'test-cron-secret',
    NODE_ENV: 'test',
  });
  repo = createMemoryRepository();
  setTransporter(null);
});

describe('emailService (R7)', () => {
  const sampleReminder: DueReminder = {
    circleId: 'circle-1',
    kind: 'dose_upcoming',
    target: 'morning',
    stage: 'start',
    date: '2026-11-15',
    to: 'sunita@example.com',
    recipientId: 'mem-caretaker',
    recipientRole: 'caretaker',
    subject: 'Upcoming dose',
    body: 'Please give medicine',
    dedupeKey: 'circle-1:dose_upcoming:morning:2026-11-15:start:mem-caretaker',
  };

  it('records outbox entry with status "logged" when SMTP is unconfigured', async () => {
    const entry = await sendOrLogEmail(repo, sampleReminder);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe('logged');
    expect(entry!.to).toBe('sunita@example.com');

    const outbox = await repo.getOutboxByCircle('circle-1');
    expect(outbox).toHaveLength(1);
    expect(outbox[0].dedupeKey).toBe(sampleReminder.dedupeKey);
  });

  it('enforces send-once deduplication (returns null if already sent)', async () => {
    const first = await sendOrLogEmail(repo, sampleReminder);
    expect(first).not.toBeNull();

    // Calling again with the same dedupe key returns null
    const second = await sendOrLogEmail(repo, sampleReminder);
    expect(second).toBeNull();

    // Outbox still has only 1 entry
    const outbox = await repo.getOutboxByCircle('circle-1');
    expect(outbox).toHaveLength(1);
  });

  it('batches multiple reminders through sendDueReminders', async () => {
    const rem1 = { ...sampleReminder, dedupeKey: 'k1', to: 'user1@example.com' };
    const rem2 = { ...sampleReminder, dedupeKey: 'k2', to: 'user2@example.com' };

    const results = await sendDueReminders(repo, [rem1, rem2]);
    expect(results).toHaveLength(2);

    // Running again deduplicates both
    const secondResults = await sendDueReminders(repo, [rem1, rem2]);
    expect(secondResults).toHaveLength(0);
  });

  it('marks status as "sent" when SMTP transporter succeeds', async () => {
    loadConfig({
      SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long!',
      CRON_SECRET: 'test-cron-secret',
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      NODE_ENV: 'test',
    });

    const mockTransporter = {
      sendMail: async () => ({ messageId: '123' }),
    } as unknown as import('nodemailer').Transporter;

    setTransporter(mockTransporter);

    const rem = { ...sampleReminder, dedupeKey: 'smtp-ok-key' };
    const entry = await sendOrLogEmail(repo, rem);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('sent');
  });

  it('marks status as "failed" when SMTP transporter throws error', async () => {
    loadConfig({
      SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long!',
      CRON_SECRET: 'test-cron-secret',
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      NODE_ENV: 'test',
    });

    const mockTransporter = {
      sendMail: async () => {
        throw new Error('Connection refused');
      },
    } as unknown as import('nodemailer').Transporter;

    setTransporter(mockTransporter);

    const rem = { ...sampleReminder, dedupeKey: 'smtp-fail-key' };
    const entry = await sendOrLogEmail(repo, rem);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('failed');
  });
});
