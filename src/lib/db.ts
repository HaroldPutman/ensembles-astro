import { Pool, type PoolClient } from 'pg';

// Shared pool configuration for serverless environments
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
 * Get the count of active registrations for an activity.
 * Active registrations are those that:
 * - Are not cancelled (cancelled_at IS NULL)
 * - Have completed payment (payment_id IS NOT NULL)
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
       AND payment_id IS NOT NULL`,
    [activityId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get active registration counts for multiple activities at once.
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
      AND payment_id IS NOT NULL
    GROUP BY LOWER(course)`,
    [activityIds.map(id => id.toLowerCase())]
  );

  const counts = new Map<string, number>();
  result.rows.forEach(row => {
    counts.set(row.course, parseInt(row.count, 10));
  });
  return counts;
}

