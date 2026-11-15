/**
 * Emergency keyword detector (R8, SPEC §4.3 & §4.10).
 * Pure function executing prior to Gemini classification.
 * Detects immediate emergencies in English, Hindi (Devanagari), and Hinglish
 * (including masculine and feminine grammatical forms).
 */

const EMERGENCY_KEYWORDS: string[] = [
  // English
  'fell',
  'fall',
  'fallen',
  'chest pain',
  'heart attack',
  "can't breathe",
  'cannot breathe',
  'cant breathe',
  'breathless',
  'ambulance',
  'bleeding',
  'stroke',
  'emergency',
  'unconscious',
  'help me',
  'fainted',
  'pain in chest',
  'severe pain',

  // Hindi (Devanagari) — masculine, feminine, common forms
  'गिर गई',
  'गिर गया',
  'गिर पड़ी',
  'गिर पड़ा',
  'सीने में दर्द',
  'छाती में दर्द',
  'सांस नहीं आ रही',
  'सांस फूल रही है',
  'दम घुट रहा है',
  'चक्कर आ रहा',
  'चक्कर आ रहे',
  'मदद करो',
  'बेहोश',
  'बेहोश हो रही हूं',
  'बेहोश हो रहा हूं',
  'खून बह रहा',
  'खून निकल रहा',
  'एंबुलेंस',
  'इमरजेंसी',

  // Hinglish / Romanized Hindi — masculine, feminine, common forms
  'gir gaya',
  'gir gayi',
  'gir pad gayi',
  'gir pad gaya',
  'seene me dard',
  'seene mein dard',
  'chaati me dard',
  'saas nahi aa rahi',
  'saans nahi aa rahi',
  'chakkar aa raha',
  'chakkar aa rahe',
  'madad karo',
  'behosh',
  'behosh ho rahi hoon',
  'behosh ho raha hoon',
  'khoon nikal raha',
  'khoon beh raha',
  'ambulance bulao',
  'chest pain ho raha',
];

/**
 * Checks if the transcript contains emergency indicators.
 * Case-insensitive, punctuation-insensitive.
 */
export function isEmergencyKeyword(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  // Remove apostrophes so "can't" -> "cant", and normalize punctuation
  const normalized = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,!?;:"()[\]{}]/g, ' ');

  for (const keyword of EMERGENCY_KEYWORDS) {
    const normalizedKeyword = keyword.toLowerCase().replace(/['’]/g, '');
    if (normalized.includes(normalizedKeyword)) {
      return true;
    }
  }

  return false;
}
