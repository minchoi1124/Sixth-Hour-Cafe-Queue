/**
 * Timezone helpers for session dates.
 *
 * Sessions are grouped and displayed by the cafe's local calendar date, so we
 * need to convert between a wall-clock time in an IANA zone and a UTC instant.
 * `date-fns` v3 is available but `date-fns-tz` is not, so this uses the standard
 * `Intl.DateTimeFormat.formatToParts` offset trick instead of adding a dep.
 *
 * This module deliberately imports nothing from Firebase so the Node backfill
 * script can reuse it.
 */

export const DEFAULT_TIMEZONE = 'America/New_York';

/** Resolve a cafe's timezone, falling back to the default when unset. */
export function cafeTimezone(timezone?: string | null): string {
  return timezone || DEFAULT_TIMEZONE;
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallPartsIn(date: Date, tz: string): WallParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far ahead of UTC the zone is at this instant, in milliseconds. */
function zoneOffsetMs(date: Date, tz: string): number {
  const p = wallPartsIn(date, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Interpret `<input type="date">` + `<input type="time">` values as wall-clock
 * time in `tz` and return the corresponding UTC instant.
 *
 * The offset is resolved in two passes so a value on the far side of a DST
 * boundary still lands correctly. Times inside a skipped or repeated hour are
 * inherently ambiguous and resolve to one of the two plausible instants.
 */
export function zonedWallTimeToDate(dateStr: string, timeStr: string, tz: string): Date {
  const naive = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naive)) return new Date(NaN);
  const firstPass = zoneOffsetMs(new Date(naive), tz);
  const refined = zoneOffsetMs(new Date(naive - firstPass), tz);
  return new Date(naive - refined);
}

/** Split an instant into the `date`/`time` input values for a zone. */
export function dateToZonedWallTime(date: Date, tz: string): { date: string; time: string } {
  const p = wallPartsIn(date, tz);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** `YYYY-MM-DD` calendar date in a zone — the grouping key for the backfill. */
export function zonedDateKey(date: Date, tz: string): string {
  return dateToZonedWallTime(date, tz).date;
}

/** e.g. "Sat, Aug 23, 2026" */
export function formatSessionDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** e.g. "6:02 PM" */
export function formatSessionTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** e.g. "6:02 PM – 9:14 PM" (or "6:02 PM – now" for a running session). */
export function formatTimeRange(start: Date, end: Date | null, tz: string): string {
  const from = formatSessionTime(start, tz);
  return end ? `${from} – ${formatSessionTime(end, tz)}` : `${from} – now`;
}

/** e.g. "3h 12m" — how long a session ran, or has been running. */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/**
 * Timezones offered in settings. Kept short on purpose — the browser's own zone
 * is added at render time if it isn't already in the list.
 */
export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const;
