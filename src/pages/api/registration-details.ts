import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPool, getActiveRegistrationCounts } from '../../lib/db';

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

    const { registrationIds } = body;

    if (
      !registrationIds ||
      !Array.isArray(registrationIds) ||
      registrationIds.length === 0
    ) {
      return new Response(
        JSON.stringify({
          message: 'Registration IDs are required',
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
      const pool = getPool();
      const client = await pool.connect();

      try {
        // Get registration details with student and activity information
        const registrationsResult = await client.query(
          `SELECT 
            r.id as registration_id,
            r.activity,
            r.cost,
            r.donation,
            r.note,
            r.answer,
            s.firstname as student_firstname,
            s.lastname as student_lastname
           FROM registration r
           JOIN student s ON r.student_id = s.id
           WHERE r.id = ANY($1)`,
          [registrationIds]
        );

        if (registrationsResult.rows.length === 0) {
          return new Response(
            JSON.stringify({
              message: 'No registrations found',
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Get activities collection to map activity IDs to names, kinds, and sizeMax
        const activities = await getCollection('activities');
        const activitiesMap = new Map<
          string,
          { name: string; kind: string; sizeMax?: number }
        >();
        activities.forEach(activity => {
          activitiesMap.set(activity.id.toLowerCase(), {
            name: activity.data.name,
            kind: activity.data.kind,
            sizeMax: activity.data.sizeMax,
          });
        });

        // Get unique activity IDs from the registrations
        const activityIds = [
          ...new Set(
            registrationsResult.rows.map(row => row.activity.toLowerCase())
          ),
        ];

        // Start transaction for atomic capacity check and reservation
        await client.query('BEGIN');

        // Get current registration counts for capacity checking
        const registrationCounts = await getActiveRegistrationCounts(
          client,
          activityIds
        );

        // Check capacity and determine which registrations can proceed
        // Group registrations by activity to handle multiple registrations for the same activity
        const registrationsByActivity = new Map<
          string,
          typeof registrationsResult.rows
        >();
        registrationsResult.rows.forEach(row => {
          const activityId = row.activity.toLowerCase();
          const existing = registrationsByActivity.get(activityId) || [];
          existing.push(row);
          registrationsByActivity.set(activityId, existing);
        });

        // Determine which registrations can be accepted
        const acceptedRows: typeof registrationsResult.rows = [];
        const rejectedRows: Array<{
          row: (typeof registrationsResult.rows)[0];
          reason: string;
        }> = [];

        registrationsByActivity.forEach((rows, activityId) => {
          const activityData = activitiesMap.get(activityId);
          const sizeMax = activityData?.sizeMax;

          if (sizeMax === undefined) {
            // No capacity limit - accept all
            acceptedRows.push(...rows);
          } else {
            const currentCount = registrationCounts.get(activityId) || 0;
            const availableSpots = sizeMax - currentCount;

            if (availableSpots <= 0) {
              // Activity is full - reject all
              rows.forEach(row => {
                rejectedRows.push({
                  row,
                  reason: 'Activity is full',
                });
              });
            } else if (rows.length <= availableSpots) {
              // All registrations can fit
              acceptedRows.push(...rows);
            } else {
              // Partial acceptance - take as many as we can
              acceptedRows.push(...rows.slice(0, availableSpots));
              rows.slice(availableSpots).forEach(row => {
                rejectedRows.push({
                  row,
                  reason: 'Activity is full',
                });
              });
            }
          }
        });

        // Only reserve the accepted registrations
        if (acceptedRows.length > 0) {
          const acceptedIds = acceptedRows.map(row => row.registration_id);
          await client.query(
            `UPDATE registration
             SET reserved_at = NOW()
             WHERE id = ANY($1)
               AND payment_id IS NULL`,
            [acceptedIds]
          );
        }
        await client.query('COMMIT');

        // Process accepted registrations
        const registrations = acceptedRows.map(row => {
          const activityData = activitiesMap.get(row.activity.toLowerCase());
          const courseName = activityData?.name || row.activity;
          const courseKind = activityData?.kind || null;
          const cost = parseFloat(row.cost) || 0;
          const donation = parseFloat(row.donation) || 0;

          return {
            registrationId: row.registration_id,
            courseId: row.activity,
            courseName: courseName,
            courseKind: courseKind,
            studentFirstName: row.student_firstname,
            studentLastName: row.student_lastname,
            cost: cost,
            donation: donation,
            note: row.note,
            answer: row.answer,
            totalAmount: cost + donation,
          };
        });

        // Process rejected registrations for the response
        const rejected = rejectedRows.map(({ row, reason }) => {
          const activityData = activitiesMap.get(row.activity.toLowerCase());
          return {
            registrationId: row.registration_id,
            courseId: row.activity,
            courseName: activityData?.name || row.activity,
            studentFirstName: row.student_firstname,
            studentLastName: row.student_lastname,
            reason,
          };
        });

        // Calculate total cost (only for accepted registrations)
        const totalCost = registrations.reduce(
          (sum, reg) => sum + reg.totalAmount,
          0
        );

        return new Response(
          JSON.stringify({
            registrations: registrations,
            totalCost: totalCost,
            count: registrations.length,
            rejected: rejected.length > 0 ? rejected : undefined,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching registration details:', error);
      return new Response(
        JSON.stringify({
          message: 'Failed to fetch registration details',
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
    console.error('Error in registration details API:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to fetch registration details',
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
