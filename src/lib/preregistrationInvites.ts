import type { CollectionEntry } from 'astro:content';
import type { PoolClient } from 'pg';
import { Temporal } from '@js-temporal/polyfill';
import {
  getRegistrationOpensAt,
  isActivityCancelled,
  isActivityEnded,
  isClassActivity,
  getRegistrationClosesAt,
} from './activityStatus';
import { getFirstDate, timeNowIsAfter } from './datelib';
import {
  buildPreregistrationActivityUrl,
  SITE_ORIGIN,
} from './preregistration';

/** Last path segment of an activity id, e.g. `2026/09/piano1b` → `piano1b`. */
export function getActivitySlug(activityId: string): string {
  const trimmed = activityId.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  return (slash === -1 ? trimmed : trimmed.slice(slash + 1)).toLowerCase();
}

export interface ClassForInvite {
  id: string;
  slug: string;
  name: string;
  firstDate: Temporal.ZonedDateTime;
  cost?: number;
  location?: string;
  registrationOpensAt?: Temporal.ZonedDateTime;
}

export interface CurrentUpcomingPair {
  current: ClassForInvite;
  upcoming: ClassForInvite;
}

function toClassForInvite(
  activity: CollectionEntry<'activities'>,
  firstDate: Temporal.ZonedDateTime
): ClassForInvite {
  return {
    id: activity.id,
    slug: getActivitySlug(activity.id),
    name: activity.data.name,
    firstDate,
    cost: activity.data.cost,
    location: activity.data.location,
    registrationOpensAt: getRegistrationOpensAt(activity.data),
  };
}

/**
 * Pair each in-session class with the soonest future class that shares its slug
 * (e.g. `2026/08/piano1b` → `2026/09/piano1b`).
 */
export function pairCurrentClassesWithUpcoming(
  activities: CollectionEntry<'activities'>[],
  now: Temporal.ZonedDateTime = Temporal.Now.zonedDateTimeISO(
    'America/Louisville'
  )
): CurrentUpcomingPair[] {
  const current: ClassForInvite[] = [];
  const upcomingBySlug = new Map<string, ClassForInvite>();

  for (const activity of activities) {
    if (!isClassActivity(activity.data)) continue;
    if (isActivityCancelled(activity.data)) continue;

    let firstDate: Temporal.ZonedDateTime;
    try {
      firstDate = getFirstDate(
        activity.data.startDate,
        activity.data.startTime,
        activity.data.duration,
        activity.data.repeat || ''
      );
    } catch {
      continue;
    }

    const cls = toClassForInvite(activity, firstDate);
    const hasStarted = Temporal.ZonedDateTime.compare(firstDate, now) <= 0;

    if (hasStarted) {
      if (!isActivityEnded(activity.data, now)) {
        current.push(cls);
      }
      continue;
    }

    if (activity.data.registration !== true) continue;
    const closesAt = getRegistrationClosesAt(activity.data);
    if (closesAt && timeNowIsAfter(closesAt, now)) continue;

    const existing = upcomingBySlug.get(cls.slug);
    if (
      !existing ||
      Temporal.ZonedDateTime.compare(cls.firstDate, existing.firstDate) < 0
    ) {
      upcomingBySlug.set(cls.slug, cls);
    }
  }

  const pairs: CurrentUpcomingPair[] = [];
  for (const currentClass of current) {
    const upcoming = upcomingBySlug.get(currentClass.slug);
    if (!upcoming) continue;
    pairs.push({ current: currentClass, upcoming });
  }
  return pairs;
}

export interface PreregistrationInviteParticipant {
  studentName: string;
  studentFirstName: string;
  studentLastName: string;
  studentId: number;
  registrationId: number;
}

export interface PreregistrationInviteGroup {
  currentActivityId: string;
  currentActivityName: string;
  upcomingActivityId: string;
  upcomingActivityName: string;
  upcomingFirstDate: Temporal.ZonedDateTime;
  upcomingCost?: number;
  upcomingLocation?: string;
  registrationOpensAt?: Temporal.ZonedDateTime;
  preregisterUrl: string;
  contactId: number;
  contactName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  participants: PreregistrationInviteParticipant[];
}

interface CurrentRegistrationRow {
  id: number;
  activity: string;
  student_id: number;
  student_firstname: string;
  student_lastname: string;
  contact_id: number;
  contact_firstname: string;
  contact_lastname: string;
  contact_email: string;
}

