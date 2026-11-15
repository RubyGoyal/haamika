/**
 * Strip personally identifiable information before sending text to external services (Gemini).
 * Removes names, email addresses, phone numbers, and health-related details.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s-]{7,}\d)/g;
const BP_RE = /\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/g;

/**
 * Scrub PII from text. Replaces names (provided), emails, phone numbers, and
 * blood-pressure readings with placeholders.
 */
export function piiScrub(text: string, names: string[] = []): string {
  let result = text;

  for (const name of names) {
    if (name.trim().length === 0) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[NAME]');
  }

  result = result.replace(EMAIL_RE, '[EMAIL]');
  result = result.replace(PHONE_RE, '[PHONE]');
  result = result.replace(BP_RE, '[READING]');

  return result;
}
