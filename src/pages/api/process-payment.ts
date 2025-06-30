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

    const {
      registrationIds,
      paypalOrderId,
      paypalPayerId,
      totalAmount,
      paymentMethod,
    } = body;

    // Validate required fields
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

    if (
      !paypalOrderId ||
      !paypalPayerId ||
      !totalAmount ||
      paymentMethod !== 'paypal'
    ) {
      return new Response(
        JSON.stringify({
          message: 'Invalid PayPal payment data',
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
        // Start a transaction
        await client.query('BEGIN');

        // Verify registrations exist and get their total cost
        const registrationsResult = await client.query(
          `SELECT id, cost, donation FROM registration WHERE id = ANY($1)`,
          [registrationIds]
        );

        if (registrationsResult.rows.length !== registrationIds.length) {
          await client.query('ROLLBACK');
          return new Response(
            JSON.stringify({
              message: 'Some registrations not found',
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Calculate expected total
        const expectedTotal = registrationsResult.rows.reduce((sum, row) => {
          return (
            sum + (parseFloat(row.cost) || 0) + (parseFloat(row.donation) || 0)
          );
        }, 0);

        if (Math.abs(expectedTotal - totalAmount) > 0.01) {
          await client.query('ROLLBACK');
          return new Response(
            JSON.stringify({
              message: 'Total amount mismatch',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Create payment record
        const paymentResult = await client.query(
          `INSERT INTO payment (
            transaction_id, 
            amount 
          ) VALUES ($1, $2)
          RETURNING id`,
          [paypalOrderId, totalAmount]
        );

        const paymentId = paymentResult.rows[0].id;

        // Update registrations to mark them as paid and link to payment
        await client.query(
          `UPDATE registration 
           SET payment_id = $1
           WHERE id = ANY($2)`,
          [paymentId, registrationIds]
        );

        // Commit the transaction
        await client.query('COMMIT');

        return new Response(
          JSON.stringify({
            message: 'Payment processed successfully',
            paymentId: paymentId,
            paypalOrderId: paypalOrderId,
            amount: totalAmount,
            registrationCount: registrationIds.length,
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
      console.error('Error processing payment:', error);
      return new Response(
        JSON.stringify({
          message: 'Failed to process payment',
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
    console.error('Error in payment processing API:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to process payment',
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
