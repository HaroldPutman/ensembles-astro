import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Make a duration string in the format of PT10M, PT1H30M, P1D, P1DT10H, P1W, P1WT1D, P1WT1DT10H.
 * Possible input formats are:
 * 10 -> PT10M (10 minutes)
 * 1:30 -> PT1H30M (1 hour and 30 minutes)
 * 1D -> P1D (1 day)
 * 1D10H -> P1DT10H (1 day and 10 hours)
 * 1W -> P1W (1 week)
 * 1W1D -> P1WT1D (1 week and 1 day)
 * 1W1D10H -> P1WT1DT10H (1 week, 1 day and 10 hours)
 * P2DT4H -> P2DT4H (2 days and 4 hours)
 * @param durtime - The duration string to format.
 * @returns The formatted duration string
 */
export function makeICalDuration(durtime: string) {
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
 * Make a time string in the format of HHMMSS.
 * We assume the input is in correct format because it is validated in the content.config.
 * @param time - The time string to make in the format of HH:MM (am/pm is optional)
 * @returns The time string in the format of HHMMSS
 */
export function makeICalTime(time: string) {
  // Trim and normalize string
  const normalized = time.trim().toUpperCase();

  let [hours, minutes] = normalized.split(':').map(a => parseInt(a, 10));
  if (normalized.endsWith('PM') && hours < 12) {
    hours += 12;
  }
  return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
}

/**
 * Get the hour and minute from a time string
 * @param time - The time string to get the hour and minute from
 * @returns The hour and minute as an object
 */
export function getHourAndMinute(time: string) {
  const iCalTime = makeICalTime(time);
  return {
    hour: parseInt(iCalTime.slice(0, 2), 10),
    minute: parseInt(iCalTime.slice(2, 4), 10),
  };
}
/**
 * Make a date string in the format of YYYYMMDD
 * We assume the input is in correct format because it is validated in the content.config.
 * @param date - The date string to make in the format of YYYYMMDD
 * @returns The date string in the format of YYYYMMDD
 */
export function makeICalDate(date: string) {
  const [month, day, year] = date.split('/');
  return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
}

/**
 * Allow human-friendly EXDATE spec.
 * Rewrite the EXDATE=mm/dd/yyyy in the repeat string to
 * EXDATE;TZID=America/Louisville:YYYYMMDDT235959Z in the rrule string
 * And EXDATE is really separate from RRULE so make it on the next line.
 * @param repeat - The repeat string to rewrite
 * @param iCalStartTime - The start time of the event in the format of HH:MM:SS
 * @returns The rewritten repeat string
 */
function rewriteExdate(repeat: string, iCalStartTime: string) {
  const exDates: string[] = []; // dates found in the EXDATE spec
  const rruleString = repeat.replace(
    /;?EXDATE=([\d/,]+)(;|$)/,
    (_wholeMatch, dates, _terminator) => {
      const dateMatches = dates.matchAll(
        /(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})/g
      );
      dateMatches.forEach(dateMatch => {
        const [_, month, day, year] = dateMatch;
        exDates.push(
          `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T${iCalStartTime}`
        );
      });
      return '';
    }
  );
  if (exDates.length > 0) {
    return `${rruleString}\nEXDATE;TZID=America/Louisville:${exDates.join(',')}`;
  }
  return rruleString;
}

/**
 * Allow human-friendly UNTIL spec.
 * Rewrite the UNTIL=mm/dd/yyyy in the repeat string to YYYYMMDDT235959Z in the rrule string
 * @param repeat - The repeat string to rewrite
 * @returns The rewritten repeat string
 */
function rewriteUntil(repeat: string) {
  // Replace mm/dd/yyyy with YYYYMMDDT235959Z
  const rruleString = repeat.replace(
    /UNTIL=(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})(;|$)/,
    (_wholeMatch, month, day, year, _terminator) => {
      const formattedMonth = month.padStart(2, '0');
      const formattedDay = day.padStart(2, '0');
      return `UNTIL=${year}${formattedMonth}${formattedDay}T235959Z`;
    }
  );
  return rruleString;
}

/**
 * Make a RRule string from the human readable-ish repeat string.
 * @param repeat The rrule string from input data
 * @returns A proper RRule string
 */
export function makeICalRRule(repeat: string, iCalStartTime: string) {
  let standardized = repeat.trim() || 'FREQ=DAILY;COUNT=1';
  standardized = rewriteUntil(standardized);
  standardized = rewriteExdate(standardized, iCalStartTime);
  return standardized;
}

