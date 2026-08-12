import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export type RegistrationRow = {
  id: string;
  activity: string;
  cost: string | null;
  payment_id: string | null;
  student_id: string;
  contact_id: string | null;
};

export type PaymentRow = {
  id: string;
  amount: string;
  transaction_id: string;
  short_code: string | null;
};

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for e2e tests (load from .env or the environment)'
    );
  }
  return connectionString;
}

export async function withDb<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = new pg.Pool({ connectionString: getConnectionString() });
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

/** Keep IDs as strings — Cockroach unique_rowid values exceed Number.MAX_SAFE_INTEGER. */
export async function getRegistrationsByIds(
  ids: string[]
): Promise<RegistrationRow[]> {
  if (ids.length === 0) return [];
  return withDb(async client => {
    const result = await client.query<RegistrationRow>(
      `SELECT id::text AS id,
              activity,
              cost,
              payment_id::text AS payment_id,
              student_id::text AS student_id,
              contact_id::text AS contact_id
       FROM registration
       WHERE id = ANY($1::int8[])
       ORDER BY id`,
      [ids]
    );
    return result.rows;
  });
}

export async function getPaymentById(
  paymentId: string
): Promise<PaymentRow | null> {
  return withDb(async client => {
    const result = await client.query<PaymentRow>(
      `SELECT id::text AS id,
              amount,
              transaction_id,
              short_code
       FROM payment
       WHERE id = $1::int8`,
      [paymentId]
    );
    return result.rows[0] ?? null;
  });
}

/** Best-effort cleanup so repeated local runs do not leave cart pollution test data. */
export async function cleanupRegistrations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withDb(async client => {
    const regs = await client.query<{
      id: string;
      payment_id: string | null;
      student_id: string;
      contact_id: string | null;
    }>(
      `SELECT id::text AS id,
              payment_id::text AS payment_id,
              student_id::text AS student_id,
              contact_id::text AS contact_id
       FROM registration
       WHERE id = ANY($1::int8[])`,
      [ids]
    );

    const paymentIds = [
      ...new Set(
        regs.rows
          .map(r => r.payment_id)
          .filter((id): id is string => id != null)
      ),
    ];
    const studentIds = [...new Set(regs.rows.map(r => r.student_id))];
    const contactIds = [
      ...new Set(
        regs.rows
          .map(r => r.contact_id)
          .filter((id): id is string => id != null)
      ),
    ];

    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM registration WHERE id = ANY($1::int8[])`,
        [ids]
      );
      if (paymentIds.length > 0) {
        await client.query(
          `DELETE FROM payment
           WHERE id = ANY($1::int8[])
             AND NOT EXISTS (
               SELECT 1 FROM registration r WHERE r.payment_id = payment.id
             )`,
          [paymentIds]
        );
      }
      if (contactIds.length > 0) {
        await client.query(
          `DELETE FROM contact_student WHERE contact_id = ANY($1::int8[])`,
          [contactIds]
        );
        await client.query(
          `DELETE FROM contact
           WHERE id = ANY($1::int8[])
             AND NOT EXISTS (
               SELECT 1 FROM registration r WHERE r.contact_id = contact.id
             )
             AND NOT EXISTS (
               SELECT 1 FROM contact_student cs WHERE cs.contact_id = contact.id
             )`,
          [contactIds]
        );
      }
      if (studentIds.length > 0) {
        await client.query(
          `DELETE FROM student
           WHERE id = ANY($1::int8[])
             AND NOT EXISTS (
               SELECT 1 FROM registration r WHERE r.student_id = student.id
             )
             AND NOT EXISTS (
               SELECT 1 FROM contact_student cs WHERE cs.student_id = student.id
             )`,
          [studentIds]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
