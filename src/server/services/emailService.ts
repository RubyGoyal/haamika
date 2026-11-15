/**
 * Email delivery service (R7, SPEC §4.6).
 * Manages sending emails via nodemailer (Gmail SMTP) or recording as 'logged'.
 * Integrates with circle Outbox and enforces strict deduplication.
 */
import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Repository } from '../repositories/repository.js';
import type { OutboxEntry } from '../../shared/types.js';
import type { DueReminder } from './reminderEngine.js';
import { getConfig } from '../config.js';
import { logger } from './logger.js';

let transporterInstance: Transporter | null = null;
const DEFAULT_SMTPS_PORT = 465;

export function getTransporter(): Transporter | null {
  if (transporterInstance) return transporterInstance;

  const config = getConfig();
  if (config.SMTP_USER && config.SMTP_PASS) {
    transporterInstance = nodemailer.createTransport({
      host: config.SMTP_HOST || 'smtp.gmail.com',
      port: config.SMTP_PORT || DEFAULT_SMTPS_PORT,
      secure: config.SMTP_PORT === DEFAULT_SMTPS_PORT,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }
  return transporterInstance;
}

/** Set custom or mock transporter (useful in tests) */
export function setTransporter(t: Transporter | null): void {
  transporterInstance = t;
}

export async function sendOrLogEmail(
  repo: Repository,
  reminder: DueReminder,
): Promise<OutboxEntry | null> {
  // 1. Check deduplication: has this reminder already been written to outbox?
  const existing = await repo.getOutboxByDedupeKey(reminder.circleId, reminder.dedupeKey);
  if (existing) {
    return null; // Already sent or logged
  }

  const config = getConfig();
  const from = config.MAIL_FROM || 'Haamika Care <no-reply@haamika.app>';
  const transporter = getTransporter();

  let status: 'sent' | 'logged' | 'failed' = 'logged';

  // Only attempt network SMTP if configured with transporter
  if (transporter && config.SMTP_USER) {
    try {
      await transporter.sendMail({
        from,
        to: reminder.to,
        subject: reminder.subject,
        text: reminder.body,
      });
      status = 'sent';
    } catch (err: unknown) {
      logger.error('Failed to send email via SMTP', {
        dedupeKey: reminder.dedupeKey,
        error: (err as Error).message,
      });
      status = 'failed';
    }
  } else {
    // Recorded with status "logged" per SPEC §4.6
    status = 'logged';
  }

  const outboxEntry: OutboxEntry = {
    id: randomUUID(),
    circleId: reminder.circleId,
    to: reminder.to,
    subject: reminder.subject,
    body: reminder.body,
    kind: reminder.kind,
    dedupeKey: reminder.dedupeKey,
    status,
    at: new Date().toISOString(),
  };

  await repo.createOutboxEntry(reminder.circleId, outboxEntry);
  return outboxEntry;
}

/**
 * Send a batch of due reminders, ensuring send-once semantics.
 */
export async function sendDueReminders(
  repo: Repository,
  reminders: DueReminder[],
): Promise<OutboxEntry[]> {
  const sentEntries: OutboxEntry[] = [];
  for (const rem of reminders) {
    const entry = await sendOrLogEmail(repo, rem);
    if (entry) {
      sentEntries.push(entry);
    }
  }
  return sentEntries;
}
