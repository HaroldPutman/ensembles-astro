import type { APIRoute } from 'astro';
import { Pool } from 'pg';

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

    const { firstName, lastName, birthdate, courseId } = body;

    if (!firstName || !lastName || !birthdate || !courseId) {
      return new Response(
        JSON.stringify({
          message: `Missing required field(s): ${!firstName ? 'firstName' : ''} ${!lastName ? 'lastName' : ''} ${!birthdate ? 'birthdate' : ''} ${!courseId ? 'courseId' : ''}`,
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
      // Start a transaction
      const client = await pool.connect();

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
          `INSERT INTO registration (course, student_id)
           VALUES ($1, $2)
           RETURNING id`,
          [courseId, studentId]
        );

        return new Response(
          JSON.stringify({
            message: 'Student and registration saved successfully',
            studentId: studentId,
            registrationId: registrationResult.rows[0].id,
            courseId: courseId,
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
            'unique_registration_course_student'
        ) {

          // Already registered
          return new Response(
            JSON.stringify({
              message: 'Student already registered for this course',
              alreadyRegistered: true,
              studentId: studentId,
              courseId: courseId,
            }),
            {
              status: 409,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        } else {
          throw registrationError;
        }
      }
    } catch (error: unknown) {
      console.error('Error Creating Registration:', error);
      return new Response(
        JSON.stringify({
          message: 'Failed to create registration',
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
    return new Response(
      JSON.stringify({
        message: 'Failed to save student and registration',
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