interface UpcomingRegistrationRow {
  student_id: number;
  activity: string;
}

/**
 * Load invite groups: paid students in a current class who are not already
 * registered for the paired upcoming class and have not been invited yet.
 */
export async function loadPreregistrationInviteGroups(
  client: PoolClient,
  activities: CollectionEntry<'activities'>[],
  now?: Temporal.ZonedDateTime,
  options: { origin?: string; classFilter?: string } = {}
): Promise<PreregistrationInviteGroup[]> {
  const origin = options.origin ?? SITE_ORIGIN;
  let pairs = pairCurrentClassesWithUpcoming(activities, now);

  const classFilter = options.classFilter?.trim().toLowerCase();
  if (classFilter) {
    pairs = pairs.filter(
      pair =>
        pair.current.id.toLowerCase() === classFilter ||
        pair.upcoming.id.toLowerCase() === classFilter ||
        pair.current.slug === classFilter ||
        pair.upcoming.slug === classFilter
    );
  }

  if (pairs.length === 0) return [];

  const currentIds = [...new Set(pairs.map(p => p.current.id.toLowerCase()))];
  const upcomingIds = [...new Set(pairs.map(p => p.upcoming.id.toLowerCase()))];

  const currentResult = await client.query<CurrentRegistrationRow>(
    `SELECT
       r.id,
       r.activity,
       r.student_id,
       s.firstname as student_firstname,
       s.lastname as student_lastname,
       c.id as contact_id,
       c.firstname as contact_firstname,
       c.lastname as contact_lastname,
       c.email as contact_email
     FROM registration r
     JOIN student s ON r.student_id = s.id
     JOIN contact c ON r.contact_id = c.id
     WHERE LOWER(r.activity) = ANY($1)
       AND r.payment_id IS NOT NULL
       AND r.cancelled_at IS NULL
       AND r.preregister_invited_at IS NULL
       AND c.email IS NOT NULL
     ORDER BY r.activity, c.id, s.lastname, s.firstname`,
    [currentIds]
  );

  const upcomingResult = await client.query<UpcomingRegistrationRow>(
    `SELECT student_id, activity
     FROM registration
     WHERE LOWER(activity) = ANY($1)
       AND payment_id IS NOT NULL
       AND cancelled_at IS NULL`,
    [upcomingIds]
  );

  const alreadyRegistered = new Set(
    upcomingResult.rows.map(
      row => `${row.student_id}:${row.activity.toLowerCase()}`
    )
  );

  const currentToUpcoming = new Map(
    pairs.map(pair => [pair.current.id.toLowerCase(), pair])
  );

  const groups = new Map<string, PreregistrationInviteGroup>();

  for (const row of currentResult.rows) {
    const pair = currentToUpcoming.get(row.activity.toLowerCase());
    if (!pair) continue;

    const alreadyKey = `${row.student_id}:${pair.upcoming.id.toLowerCase()}`;
    if (alreadyRegistered.has(alreadyKey)) continue;

    const groupKey = `${pair.upcoming.id.toLowerCase()}-${row.contact_id}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        currentActivityId: pair.current.id,
        currentActivityName: pair.current.name,
        upcomingActivityId: pair.upcoming.id,
        upcomingActivityName: pair.upcoming.name,
        upcomingFirstDate: pair.upcoming.firstDate,
        upcomingCost: pair.upcoming.cost,
        upcomingLocation: pair.upcoming.location,
        registrationOpensAt: pair.upcoming.registrationOpensAt,
        preregisterUrl: buildPreregistrationActivityUrl(
          pair.upcoming.id,
          origin
        ),
        contactId: row.contact_id,
        contactName:
          `${row.contact_firstname} ${row.contact_lastname || ''}`.trim(),
        contactFirstName: row.contact_firstname,
        contactLastName: row.contact_lastname || '',
        contactEmail: row.contact_email,
        participants: [],
      };
      groups.set(groupKey, group);
    }

    group.participants.push({
      studentName: `${row.student_firstname} ${row.student_lastname}`,
      studentFirstName: row.student_firstname,
      studentLastName: row.student_lastname || '',
      studentId: row.student_id,
      registrationId: row.id,
    });
  }

  return [...groups.values()].filter(group => group.participants.length > 0);
}
