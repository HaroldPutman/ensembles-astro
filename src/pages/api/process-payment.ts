import type { APIRoute } from 'astro';
import type { PoolClient } from 'pg';
import { getCollection } from 'astro:content';
import { generateShortCode } from '../../lib/shortcode';
import {
  sendPaymentConfirmationEmail,
  type RegistrationItem,
} from '../../lib/email';
import { getPool } from '../../lib/db';

export const prerender = false;

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

    console.log('Parsed values:', {
      registrationIds,
      paypalOrderId,
      paypalPayerId,
      totalAmount,
      paymentMethod,
      voucherId,
    });

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
    if (
      paymentMethod !== 'paypal' &&
      paymentMethod !== 'none' &&
      paymentMethod !== 'check'
    ) {
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

    let client: PoolClient | undefined;

    try {
      const pool = getPool();
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
          console.log({ row, sum });
          return (
            sum +
            (parseFloat(row.cost) || 0) +
            (row.donation ? parseFloat(row.donation) : 0)
          );
        }, 0);

        console.log('Original expected total:', expectedTotal);

        // If a voucher is applied, subtract the discount from expected total
        if (voucherId) {
          console.log(
            'Voucher ID provided:',
            voucherId,
            'Type:',
            typeof voucherId
          );

          const voucherResult = await client.query(
            `SELECT percentage, amount, applies_to FROM voucher WHERE id = $1`,
            [voucherId]
          );

          console.log(
            'Voucher query result rows count:',
            voucherResult.rows.length
          );
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

              // Get activities collection to check course kinds
              const activities = await getCollection('activities');
              const activitiesMap = new Map();
              activities.forEach((activity: any) => {
                activitiesMap.set(
                  activity.id.toLowerCase(),
                  activity.data.kind
                );
              });

              // Calculate total only for registrations with matching course kind
              discountableTotal = registrationsResult.rows.reduce(
                (sum, row) => {
                  const courseId = row.course;

                  // Safety check - skip if courseId is missing
                  if (!courseId) {
                    console.log(
                      'Warning: Registration missing course ID:',
                      row
                    );
                    return sum;
                  }

                  const courseKind = activitiesMap.get(
                    courseId.toString().toLowerCase()
                  );

                  if (courseKind === voucher.applies_to) {
                    const cost =
                      (parseFloat(row.cost) || 0) +
                      (parseFloat(row.donation) || 0);
                    console.log(
                      `Including ${courseId} (kind: ${courseKind}) in discount: $${cost}`
                    );
                    return sum + cost;
                  } else {
                    console.log(
                      `Excluding ${courseId} (kind: ${courseKind}) from discount`
                    );
                    return sum;
                  }
                },
                0
              );

              console.log(
                `Discountable total (${voucher.applies_to} only): $${discountableTotal}`
              );
            }

            let discount = 0;

            if (voucher.percentage) {
              discount = (discountableTotal * voucher.percentage) / 100;
              console.log(
                `Applying ${voucher.percentage}% discount to $${discountableTotal}: ${discount}`
              );
            } else if (voucher.amount) {
              discount = Math.min(
                parseFloat(voucher.amount),
                discountableTotal
              );
              console.log(
                `Applying $${voucher.amount} discount to $${discountableTotal}: ${discount}`
              );
            }

            expectedTotal = Math.max(0, expectedTotal - discount);
            console.log('Expected total after discount:', expectedTotal);
          } else {
            console.log('Voucher not found in database');
          }
        } else {
          console.log(
            'No voucher ID provided, expected total remains:',
            expectedTotal
          );
        }

        console.log(
          'Final comparison - Expected:',
          expectedTotal,
          'Received:',
          totalAmount,
          'Difference:',
          Math.abs(expectedTotal - totalAmount)
        );

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

        // Send confirmation email
        try {
          // Get contact email and registration details for the email
          const emailDataResult = await client.query(
            `SELECT DISTINCT
              c.email,
              c.firstname,
              c.lastname
            FROM registration r
            JOIN contact c ON r.contact_id = c.id
            WHERE r.id = ANY($1)
            LIMIT 1`,
            [registrationIds]
          );

          if (emailDataResult.rows.length > 0) {
            const contact = emailDataResult.rows[0];

            // Get activities collection for course names
            const activities = await getCollection('activities');
            const activitiesMap = new Map<string, string>();
            activities.forEach((activity: any) => {
              activitiesMap.set(activity.id.toLowerCase(), activity.data.name);
            });

            // Build registration items for the email
            const registrationItems: RegistrationItem[] =
              registrationsResult.rows.map(row => {
                const courseName =
                  activitiesMap.get(row.course?.toLowerCase()) || row.course;
                return {
                  studentName: '', // Will be populated below
                  courseName: courseName,
                  cost: parseFloat(row.cost) || 0,
                  donation: row.donation ? parseFloat(row.donation) : undefined,
                };
              });

            // Get student names for each registration
            const studentNamesResult = await client.query(
              `SELECT r.id as registration_id, s.firstname, s.lastname
              FROM registration r
              JOIN student s ON r.student_id = s.id
              WHERE r.id = ANY($1)`,
              [registrationIds]
            );

            const studentNamesMap = new Map<
              number,
              { firstname: string; lastname: string }
            >();
            studentNamesResult.rows.forEach(row => {
              studentNamesMap.set(row.registration_id, {
                firstname: row.firstname,
                lastname: row.lastname,
              });
            });

            // Update registration items with student names
            registrationsResult.rows.forEach((row, index) => {
              const studentInfo = studentNamesMap.get(row.id);
              if (studentInfo) {
                registrationItems[index].studentName =
                  `${studentInfo.firstname} ${studentInfo.lastname}`;
              }
            });

            // Send the email
            const emailResult = await sendPaymentConfirmationEmail({
              recipientEmail: contact.email,
              recipientName: `${contact.firstname} ${contact.lastname}`,
              confirmationCode: paymentShortCode,
              registrations: registrationItems,
              totalAmount: totalAmount,
              paymentMethod: paymentMethod as 'paypal' | 'check' | 'none',
              transactionId: transactionId,
            });

            if (!emailResult.success) {
              console.error(
                'Failed to send confirmation email:',
                emailResult.error
              );
            } else {
              console.log(
                'Confirmation email sent successfully:',
                emailResult.messageId
              );
            }
          } else {
            console.log(
              'No contact email found for registrations, skipping email'
            );
          }
        } catch (emailError) {
          // Log the error but don't fail the payment
          console.error('Error sending confirmation email:', emailError);
        }

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
