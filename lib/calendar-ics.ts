import type { CalendarSignalV1 } from "./providers/contracts";

const normalizeCalendarTitle = (value: string) => {
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
};

const unfold = (value: string) => value.replace(/\r?\n[ \t]/g, "");
const field = (block: string, name: string) => {
  const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, "mi"));
  return match?.[1]?.trim() || "";
};
const isoDate = (value: string) => {
  if (!value) return "";
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (/^\d{8}T\d{6}Z?$/.test(value)) {
    const suffix = value.endsWith("Z") ? "Z" : "";
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}${suffix}`;
  }
  return value;
};

export function parseIcsSignals(text: string): CalendarSignalV1[] {
  if (text.length > 2_000_000) throw new Error("ICS_FILE_TOO_LARGE");
  const normalized = unfold(text);
  return (normalized.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []).slice(0, 250).map((block, index) => {
    const start = isoDate(field(block, "DTSTART"));
    const end = isoDate(field(block, "DTEND")) || start;
    return {
      id: `ics-${index + 1}-${start.slice(0, 10)}`,
      category: normalizeCalendarTitle(field(block, "SUMMARY") || "Busy"),
      start,
      end,
      placeType: "other" as const,
    };
  }).filter((event) => Boolean(event.start));
}
