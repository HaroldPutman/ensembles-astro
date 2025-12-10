import { Pool, type PoolClient } from 'pg';

/**
 * Create a PostgreSQL connection pool tuned for serverless deployments.
 *
 * @param connectionString - Database connection string
 * @returns A configured pg Pool using a single connection, short idle and connection timeouts, and SSL enabled in production with `rejectUnauthorized: false`
 */
export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Retrieve the number of active registrations for an activity.
 *
 * Active registrations are those not cancelled and either have a payment recorded
 * or were reserved within the last 15 minutes.
 *
 * @param activityId - Activity identifier matched against the `course` column (case-insensitive)
 * @returns The count of active registrations for the specified activity
 */
export async function getActiveRegistrationCount(
  client: PoolClient,
  activityId: string
): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*) as count
     FROM registration
     WHERE LOWER(course) = LOWER($1)
       AND cancelled_at IS NULL
       AND (
         payment_id IS NOT NULL
         OR (reserved_at IS NOT NULL AND reserved_at > NOW() - INTERVAL '15 minutes')
       )`,
    [activityId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Fetches active registration counts for the given activities.
 *
 * Active registrations are those not cancelled and either paid or reserved within the last 15 minutes.
 *
 * @param activityIds - Activity identifiers to query; comparison is case-insensitive.
 * @returns A map where each key is the lowercased activity identifier and each value is the number of active registrations for that activity.
 */
export async function getActiveRegistrationCounts(
  client: PoolClient,
  activityIds: string[]
): Promise<Map<string, number>> {
  const result = await client.query(
    `SELECT 
      LOWER(course) as course,
      COUNT(*) as count
    FROM registration
    WHERE LOWER(course) = ANY($1)
      AND cancelled_at IS NULL
      AND (
        payment_id IS NOT NULL
        OR (reserved_at IS NOT NULL AND reserved_at > NOW() - INTERVAL '15 minutes')
      )
    GROUP BY LOWER(course)`,
    [activityIds.map(id => id.toLowerCase())]
  );

  const counts = new Map<string, number>();
  result.rows.forEach(row => {
    counts.set(row.course, parseInt(row.count, 10));
  });
  return counts;
}