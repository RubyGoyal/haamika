/**
 * Strip personally identifiable information before sending text to external services (Gemini).
 * Removes names, email addresses, phone numbers, and health-related details.
 * Also supports replacing circle member names with role tokens (e.g. [FAMILY_1], [CARETAKER_1])
 * so relationship context is preserved for intent matching without leaking actual names.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s-]{7,}\d)/g;
const BP_RE = /\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/g;

export interface MemberTokenInfo {
  token: string;
  name: string;
  role: string;
}

/**
 * Scrub PII with member role tokens.
 * Replaces circle member names with role tokens like [FAMILY_1], [CARETAKER_1], [ELDER].
 * Returns the scrubbed text and a mapping back to member details.
 */
export function scrubWithMemberTokens(
  text: string,
  members: Array<{ name: string; role: string }> = [],
): { scrubbedText: string; tokenMap: Record<string, MemberTokenInfo> } {
  let result = text;
  const tokenMap: Record<string, MemberTokenInfo> = {};
  const roleCounts: Record<string, number> = {};

  for (const member of members) {
    if (!member.name || member.name.trim().length === 0) continue;
    const roleKey = member.role.toUpperCase();
    roleCounts[roleKey] = (roleCounts[roleKey] || 0) + 1;
    const token = `[${roleKey}_${roleCounts[roleKey]}]`;

    tokenMap[token] = { token, name: member.name, role: member.role };

    const escaped = member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), token);
  }

  result = result.replace(EMAIL_RE, '[EMAIL]');
  result = result.replace(PHONE_RE, '[PHONE]');
  result = result.replace(BP_RE, '[READING]');

  return { scrubbedText: result, tokenMap };
}

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
