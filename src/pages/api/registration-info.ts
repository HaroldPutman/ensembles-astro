import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPool } from '../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({
          message: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { registrationId, answer, donationAmount, note, termsAgreement } =
      body;

    if (!registrationId) {
      return new Response(
        JSON.stringify({
          message: 'Registration ID is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!termsAgreement) {
      return new Response(
        JSON.stringify({
          message: 'Terms agreement is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    try {
      // Get the registration to find the activity ID
      const pool = getPool();
      const client = await pool.connect();

      try {
        const registrationResult = await client.query(
          `SELECT activity FROM registration WHERE id = $1`,
          [registrationId]
        );

        if (registrationResult.rows.length === 0) {
          return new Response(
            JSON.stringify({
              message: 'Registration not found',
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const activityId = registrationResult.rows[0].activity;

        // Look up the activity cost from the activities collection
        const activities = await getCollection('activities');
        const activity = activities.find(
          a => a.id.toLowerCase() === activityId
        );

        if (!activity) {
          return new Response(
            JSON.stringify({
              message: 'Activity not found',
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const activityCost = activity.data.cost || 0;

        // Update the registration with additional information
        await client.query(
          `UPDATE registration 
           SET cost = $1, donation = $2, note = $3, answer = $4, terms_agreement = $5
           WHERE id = $6`,
          [
            activityCost,
            donationAmount,
            note,
            answer,
            termsAgreement,
            registrationId,
          ]
        );

        // For now, we'll just return success
        // You can extend this to save answers to a separate table if needed

        return new Response(
          JSON.stringify({
            message: 'Registration information saved successfully',
            registrationId: registrationId,
            activityCost: activityCost || 0,
            donationAmount: donationAmount,
            totalAmount: activityCost + (donationAmount || 0),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error saving registration information:', error);
      return new Response(
        JSON.stringify({
          message: 'Internal error. Registration information not updated',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error in registration info API:', error);
    return new Response(
      JSON.stringify({
        message: 'Unexpected error. Registration information not updated',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
