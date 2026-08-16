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

/**
 * True when the student has a paid enrollment in a class that has not ended.
 */
export function studentHasCurrentClassEnrollment(
  paidActivityIds: string[],
  activities: CollectionEntry<'activities'>[]
): boolean {
  if (paidActivityIds.length === 0) return false;

  const paidIds = new Set(paidActivityIds.map(id => id.toLowerCase()));

  return activities.some(activity => {
    if (!paidIds.has(activity.id.toLowerCase())) return false;
    if (!isClassActivity(activity.data)) return false;
    if (isActivityCancelled(activity.data)) return false;
    if (isActivityEnded(activity.data)) return false;
    return true;
  });
}
