import { Temporal } from '@js-temporal/polyfill';
import {
  buildRRuleString,
  createRRuleFromString,
  timeNowIsAfter,
  timeNowIsBefore,
  makeICalDuration,
  mergeActivityScheduleDates,
  normalizeAdditionalDates,
  resolveRegistrationClosesInstant,
  resolveRegistrationOpensInstant,
} from './datelib';

/**
 * Single source of truth for activity MDX `status` values.
 * Add new literals to `ACTIVITY_STATUSES` (and any matching product constants);
 * use `ACTIVITY_STATUSES` in `content.config.ts` with `z.enum(...)`.
 */

/** Activity is cancelled — not offered for new registration. */
export const ACTIVITY_STATUS_CANCELLED = 'cancelled' as const;

/** All allowed `status` frontmatter values (tuple for Zod `z.enum`). */
export const ACTIVITY_STATUSES = [ACTIVITY_STATUS_CANCELLED] as const;

/** Union of every entry in `ACTIVITY_STATUSES`. */
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export function isActivityCancelled(data: {
  status?: ActivityStatus;
}): boolean {
  return data.status === ACTIVITY_STATUS_CANCELLED;
}

export function getRegistrationOpensAt(data: {
  startDate: string;
  registrationOpens?: string;
}): Temporal.ZonedDateTime | undefined {
  if (!data.registrationOpens) return undefined;
  return resolveRegistrationOpensInstant(
    data.registrationOpens,
    data.startDate
  );
}

export function isRegistrationNotYetOpen(data: {
  startDate: string;
  registrationOpens?: string;
}): boolean {
  const opensAt = getRegistrationOpensAt(data);
  if (!opensAt) return false;
  return timeNowIsBefore(opensAt);
}

export function getRegistrationClosesAt(data: {
  startDate: string;
  registrationCloses?: string;
}): Temporal.ZonedDateTime | undefined {
  if (!data.registrationCloses) return undefined;
  return resolveRegistrationClosesInstant(
    data.registrationCloses,
    data.startDate
  );
}

export function isRegistrationClosed(data: {
  startDate: string;
  registrationCloses?: string;
}): boolean {
  const closesAt = getRegistrationClosesAt(data);
  if (!closesAt) return false;
  return timeNowIsAfter(closesAt);
}

/**
 * Cache-Control for registration status responses.
 * Caps TTL so a cached "not yet open" response cannot outlive the next opens transition.
 */
export function cacheControlUntilNearestRegistrationOpens(
  opensAts: Array<Temporal.ZonedDateTime | undefined>,
  defaultMaxAgeSeconds: number
): string {
  const nowMs = Temporal.Now.instant().epochMilliseconds;
  let maxAge = defaultMaxAgeSeconds;

  for (const opensAt of opensAts) {
    if (!opensAt) continue;
    const msUntilOpen = opensAt.epochMilliseconds - nowMs;
    // Include 0ms (immediate) and sub-second futures so maxAge becomes 0 → no-store.
    if (msUntilOpen >= 0) {
      maxAge = Math.min(maxAge, Math.floor(msUntilOpen / 1000));
    }
  }

  if (maxAge <= 0) {
    return 'private, no-store';
  }

  // Omit stale-while-revalidate so we never serve pre-open past the transition.
  return `public, max-age=${maxAge}, s-maxage=${maxAge}`;
}

/**
 * True when an activity's schedule has ended (last merged session end is past).
 * Open-ended RRULE schedules (no until/count) are treated as not ended.
 */
export function isActivityEnded(
  data: {
    startDate: string;
    startTime: string;
    duration: string;
    repeat: string;
    additionalDates?: string | string[];
  },
  now?: Temporal.ZonedDateTime
): boolean {
  const rruleString = buildRRuleString(
    data.startDate,
    data.startTime,
    data.duration,
    data.repeat
  );
  const rruleTemporal = createRRuleFromString(rruleString);
  const options = rruleTemporal.options();
  const hasEnd = options.until !== undefined || options.count !== undefined;
  if (!hasEnd) return false;

  const rruleDates = rruleTemporal.all((_dt, i) => i < 100);
  const durationISO = makeICalDuration(data.duration);
  const occurrences = mergeActivityScheduleDates(
    rruleDates,
    durationISO,
    normalizeAdditionalDates(data.additionalDates)
  );
  if (occurrences.length === 0) return false;

  const last = occurrences[occurrences.length - 1]!;
  const endsAt = last.start.add(Temporal.Duration.from(last.durationISO));
  return timeNowIsAfter(endsAt, now);
}

/** Pre-registration early access applies only to classes. */
export function isClassActivity(data: { kind: string }): boolean {
  return data.kind === 'class';
}
