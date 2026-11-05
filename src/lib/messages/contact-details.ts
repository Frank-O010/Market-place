/**
 * Spots phone numbers, emails and "move to WhatsApp" invitations in a message. Before an order
 * exists we warn the sender (and mark the message), because a deal taken off the platform loses
 * the buyer's payment protection. We never silently change what someone wrote.
 */

export type ContactKind = "phone" | "email" | "whatsapp";

const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}/i;
const WHATSAPP = /\b(whats\s*app|watsapp|wa\.me|telegram|t\.me\/)\b/i;
// Number words people use to dodge simple digit checks ("zero seven one two...").
const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

/** Turns spelled-out digits into digits and drops separators, so "07 12-345 678" reads as one number. */
function digitRuns(text: string): string[] {
  const normalised = text
    .toLowerCase()
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => NUMBER_WORDS[w] ?? w)
    .replace(/[oO](?=\d)|(?<=\d)[oO]/g, "0");
  // Join digits separated only by spaces, dots, dashes, brackets or plus signs.
  return normalised.match(/\+?\d[\d\s().-]{7,}\d/g)?.map((m) => m.replace(/\D/g, "")) ?? [];
}

function looksLikeKenyanPhone(digits: string): boolean {
  return /^(?:254|0)?[17]\d{8}$/.test(digits) || /^(?:254)[17]\d{8}$/.test(digits);
}

export function findContactDetails(text: string): ContactKind[] {
  const found = new Set<ContactKind>();
  if (EMAIL.test(text)) found.add("email");
  if (WHATSAPP.test(text)) found.add("whatsapp");
  for (const run of digitRuns(text)) {
    // Any long digit run is suspicious; Kenyan mobile numbers are the common case.
    if (looksLikeKenyanPhone(run) || run.length >= 10) found.add("phone");
  }
  return [...found];
}

export function describeContactDetails(kinds: ContactKind[]): string {
  const words = kinds.map((k) =>
    k === "phone" ? "a phone number" : k === "email" ? "an email address" : "WhatsApp or another app",
  );
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
