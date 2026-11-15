/**
 * WhatsApp share link builder.
 * Encodes friendly status updates for family sharing per SPEC §4.8 (R8).
 */
export function buildWhatsAppShareUrl(options: {
  phone?: string;
  elderName: string;
  adherencePercentage: number;
  todaySummary: string;
}): string {
  const message =
    `*Haamika Update for ${options.elderName}*\n\n` +
    `Today: ${options.todaySummary}\n` +
    `7-Day Adherence: ${options.adherencePercentage}%\n\n` +
    `_Shared from Haamika - Your yes, our care_`;

  const phonePart = options.phone ? options.phone.replace(/[^0-9]/g, '') : '';
  const encoded = encodeURIComponent(message);

  if (phonePart) {
    return `https://wa.me/${phonePart}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
