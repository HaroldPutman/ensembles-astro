import { Temporal } from '@js-temporal/polyfill';
import {
  isRegistrationClosedAt,
  resolveRegistrationClosesInstant,
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
