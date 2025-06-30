import type { APIRoute } from 'astro';
import { Pool } from 'pg';
import { getCollection } from 'astro:content';

export const prerender = false;

const pool = new Pool({
  connectionString: import.meta.env.DATABASE_URL,
});

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
      const client = await pool.connect();

      try {
        // Get registration details with student and course information
        const registrationsResult = await client.query(
          `SELECT 
            r.id as registration_id,
            r.course,
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

        // Get events collection to map course IDs to course names
        const events = await getCollection('events');
        const eventsMap = new Map();
        events.forEach(event => {
          eventsMap.set(event.id.toUpperCase(), event.data.name);
        });

        // Process registrations and calculate totals
        const registrations = registrationsResult.rows.map(row => {
          const courseName = eventsMap.get(row.course) || row.course;
          const cost = parseFloat(row.cost) || 0;
          const donation = parseFloat(row.donation) || 0;

          return {
            registrationId: row.registration_id,
            courseId: row.course,
            courseName: courseName,
            studentFirstName: row.student_firstname,
            studentLastName: row.student_lastname,
            cost: cost,
            donation: donation,
            note: row.note,
            answer: row.answer,
            totalAmount: cost + donation,
          };
        });

        // Calculate total cost
        const totalCost = registrations.reduce(
          (sum, reg) => sum + reg.totalAmount,
          0
        );

        return new Response(
          JSON.stringify({
            registrations: registrations,
            totalCost: totalCost,
            count: registrations.length,
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
