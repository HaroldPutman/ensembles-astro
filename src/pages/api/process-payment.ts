import type { APIRoute } from 'astro';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

export const prerender = false;

// Create a function to get a database connection
async function getDbConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless-optimized configuration
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  return pool;
}

export const POST: APIRoute = async ({ request }) => {
  console.log('Process payment API called');
  try {
    let body;
    try {
      body = await request.json();
      console.log('Request body:', body);
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

    const {
      registrationIds,
      paypalOrderId,
      paypalPayerId,
      totalAmount,
      paymentMethod,
      voucherId,
    } = body;
    
    console.log('Parsed values:', { registrationIds, paypalOrderId, paypalPayerId, totalAmount, paymentMethod, voucherId });

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

    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
      pool = await getDbConnection();
      client = await pool.connect();

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
        let expectedTotal = registrationsResult.rows.reduce((sum, row) => {
          return (
            sum + (parseFloat(row.cost) || 0) + (parseFloat(row.donation) || 0)
          );
        }, 0);
        
        console.log('Original expected total:', expectedTotal);

        // If a voucher is applied, subtract the discount from expected total
        if (voucherId) {
          console.log('Voucher ID provided:', voucherId);
          const voucherResult = await client.query(
            `SELECT percentage, amount FROM voucher WHERE id = $1`,
            [voucherId]
          );
          
          console.log('Voucher query result:', voucherResult.rows);
          
          if (voucherResult.rows.length > 0) {
            const voucher = voucherResult.rows[0];
            let discount = 0;
            
            if (voucher.percentage) {
              discount = (expectedTotal * voucher.percentage) / 100;
              console.log(`Applying ${voucher.percentage}% discount: ${discount}`);
            } else if (voucher.amount) {
              discount = Math.min(parseFloat(voucher.amount), expectedTotal);
              console.log(`Applying $${voucher.amount} discount: ${discount}`);
            }
            
            expectedTotal = Math.max(0, expectedTotal - discount);
            console.log('Expected total after discount:', expectedTotal);
          } else {
            console.log('Voucher not found in database');
          }
        }
        
        console.log('Final comparison - Expected:', expectedTotal, 'Received:', totalAmount, 'Difference:', Math.abs(expectedTotal - totalAmount));

        if (Math.abs(expectedTotal - totalAmount) > 0.01) {
          await client.query('ROLLBACK');
          console.error('Total amount mismatch!');
          return new Response(
            JSON.stringify({
              message: `Total amount mismatch. Expected: ${expectedTotal.toFixed(2)}, Received: ${totalAmount}`,
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
            amount,
            voucher_id
          ) VALUES ($1, $2, $3)
          RETURNING id`,
          [paypalOrderId, totalAmount, voucherId]
        );
        
        if (voucherId) {
          // if voucherId is provided, update the voucher times_used
          await client.query(
            `UPDATE voucher SET times_used = times_used + 1 WHERE id = $1`,
            [voucherId]
          );
        }

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
        if (client) {
          await client.query('ROLLBACK');
        }
        throw error;
      } finally {
        if (client) {
          client.release();
        }
        if (pool) {
          await pool.end();
        }
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
