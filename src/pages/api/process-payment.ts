import type { APIRoute } from 'astro';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { getCollection } from 'astro:content';
import { generateShortCode } from '../../lib/shortcode';

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

    // Validate payment method
    if (paymentMethod !== 'paypal' && paymentMethod !== 'none' && paymentMethod !== 'check') {
      return new Response(
        JSON.stringify({
          message: 'Invalid payment method',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate PayPal data if payment method is paypal
    if (paymentMethod === 'paypal') {
      if (!paypalOrderId || !paypalPayerId || totalAmount === undefined) {
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
    }

    // Validate free registration
    if (paymentMethod === 'none') {
      if (totalAmount !== 0) {
        return new Response(
          JSON.stringify({
            message: 'Free registration requires total amount to be $0',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      // Note: voucherId is optional for free registrations
      // Courses can be naturally free (cost = 0) or made free by a voucher
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
          `SELECT id, course, cost, donation FROM registration WHERE id = ANY($1)`,
          [registrationIds]
        );
        
        console.log('Registration query returned:', registrationsResult.rows);

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
          console.log({row, sum});
          return (
            sum + (parseFloat(row.cost) || 0) + (row.donation ? parseFloat(row.donation) : 0)
          );
        }, 0);
        
        console.log('Original expected total:', expectedTotal);

        // If a voucher is applied, subtract the discount from expected total
        if (voucherId) {
          console.log('Voucher ID provided:', voucherId, 'Type:', typeof voucherId);
          
          const voucherResult = await client.query(
            `SELECT percentage, amount, applies_to FROM voucher WHERE id = $1`,
            [voucherId]
          );
          
          console.log('Voucher query result rows count:', voucherResult.rows.length);
          if (voucherResult.rows.length > 0) {
            console.log('Voucher found:', voucherResult.rows[0]);
          } else {
            console.log('No voucher found with ID:', voucherId);
          }
          
          if (voucherResult.rows.length > 0) {
            const voucher = voucherResult.rows[0];
            let discountableTotal = expectedTotal;
            
            // If applies_to is set, only apply discount to matching course kinds
            if (voucher.applies_to) {
              console.log('Voucher applies only to kind:', voucher.applies_to);
              
              // Get events collection to check course kinds
              const events = await getCollection('events');
              const eventsMap = new Map();
              events.forEach(event => {
                eventsMap.set(event.id.toUpperCase(), event.data.kind);
              });
              
              // Calculate total only for registrations with matching course kind
              discountableTotal = registrationsResult.rows.reduce((sum, row) => {
                const courseId = row.course;
                
                // Safety check - skip if courseId is missing
                if (!courseId) {
                  console.log('Warning: Registration missing course ID:', row);
                  return sum;
                }
                
                const courseKind = eventsMap.get(courseId.toString().toUpperCase());
                
                if (courseKind === voucher.applies_to) {
                  const cost = (parseFloat(row.cost) || 0) + (parseFloat(row.donation) || 0);
                  console.log(`Including ${courseId} (kind: ${courseKind}) in discount: $${cost}`);
                  return sum + cost;
                } else {
                  console.log(`Excluding ${courseId} (kind: ${courseKind}) from discount`);
                  return sum;
                }
              }, 0);
              
              console.log(`Discountable total (${voucher.applies_to} only): $${discountableTotal}`);
            }
            
            let discount = 0;
            
            if (voucher.percentage) {
              discount = (discountableTotal * voucher.percentage) / 100;
              console.log(`Applying ${voucher.percentage}% discount to $${discountableTotal}: ${discount}`);
            } else if (voucher.amount) {
              discount = Math.min(parseFloat(voucher.amount), discountableTotal);
              console.log(`Applying $${voucher.amount} discount to $${discountableTotal}: ${discount}`);
            }
            
            expectedTotal = Math.max(0, expectedTotal - discount);
            console.log('Expected total after discount:', expectedTotal);
          } else {
            console.log('Voucher not found in database');
          }
        } else {
          console.log('No voucher ID provided, expected total remains:', expectedTotal);
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

        // Create payment record with appropriate transaction ID and short code
        let transactionId: string;
        if (paymentMethod === 'none') {
          transactionId = `FREE-${Date.now()}`;
        } else if (paymentMethod === 'check') {
          transactionId = `CHECK-${Date.now()}`;
        } else {
          transactionId = paypalOrderId;
        }
        
        // Generate unique short code with retry logic
        let shortCode: string;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
          shortCode = generateShortCode();
          
          // Check if code already exists
          const existingCode = await client.query(
            `SELECT id FROM payment WHERE short_code = $1`,
            [shortCode]
          );
          
          if (existingCode.rows.length === 0) {
            break; // Unique code found
          }
          
          attempts++;
          if (attempts === maxAttempts) {
            throw new Error('Failed to generate unique short code');
          }
        }
        
        const paymentResult = await client.query(
          `INSERT INTO payment (
            transaction_id, 
            amount,
            voucher_id,
            short_code
          ) VALUES ($1, $2, $3, $4)
          RETURNING id, short_code`,
          [transactionId, totalAmount, voucherId, shortCode!]
        );
        
        if (voucherId) {
          // if voucherId is provided, update the voucher times_used
          await client.query(
            `UPDATE voucher SET times_used = times_used + 1 WHERE id = $1`,
            [voucherId]
          );
        }

        const paymentId = paymentResult.rows[0].id;
        const paymentShortCode = paymentResult.rows[0].short_code;

        // Update registrations to mark them as paid and link to payment
        await client.query(
          `UPDATE registration 
           SET payment_id = $1
           WHERE id = ANY($2)`,
          [paymentId, registrationIds]
        );

        // Commit the transaction
        await client.query('COMMIT');

        let responseMessage: string;
        if (paymentMethod === 'none') {
          responseMessage = 'Registration completed successfully';
        } else if (paymentMethod === 'check') {
          responseMessage = 'Registration submitted - awaiting check payment';
        } else {
          responseMessage = 'Payment processed successfully';
        }
          
        return new Response(
          JSON.stringify({
            message: responseMessage,
            paymentId: paymentId,
            shortCode: paymentShortCode,
            paypalOrderId: paymentMethod === 'paypal' ? paypalOrderId : null,
            transactionId: transactionId,
            amount: totalAmount,
            registrationCount: registrationIds.length,
            paymentMethod: paymentMethod,
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
