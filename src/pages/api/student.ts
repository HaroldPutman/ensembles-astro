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
    } catch (e) {
      return new Response(
        JSON.stringify({
          message: 'Invalid JSON in request body',
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { firstName, lastName, birthdate } = body;

    if (!firstName || !lastName || !birthdate) {
      return new Response(
        JSON.stringify({
          message: 'First name, last name, and birthdate are required',
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    try {
      // Try to insert the student
      const result = await pool.query(
        `INSERT INTO student (firstname, lastname, dob)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [firstName, lastName, birthdate]
      );
      return new Response(
        JSON.stringify({
          message: 'Student saved successfully',
          studentId: result.rows[0].id,
        }),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error: any) {
      // Check for unique violation (Postgres error code 23505)
      if (error.code === '23505') {
        // Query for the existing student
        const existing = await pool.query(
          `SELECT id FROM student WHERE firstname = $1 AND lastname = $2 AND dob = $3`,
          [firstName, lastName, birthdate]
        );
        if (existing.rows.length > 0) {
          return new Response(
            JSON.stringify({
              message: 'Student already exists',
              studentId: existing.rows[0].id,
            }),
            { 
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
        }
      }
      // Other errors
      console.error('Error saving student:', error);
      return new Response(
        JSON.stringify({
          message: 'Failed to save student',
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in student API:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to save student',
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 