import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { getCollection } from 'astro:content';
import { getPool } from '../../lib/db';
import { sendClassReminderEmail } from '../../lib/email';
import { getFirstDate } from '../../lib/datelib';
import { Temporal } from '@js-temporal/polyfill';

export const prerender = false;

interface RegistrationRow {
  id: number;
  activity: string;
  student_firstname: string;
  student_lastname: string;
  contact_id: number;
  contact_firstname: string;
  contact_lastname: string;
  contact_email: string;
}

interface ActivityData {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  duration: string;
  repeat: string;
  firstDate: Temporal.ZonedDateTime;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against itself to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/send-reminders
 *
 * Sends reminder emails for classes starting within 2 calendar days.
 * Updates reminded_at column to prevent duplicate reminders.
 *
 * Authentication: Requires either:
 *   - A valid Clerk session (for browser-based calls)
 *   - A valid API key in Authorization header: "Bearer <REMINDER_API_KEY>"
 *
 * Query params:
 *   - dry-run: If present, don't send emails or update DB, just return what would be sent
 */
export const GET: APIRoute = async ({ url, locals, request }) => {
  // Authentication check
  const authHeader = request.headers.get('Authorization');
  const expectedApiKey = process.env.REMINDER_API_KEY;

  // Check for API key authentication (for cron jobs / automated calls)
  const hasValidApiKey =
    expectedApiKey &&
    authHeader?.startsWith('Bearer ') &&
    timingSafeEqual(authHeader.slice(7), expectedApiKey);

  // Check for Clerk session authentication (for browser-based calls)
  let hasValidSession = false;
  try {
    const auth = locals.auth?.();
    hasValidSession = !!auth?.userId;
  } catch {
    // Clerk auth not available (e.g., on prerendered pages)
    hasValidSession = false;
  }

  if (!hasValidApiKey && !hasValidSession) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized. Provide a valid API key or sign in.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const dryRun = url.searchParams.has('dry-run');

  // eslint-disable-next-line no-console
  console.log(
    `Send reminders API called (dry-run: ${dryRun}, auth: ${hasValidSession ? 'session' : 'api-key'})`
  );

  try {
    // Get all activities and calculate their first dates
    const activities = await getCollection('activities');
    const now = Temporal.Now.zonedDateTimeISO('America/Louisville');
    const twoDaysFromNow = now.add({ days: 2 }).with({
      hour: 23,
      minute: 59,
      second: 59,
    });

    // Filter activities that start within 2 calendar days
    const upcomingActivities: ActivityData[] = [];

    for (const activity of activities) {
      try {
        const firstDate = getFirstDate(
          activity.data.startDate,
          activity.data.startTime,
          activity.data.duration,
          activity.data.repeat || ''
        );

        // Check if first date is in the future and within 2 days
        if (
          Temporal.ZonedDateTime.compare(firstDate, now) > 0 &&
          Temporal.ZonedDateTime.compare(firstDate, twoDaysFromNow) <= 0
        ) {
          upcomingActivities.push({
            id: activity.id,
            name: activity.data.name,
            startDate: activity.data.startDate,
            startTime: activity.data.startTime,
            duration: activity.data.duration,
            repeat: activity.data.repeat || '',
            firstDate,
          });
        }
      } catch (e) {
        console.warn(`Could not calculate first date for activity ${activity.id}:`, e);
      }
    }

    if (upcomingActivities.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No upcoming activities within 2 days',
          emailsSent: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const activityIds = upcomingActivities.map(a => a.id);
    console.log(`Found ${upcomingActivities.length} upcoming activities:`, activityIds);

    // Query registrations that haven't been reminded yet
    const pool = getPool();
    const client = await pool.connect();

    try {
      // Get all paid registrations for upcoming activities that haven't been reminded
      const result = await client.query<RegistrationRow>(
        `SELECT 
          r.id,
          r.activity,
          s.firstname as student_firstname,
          s.lastname as student_lastname,
          c.id as contact_id,
          c.firstname as contact_firstname,
          c.lastname as contact_lastname,
          c.email as contact_email
        FROM registration r
        JOIN student s ON r.student_id = s.id
        JOIN contact c ON r.contact_id = c.id
        WHERE r.activity = ANY($1)
          AND r.payment_id IS NOT NULL
          AND r.cancelled_at IS NULL
          AND r.reminded_at IS NULL
          AND c.email IS NOT NULL
        ORDER BY r.activity, c.id, s.lastname, s.firstname`,
        [activityIds]
      );

      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No registrations need reminders',
            emailsSent: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`Found ${result.rows.length} registrations to remind`);

      // Group registrations by activity and contact
      const reminderGroups = new Map<
        string,
        {
          activity: ActivityData;
          contactId: number;
          contactName: string;
          contactEmail: string;
          participants: { studentName: string; registrationId: number }[];
        }
      >();

      for (const row of result.rows) {
        const key = `${row.activity}-${row.contact_id}`;
        const activity = upcomingActivities.find(a => a.id === row.activity);
        if (!activity) continue;

        if (!reminderGroups.has(key)) {
          reminderGroups.set(key, {
            activity,
            contactId: row.contact_id,
            contactName: `${row.contact_firstname} ${row.contact_lastname || ''}`.trim(),
            contactEmail: row.contact_email,
            participants: [],
          });
        }

        reminderGroups.get(key)!.participants.push({
          studentName: `${row.student_firstname} ${row.student_lastname}`,
          registrationId: row.id,
        });
      }

      console.log(`Grouped into ${reminderGroups.size} reminder emails`);

      // Send reminder emails
      const results: {
        contactEmail: string;
        activityName: string;
        participants: string[];
        success: boolean;
        error?: string;
      }[] = [];

      for (const [, group] of reminderGroups) {
        const formattedWeekday = group.activity.firstDate.toLocaleString(
          'en-US',
          { weekday: 'long' }
        );
        const formattedDate = group.activity.firstDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
        });
        const formattedTime = group.activity.firstDate.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const emailResult = {
          contactEmail: group.contactEmail,
          activityName: group.activity.name,
          participants: group.participants.map(p => p.studentName),
          success: false,
          error: undefined as string | undefined,
        };

        if (dryRun) {
          emailResult.success = true;
          console.log(`[DRY RUN] Would send reminder to ${group.contactEmail} for ${group.activity.name}`);
        } else {
          // Send the email
          const sendResult = await sendClassReminderEmail({
            recipientEmail: group.contactEmail,
            recipientName: group.contactName,
            activityName: group.activity.name,
            weekday: formattedWeekday,
            startDate: formattedDate,
            startTime: formattedTime,
            participants: group.participants.map(p => ({
              studentName: p.studentName,
            })),
          });

          emailResult.success = sendResult.success;
          emailResult.error = sendResult.error;

          if (sendResult.success) {
            // Update reminded_at for all registrations in this group
            const registrationIds = group.participants.map(p => p.registrationId);
            await client.query(
              `UPDATE registration SET reminded_at = NOW() WHERE id = ANY($1)`,
              [registrationIds]
            );
            console.log(`Updated reminded_at for registrations: ${registrationIds.join(', ')}`);
          }
        }

        results.push(emailResult);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({
          success: failCount === 0,
          message: dryRun
            ? `[DRY RUN] Would send ${successCount} reminder emails`
            : `Sent ${successCount} reminder emails${failCount > 0 ? `, ${failCount} failed` : ''}`,
          emailsSent: successCount,
          emailsFailed: failCount,
          details: results,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in send-reminders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reminders',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

