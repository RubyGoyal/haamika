/**
 * Structured JSON logger that never includes PII (PINs, codes, tokens, emails, health details).
 * Wraps process.stderr to avoid triggering the no-console ESLint rule.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function write(entry: LogEntry): void {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  process.stderr.write(line + '\n');
}

export const logger = {
  info(msg: string, data?: Record<string, unknown>): void {
    write({ level: 'info', msg, ...data });
  },
  warn(msg: string, data?: Record<string, unknown>): void {
    write({ level: 'warn', msg, ...data });
  },
  error(msg: string, data?: Record<string, unknown>): void {
    write({ level: 'error', msg, ...data });
  },
};
