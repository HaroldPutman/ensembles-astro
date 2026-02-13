import type { APIRoute } from 'astro';
import { getPool } from '../../lib/db';

export const prerender = false;

/**
 * POST /api/cancel-registration
 *
 * Cancels a registration by setting cancelled_at timestamp.
 *
 * Request body:
 *   - registrationId: The ID of the registration to cancel
 *
 * Authentication: Requires a valid Clerk session (backstage access)
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // Check for authenticated session
  let hasValidSession = false;
  try {
    const auth = locals.auth?.();
    hasValidSession = !!auth?.userId;
  } catch {
    hasValidSession = false;
  }

  if (!hasValidSession) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Unauthorized. Please sign in.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await request.json();
    const { registrationId } = body;

    if (!registrationId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Registration ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      // Update the registration with cancellation timestamp
      const result = await client.query(
        `UPDATE registration 
         SET cancelled_at = NOW() 
         WHERE id = $1 
           AND cancelled_at IS NULL
         RETURNING id`,
        [registrationId]
      );

      if (result.rowCount === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Registration not found or already cancelled',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Registration cancelled successfully',
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
    console.error('Error cancelling registration:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to cancel registration',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
