/* ============================================================================
 * apps/api — lib/ics.ts
 * Minimal RFC 5545 generator: all-day VEVENTs for actions with due dates and
 * goals with target dates. No dependency — the subset we emit is tiny.
 * ========================================================================= */

export interface IcsEvent {
  uid: string;
  /** all-day date, epoch ms */
  date: number;
  summary: string;
  description?: string;
  done?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function icsDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape per RFC 5545 §3.3.11 and fold lines at 75 octets (§3.1). */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function buildIcs(calendarName: string, events: IcsEvent[], now = Date.now()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dreamward//Agent Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(calendarName)}`),
  ];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      fold(`UID:${esc(ev.uid)}@lifebook`),
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
      fold(`SUMMARY:${ev.done ? '✓ ' : ''}${esc(ev.summary)}`),
      ...(ev.description ? [fold(`DESCRIPTION:${esc(ev.description)}`)] : []),
      ...(ev.done ? ['STATUS:CANCELLED'] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
