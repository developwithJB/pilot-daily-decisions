export const CALENDAR_CATEGORIES = [
  "Office",
  "WFH",
  "Dinner",
  "Date",
  "Wedding",
  "Event",
  "Travel",
  "Workout",
  "Errands",
  "Casual",
] as const;
export type NormalizedCalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export function normalizeCalendarTitle(
  value: string,
): NormalizedCalendarCategory {
  const title = value.toLowerCase();
  if (/wfh|work from home|remote/.test(title)) return "WFH";
  if (/wedding|ceremony|reception/.test(title)) return "Wedding";
  if (/flight|airport|train|travel|trip/.test(title)) return "Travel";
  if (/gym|workout|yoga|pilates|run|training/.test(title)) return "Workout";
  if (/date/.test(title)) return "Date";
  if (/dinner|restaurant|supper/.test(title)) return "Dinner";
  if (/errand|grocery|appointment/.test(title)) return "Errands";
  if (/office|work|meeting|presentation|client/.test(title)) return "Office";
  if (/party|event|concert|show|birthday/.test(title)) return "Event";
  return "Casual";
}

function keyBytes(secret: string) {
  const raw = Uint8Array.from(atob(secret), (character) =>
    character.charCodeAt(0),
  );
  if (raw.byteLength !== 32) throw new Error("CALENDAR_ENCRYPTION_KEY_INVALID");
  return raw;
}

export function calendarConfigReady(
  environment: Record<string, string | undefined> = process.env,
) {
  if (
    !environment.GOOGLE_CLIENT_ID ||
    !environment.GOOGLE_CLIENT_SECRET ||
    !environment.CALENDAR_TOKEN_ENCRYPTION_KEY
  )
    return false;
  try {
    keyBytes(environment.CALENDAR_TOKEN_ENCRYPTION_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function encryptCalendarToken(token: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes(secret),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(token),
    ),
  );
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...encrypted))}`;
}

export async function decryptCalendarToken(value: string, secret: string) {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("CALENDAR_TOKEN_INVALID");
  const iv = Uint8Array.from(atob(ivPart), (character) =>
    character.charCodeAt(0),
  );
  const encrypted = Uint8Array.from(atob(encryptedPart), (character) =>
    character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes(secret),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted,
  );
  return new TextDecoder().decode(plain);
}
