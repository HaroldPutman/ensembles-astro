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
  console.log('Validate voucher API called');
  
  let pool: Pool | undefined;
  let client: PoolClient | undefined;

  try {
    // Parse request body
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

    const { code, registrationIds } = body;

    // Validate input
    if (!code) {
      return new Response(
        JSON.stringify({
          message: 'Voucher code is required',
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
      // Get database connection
      pool = await getDbConnection();
      client = await pool.connect();

      // Look up the voucher code
      const voucherResult = await client.query(
        `SELECT id, code, description, percentage, amount, valid_from, valid_until, 
                max_uses, times_used, active
         FROM voucher 
         WHERE UPPER(code) = UPPER($1)`,
        [code]
      );

      // Check if voucher exists
      if (voucherResult.rows.length === 0) {
        client.release();
        await pool.end();
        
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'Invalid voucher code',
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const voucher = voucherResult.rows[0];

      // Validate voucher status
      if (!voucher.active) {
        client.release();
        await pool.end();
        
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'This voucher is no longer active',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Check date validity
      const now = new Date();
      if (voucher.valid_from && new Date(voucher.valid_from) > now) {
        client.release();
        await pool.end();
        
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'This voucher is not yet valid',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (voucher.valid_until && new Date(voucher.valid_until) < now) {
        client.release();
        await pool.end();
        
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'This voucher has expired',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Check usage limits
      if (voucher.max_uses && voucher.times_used >= voucher.max_uses) {
        client.release();
        await pool.end();
        
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'This voucher has reached its maximum number of uses',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Voucher is valid - return the details
      client.release();
      await pool.end();

      return new Response(
        JSON.stringify({
          valid: true,
          voucher: {
            id: voucher.id,
            code: voucher.code,
            description: voucher.description,
            percentage: voucher.percentage,
            amount: voucher.amount ? parseFloat(voucher.amount) : null,
          },
          message: 'Voucher code is valid',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: unknown) {
      console.error('Error validating voucher:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code || 'UNKNOWN';

      // Try to clean up the connection if it exists
      try {
        if (client) {
          client.release();
        }
        if (pool) {
          await pool.end();
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Failed to validate voucher',
          error: errorMessage,
          code: errorCode,
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
    console.error('Error in validate-voucher API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        valid: false,
        message: 'Failed to process voucher validation',
        error: errorMessage,
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

