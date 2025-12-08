import type { APIRoute } from 'astro';
import { Pool } from 'pg';
import { getCollection } from 'astro:content';

export const prerender = false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

interface ActivityStatus {
  activityId: string;
  registeredCount: number;
  maxParticipants: number | null;
  isFull: boolean;
  spotsRemaining: number | null;
}

export const GET: APIRoute = async ({ url }) => {
  const activityIds = url.searchParams.getAll('id');

  if (!activityIds || activityIds.length === 0) {
    return new Response(
      JSON.stringify({
        message: 'At least one activity ID is required. Use ?id=activityId',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return getActivityStatus(activityIds);
};

export const POST: APIRoute = async ({ request }) => {
  let activityIds: string[];

  try {
    const body = await request.json();
    activityIds = body.activityIds;
  } catch (_e) {
    return new Response(
      JSON.stringify({ message: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (
    !activityIds ||
    !Array.isArray(activityIds) ||
    activityIds.length === 0
  ) {
    return new Response(
      JSON.stringify({
        message: 'activityIds array is required',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return getActivityStatus(activityIds);
};

async function getActivityStatus(activityIds: string[]): Promise<Response> {
  try {
    // Get activities collection to find sizeMax for each activity
    const activities = await getCollection('activities');
    const activitiesMap = new Map<string, number | undefined>();

    activities.forEach(activity => {
      activitiesMap.set(activity.id.toLowerCase(), activity.data.sizeMax);
    });

    // Query database for registration counts
    const client = await pool.connect();

    try {
      // Get count of active registrations (not cancelled) for each activity
      const result = await client.query(
        `SELECT 
          LOWER(course) as course,
          COUNT(*) as count
        FROM registration
        WHERE LOWER(course) = ANY($1)
          AND cancelled_at IS NULL
        GROUP BY LOWER(course)`,
        [activityIds.map(id => id.toLowerCase())]
      );

      // Build registration counts map
      const registrationCounts = new Map<string, number>();
      result.rows.forEach(row => {
        registrationCounts.set(row.course, parseInt(row.count, 10));
      });

      // Build response for each requested activity
      const statuses: ActivityStatus[] = activityIds.map(activityId => {
        const id = activityId.toLowerCase();
        const registeredCount = registrationCounts.get(id) || 0;
        const maxParticipants = activitiesMap.get(id) ?? null;
        const isFull =
          maxParticipants !== null && registeredCount >= maxParticipants;
        const spotsRemaining =
          maxParticipants !== null ? maxParticipants - registeredCount : null;

        return {
          activityId,
          registeredCount,
          maxParticipants,
          isFull,
          spotsRemaining: spotsRemaining !== null ? Math.max(0, spotsRemaining) : null,
        };
      });

      return new Response(
        JSON.stringify({
          activities: statuses,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching activity status:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to fetch activity status',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

