import type { PoolClient } from 'pg';
import type { CollectionEntry } from 'astro:content';
import {
  isActivityCancelled,
  isActivityEnded,
  isClassActivity,
} from './activityStatus';

/**
 * Activity IDs with a completed (paid, not cancelled) registration for the student.
 */
export async function getPaidRegistrationActivityIds(
  client: PoolClient,
  studentId: number
): Promise<string[]> {
  const result = await client.query(
    `SELECT activity
     FROM registration
     WHERE student_id = $1
       AND payment_id IS NOT NULL
       AND cancelled_at IS NULL`,
    [studentId]
  );
  return result.rows.map((row: { activity: string }) => row.activity);
}

function normalizeClassName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * True when the student has a paid enrollment in a non-ended class with the
 * same name as the target activity (pre-registration continuing-student gate).
 */
export function studentHasMatchingCurrentClassEnrollment(
  paidActivityIds: string[],
  activities: CollectionEntry<'activities'>[],
  targetClassName: string
): boolean {
  if (paidActivityIds.length === 0) return false;

  const paidIds = new Set(paidActivityIds.map(id => id.toLowerCase()));
  const targetName = normalizeClassName(targetClassName);

  return activities.some(activity => {
    if (!paidIds.has(activity.id.toLowerCase())) return false;
    if (!isClassActivity(activity.data)) return false;
    if (isActivityCancelled(activity.data)) return false;
    if (isActivityEnded(activity.data)) return false;
    return normalizeClassName(activity.data.name) === targetName;
  });
}
