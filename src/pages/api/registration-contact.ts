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

    const { firstName, lastName, email, phone, address, city, state, zip, registrationId } = body;

    if (!firstName || !lastName || !email || !registrationId) {
      return new Response(
        JSON.stringify({
          message: 'First name, last name, email, and registration ID are required',
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
      // Start a transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Check if contact already exists
        let contactId: number;
        const existingContact = await client.query(
          `SELECT id FROM contact WHERE firstname = $1 AND lastname = $2 AND email = $3`,
          [firstName, lastName, email]
        );
        
        if (existingContact.rows.length > 0) {
          contactId = existingContact.rows[0].id;
        } else {
          // Create new contact
          const contactResult = await client.query(
            `INSERT INTO contact (firstname, lastname, email, phone, address, city, state, zip)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [firstName, lastName, email, phone, address, city, state, zip]
          );
          contactId = contactResult.rows[0].id;
        }
        
        // Update registration with contact_id
        await client.query(
          `UPDATE registration SET contact_id = $1 WHERE id = $2`,
          [contactId, registrationId]
        );
        
        // Create contact_student relationship
        const registration = await client.query(
          `SELECT student_id FROM registration WHERE id = $1`,
          [registrationId]
        );
        
        if (registration.rows.length > 0) {
          const studentId = registration.rows[0].student_id;
          
          // Check if contact_student relationship already exists
          const existingRelationship = await client.query(
            `SELECT id FROM contact_student WHERE contact_id = $1 AND student_id = $2`,
            [contactId, studentId]
          );
          
          if (existingRelationship.rows.length === 0) {
            await client.query(
              `INSERT INTO contact_student (contact_id, student_id)
               VALUES ($1, $2)`,
              [contactId, studentId]
            );
          }
        }
        
        await client.query('COMMIT');
        
        return new Response(
          JSON.stringify({
            message: 'Contact information saved successfully',
            contactId: contactId,
          }),
          { 
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Error saving contact information:', error);
      return new Response(
        JSON.stringify({
          message: 'Failed to save contact information',
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
    console.error('Error in registration contact API:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to save contact information',
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