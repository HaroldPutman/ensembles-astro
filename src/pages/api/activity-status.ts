import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPool, getActiveRegistrationCounts } from '../../lib/db';

export const prerender = false;

interface ActivityStatus {
  activityId: string;
  registeredCount: number;
  maxParticipants: number | null;
  isFull: boolean;
  spotsRemaining: number | null;
}

export const GET: APIRoute = async ({ url }) => {
  const activityIds = url.searchParams.getAll('id');
  const noCache = url.searchParams.has('no-cache');

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

  return getActivityStatus(activityIds, noCache);
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

  if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
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

  return getActivityStatus(activityIds, false);
};

/**
 * Produce activity status objects for the provided activity IDs and return them as a JSON HTTP response.
 *
 * Retrieves configured max participant counts from the activities collection and live registration counts
 * from the database, then computes per-activity status including registeredCount, maxParticipants, isFull,
 * and spotsRemaining.
 *
 * @param activityIds - Array of activity IDs to include (matching against stored activities is case-insensitive)
 * @param noCache - When true, omits the Cache-Control header from the response; when false, includes a public caching policy
 * @returns A Response whose successful body is `{ activities: ActivityStatus[] }` with status 200; on failure returns a 500 Response with `{ message: 'Failed to fetch activity status' }`
 */
async function getActivityStatus(
  activityIds: string[],
  noCache: boolean
): Promise<Response> {
  try {
    // Get activities collection to find sizeMax for each activity
    const activities = await getCollection('activities');
    const activitiesMap = new Map<string, number | undefined>();

    activities.forEach(activity => {
      activitiesMap.set(activity.id.toLowerCase(), activity.data.sizeMax);
    });

    // Query database for registration counts
    const pool = getPool();
    const client = await pool.connect();

    try {
      const registrationCounts = await getActiveRegistrationCounts(
        client,
        activityIds
      );

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
          spotsRemaining:
            spotsRemaining !== null ? Math.max(0, spotsRemaining) : null,
        };
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!noCache) {
        headers['Cache-Control'] =
          'public, max-age=600, s-maxage=600, stale-while-revalidate=60';
      }

      return new Response(
        JSON.stringify({
          activities: statuses,
        }),
        {
          status: 200,
          headers,
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