/**
 * Helper function to build an RRule string from the human readable spec.
 * @param startDate - The start date of the event mm/dd/yyyy string
 * @param startTime - The start time of the event hh:mm string
 * @param duration - The duration of the event in minutes, hh:mm string, or 1h30m string
 * @param repeat - Event repeat rules
 * @returns A RRule string.
 */
export function buildRRuleString(
  startDate: string,
  startTime: string,
  duration: string,
  repeat: string
) {
  const iCalStartTime = makeICalTime(startTime);
  const dtstart = `${makeICalDate(startDate)}T${iCalStartTime}`;
  let rruleString = `DTSTART;TZID=America/Louisville:${dtstart}`;
  rruleString += `\nRRULE:${makeICalRRule(repeat, iCalStartTime)}`;
  rruleString += `\nDURATION:${makeICalDuration(duration)}`;
  return rruleString;
}

/**
 * Helper function to get the first date of the event from the human readable spec.
 * @param startDate - The start date of the event mm/dd/yyyy string
 * @param startTime - The start time of the event hh:mm string
 * @param duration - The duration of the event in minutes, hh:mm string, or 1h30m string
 * @param repeat - Event repeat rules
 * @returns The first date of the event
 */
function getFirstDate(
  startDate: string,
  startTime: string,
  duration: string,
  repeat: string
): Temporal.ZonedDateTime {
  const rruleString = buildRRuleString(startDate, startTime, duration, repeat);
  const rruleTemporal = new RRuleTemporal({
    rruleString,
  });
  const rruleDates = rruleTemporal.all((_dt, i) => i < 1); // just first date
  return rruleDates[0];
}

/**
 * Helper function to get the first and last dates of the event from the human readable spec.
 * @param startDate - The start date of the event mm/dd/yyyy string
 * @param startTime - The start time of the event hh:mm string
 * @param duration - The duration of the event in minutes, hh:mm string, or 1h30m string
 * @param repeat - Event repeat rules
 * @returns An array of Temporal.ZonedDateTime objects containing the first and last dates of the event and the count of events.
 */
export function getFirstAndLastDates(
  startDate: string,
  startTime: string,
  duration: string,
  repeat: string
): [
  Temporal.ZonedDateTime,
  Temporal.ZonedDateTime | undefined,
  number | undefined,
] {
  const rruleString = buildRRuleString(startDate, startTime, duration, repeat);
  const rruleTemporal = new RRuleTemporal({
    rruleString,
  });
  const options = rruleTemporal.options();
  const hasEnd = options.until !== undefined || options.count !== undefined;
  if (hasEnd) {
    const all = rruleTemporal.all((_dt, i) => i < 100);
    return [all[0], all[all.length - 1], all.length];
  } else {
    return [rruleTemporal.all((_dt, i) => i < 1)[0], undefined, undefined];
  }
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
 * "Oct 26 - Nov 15, Tuesday 5:00pm - 6:00pm"
 * @param startDate - The start date of the event mm/dd/yyyy string
 * @param startTime - The start time of the event hh:mm string
 * @param duration - The duration of the event in minutes, hh:mm string, or 1h30m string
 * @param repeat - Event repeat rules
 * @returns A short description of the event
 */
export function shortDescription(
  startDate: string,
  startTime: string,
  duration: string,
  repeat: string
) {
  const [firstDate, lastDate, count] = getFirstAndLastDates(
    startDate,
    startTime,
    duration,
    repeat
  );
  const startDateString = firstDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const dayOfWeek = getDayOfWeek(firstDate);
  const startTimeString = firstDate.toLocaleString('en-US', {
    timeStyle: 'short',
  });
  const durationISO = makeICalDuration(duration);
  const firstDateEndTime = firstDate.add(Temporal.Duration.from(durationISO));
  const firstDateEndTimeString = firstDateEndTime.toLocaleString('en-US', {
    timeStyle: 'short',
  });
  if (count === 1) {
    return `${dayOfWeek} ${startDateString}, ${startTimeString} - ${firstDateEndTimeString}`;
  }
  const endDateString = lastDate
    ? lastDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  // Calculate end time by adding duration to first date
  return `${dayOfWeek}s ${startTimeString} - ${firstDateEndTimeString}, ${startDateString} - ${endDateString}`;
}
