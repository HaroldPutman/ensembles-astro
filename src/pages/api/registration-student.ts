import type { APIRoute } from 'astro';
import type { PoolClient } from 'pg';
import { getPool } from '../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log('Registration student API called');
  try {
    let body;
    try {
      body = await request.json();
      console.log('Request body received:', body);
    } catch (_e) {
      console.error('Invalid JSON in request body:', _e);
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

    const { firstName, lastName, birthdate, activityId } = body;

    if (!firstName || !lastName || !birthdate || !activityId) {
      return new Response(
        JSON.stringify({
          message: `Missing required field(s): ${!firstName ? 'firstName' : ''} ${!lastName ? 'lastName' : ''} ${!birthdate ? 'birthdate' : ''} ${!activityId ? 'activityId' : ''}`,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let client: PoolClient | undefined;

    try {
      // Get database connection
      const pool = getPool();
      client = await pool.connect();

      let studentId: number;

      // Try to insert the student
      try {
        const studentResult = await client.query(
          `INSERT INTO student (firstname, lastname, dob)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [firstName, lastName, birthdate]
        );
        studentId = studentResult.rows[0].id;
      } catch (error: unknown) {
        // Check for unique violation (Postgres error code 23505)
        if ((error as any).code === '23505') {
          // Query for the existing student
          const existing = await client.query(
            `SELECT id FROM student WHERE firstname = $1 AND lastname = $2 AND dob = $3`,
            [firstName, lastName, birthdate]
          );
          if (existing.rows.length > 0) {
            studentId = existing.rows[0].id;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Create registration record
      try {
        const registrationResult = await client.query(
          `INSERT INTO registration (activity, student_id)
           VALUES ($1, $2)
           RETURNING id`,
          [activityId, studentId]
        );

        client.release();

        return new Response(
          JSON.stringify({
            message: 'Student and registration saved successfully',
            studentId: studentId,
            registrationId: registrationResult.rows[0].id,
            activityId: activityId,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (registrationError: unknown) {
        if (
          (registrationError as any).code === '23505' &&
          (registrationError as any).constraint ===
            'unique_registration_activity_student'
        ) {
          // Check if existing registration is complete (has payment)
          const existingReg = await client.query(
            `SELECT id, payment_id, contact_id FROM registration 
             WHERE activity = $1 AND student_id = $2`,
            [activityId, studentId]
          );

          client.release();

          if (existingReg.rows.length > 0 && existingReg.rows[0].payment_id) {
            // Registration is complete (paid)
            return new Response(
              JSON.stringify({
                message: 'Student already registered for this activity',
                alreadyRegistered: true,
                studentId: studentId,
                activityId: activityId,
              }),
              {
                status: 409,
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );
          } else {
            // Registration exists but is incomplete - return it to continue
            return new Response(
              JSON.stringify({
                message: 'Registration in progress',
                registrationInProgress: true,
                studentId: studentId,
                registrationId: existingReg.rows[0]?.id,
                contactId: existingReg.rows[0]?.contact_id,
                activityId: activityId,
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );
          }
        } else {
          throw registrationError;
        }
      }
    } catch (error: unknown) {
      console.error('Error Creating Registration:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code || 'UNKNOWN';

      // Try to clean up the connection if it exists
      try {
        if (typeof client !== 'undefined') {
          client.release();
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      return new Response(
        JSON.stringify({
          message: 'Failed to create registration',
          error: errorMessage,
          code: errorCode,
          details: process.env.NODE_ENV === 'development' ? error : undefined,
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
    console.error('Error in student API:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code || 'UNKNOWN';

    return new Response(
      JSON.stringify({
        message: 'Failed to save student and registration',
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
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
