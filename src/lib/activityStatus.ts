import { Temporal } from '@js-temporal/polyfill';
import {
  getFirstAndLastDates,
  isRegistrationClosedAt,
  isRegistrationNotYetOpenAt,
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
  return isRegistrationNotYetOpenAt(opensAt);
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
  return isRegistrationClosedAt(closesAt);
}

/**
 * True when an activity's schedule has ended (last occurrence is in the past).
 * Open-ended schedules (no until/count) are treated as not ended.
 */
export function isActivityEnded(data: {
  startDate: string;
  startTime: string;
  duration: string;
  repeat: string;
}): boolean {
  const [, lastDate] = getFirstAndLastDates(
    data.startDate,
    data.startTime,
    data.duration,
    data.repeat
  );
  if (!lastDate) return false;
  return (
    Temporal.ZonedDateTime.compare(
      lastDate,
      Temporal.Now.zonedDateTimeISO(lastDate.timeZoneId)
    ) < 0
  );
}

/** Pre-registration early access applies only to classes. */
export function isClassActivity(data: { kind: string }): boolean {
  return data.kind === 'class';
}
