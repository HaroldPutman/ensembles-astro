import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Normalize the duration string to a standard format. Possible input formats are:
 * 10 -> PT10M (10 minutes)
 * 1:30 -> PT1H30M (1 hour and 30 minutes)
 * 1D -> P1D (1 day)
 * 1D10H -> P1DT10H (1 day and 10 hours)
 * 1W -> P1W (1 week)
 * 1W1D -> P1WT1D (1 week and 1 day)
 * 1W1D10H -> P1WT1DT10H (1 week, 1 day and 10 hours)
 * P2DT4H -> P2DT4H (2 days and 4 hours)
 * @param durtime - The duration string to normalize
 * @returns The normalized duration string
 */
export function normalizeDuration(durtime: string) {
  if (!durtime || typeof durtime !== 'string') {
    throw new Error(`Invalid duration: ${durtime}`);
  }
  // If the durtime is only a number, prepend PT and append M and return
  if (!isNaN(Number(durtime))) {
    // Assume a number is minutes
    return `PT${durtime}M`;
  }
  // if durtime is a clock time like 1:30 return PT1H30M
  const match = durtime.match(/^([0-9]+):([0-5][0-9])$/);
  if (match) {
    return `PT${match[1]}H${match[2]}M`;
  }
  // If already a valid ISO 8601 duration, return as is
  const iso8601 =
    /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
  // /^P(?!$)(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/i;
  if (iso8601.test(durtime)) {
    return durtime.toUpperCase();
  }
  // Parse custom shorthand like 1W1D10H30M45S
  const regex = /^(?:(\d+)W)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i;
  const allMatch = durtime.match(regex);
  if (!allMatch || allMatch[0].length === 0) {
    throw new Error(`Invalid duration: ${durtime}`);
  }
  const [_m, w, d, h, m, s] = allMatch;
  let result = 'P';
  if (w) result += `${w}W`;
  if (d) result += `${d}D`;
  if (h || m || s) {
    result += 'T';
    if (h) result += `${h}H`;
    if (m) result += `${m}M`;
    if (s) result += `${s}S`;
  }
  return result;
}

/**
 * Get the day of the week from a date string
 * @param dtstring - The date string to get the day of the week from (RFC 9557 format)
 * @returns The day of the week
 */
function getDayOfWeek(date: Temporal.ZonedDateTime) {
  const dayNames = [
    '_',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  return dayNames[date.dayOfWeek];
}

function getDayOfWeekFullName(byDay: string) {
  const dayMap: Record<string, string> = {
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday',
    SU: 'Sunday',
  };
  return dayMap[byDay] || byDay;
}

/**
 * Get the human-readable description of the byDay string, or the day of the week
 * the event starts on.
 * @param byDay - The byDay string (Array or comma-separated string)
 * @param dtstart - The start date of the event
 * @returns A day of the week string "Thursday or "Thursday and Friday"
 */
function getBydayDescription(
  byDay: string | string[] | undefined,
  dtstart: Temporal.ZonedDateTime
) {
  if (byDay) {
    const byDayArray = Array.isArray(byDay) ? byDay : byDay.split(',');
    const names = byDayArray.map(getDayOfWeekFullName);
    const tail = names.pop();
    if (names.length > 0) {
      return names.join(', ') + ` and ${tail}`;
    } else {
      return tail;
    }
  }
  return getDayOfWeek(dtstart);
}

/**
 * Get a short description of the event. Like
 * "Wednesdays at 7:00 PM starting on June 11th"
 * @param dtstart - The start date of the event
 * @param dtend - The end date of the event
 * @param duration - The duration of the event
 * @param rrule - The rrule of the event
 * @returns A short description of the event
 */
export function shortDescription(
  dtstart: string,
  dtend: string | undefined,
  duration: string | undefined,
  rrule: string
) {
  const normalizedDuration = duration ? normalizeDuration(duration) : '';
  let rruleString = `DTSTART;TZID=America/Louisville:${dtstart}`;
  rruleString += `\nRRULE:${rrule}`;
  if (dtend) {
    rruleString += `\nDTEND;TZID=America/Louisville:${dtend}`;
  }
  if (normalizedDuration) {
    rruleString += `\nDURATION:${normalizedDuration}`;
  }
  const rruleTemporal = new RRuleTemporal({
    rruleString,
  });
  const rruleDates = rruleTemporal.all((_dt, i) => i < 1); // just first date
  const startDate = rruleDates[0];

  const options = rruleTemporal.options();
  if (options.freq === 'WEEKLY') {
    const dayOfWeek = getBydayDescription(options.byDay, startDate);
    const startingOn = startDate
      .toLocaleString('en-US', { dateStyle: 'long' })
      .split(',')[0];
    return `every ${dayOfWeek} starting ${startingOn}`;
  }
  return rruleTemporal.toText();
}
