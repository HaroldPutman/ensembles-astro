import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { getCollection } from 'astro:content';
import { Temporal } from '@js-temporal/polyfill';
import { getPool } from '../../lib/db';
import { sendPreregistrationInviteEmail } from '../../lib/email';
import { formatRegistrationOpensDate } from '../../lib/datelib';
import { loadPreregistrationInviteGroups } from '../../lib/preregistrationInvites';
import { SITE_ORIGIN } from '../../lib/preregistration';

export const prerender = false;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function formatCost(cost?: number): string | undefined {
  if (cost === undefined) return undefined;
  if (cost === 0) return 'Free';
  return `$${cost.toFixed(2).replace(/\.00$/, '')}`;
}

/**
 * GET /api/send-preregistration
 *
 * Emails contacts of students in currently active classes, inviting them to
 * pre-register for the next session with the same class id (e.g. piano1b).
 *
 * Authentication: Requires either:
 *   - A valid Clerk session (for browser-based calls)
 *   - A valid API key in Authorization header: "Bearer <REMINDER_API_KEY>"
 *
 * Query params:
 *   - dry-run: If present, don't send emails or update DB, just return what would be sent
 *   - class: Optional slug or activity id to limit which pairs are sent
 */
export const GET: APIRoute = async ({ url, locals, request }) => {
  const authHeader = request.headers.get('Authorization');
  const expectedApiKey = process.env.REMINDER_API_KEY;

  const hasValidApiKey =
    expectedApiKey &&
    authHeader?.startsWith('Bearer ') &&
    timingSafeEqual(authHeader.slice(7), expectedApiKey);

  let hasValidSession = false;
  try {
    const auth = locals.auth?.();
    hasValidSession = !!auth?.userId;
  } catch {
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
  const classFilter = url.searchParams.get('class') ?? undefined;

  // eslint-disable-next-line no-console
  console.log(
    `Send preregistration API called (dry-run: ${dryRun}, class: ${classFilter || 'all'}, auth: ${hasValidSession ? 'session' : 'api-key'})`
  );

  try {
    const activities = await getCollection('activities');
    const now = Temporal.Now.zonedDateTimeISO('America/Louisville');

    const pool = getPool();
    const client = await pool.connect();

    try {
      const groups = await loadPreregistrationInviteGroups(
        client,
        activities,
        now,
        { origin: SITE_ORIGIN, classFilter }
      );

      if (groups.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No preregistration invites to send',
            emailsSent: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const results: {
        contactEmail: string;
        currentActivityName: string;
        upcomingActivityId: string;
        upcomingActivityName: string;
        preregisterUrl: string;
        participants: string[];
        success: boolean;
        error?: string;
      }[] = [];

      for (const group of groups) {
        const formattedWeekday = group.upcomingFirstDate.toLocaleString(
          'en-US',
          { weekday: 'long' }
        );
        const formattedDate = group.upcomingFirstDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
        });
        const formattedTime = group.upcomingFirstDate.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const registrationOpensLabel =
          group.registrationOpensAt &&
          Temporal.ZonedDateTime.compare(group.registrationOpensAt, now) > 0
            ? formatRegistrationOpensDate(group.registrationOpensAt)
            : undefined;

        const emailResult = {
          contactEmail: group.contactEmail,
          currentActivityName: group.currentActivityName,
          upcomingActivityId: group.upcomingActivityId,
          upcomingActivityName: group.upcomingActivityName,
          preregisterUrl: group.preregisterUrl,
          participants: group.participants.map(p => p.studentName),
          success: false,
          error: undefined as string | undefined,
        };

        if (dryRun) {
          emailResult.success = true;
          // eslint-disable-next-line no-console
          console.log(
            `[DRY RUN] Would send preregistration invite to ${group.contactEmail} for ${group.upcomingActivityName} (${group.preregisterUrl})`
          );
        } else {
          const sendResult = await sendPreregistrationInviteEmail({
            recipientEmail: group.contactEmail,
            recipientName: group.contactName,
            recipientFirstName: group.contactFirstName,
            recipientLastName: group.contactLastName,
            currentActivityName: group.currentActivityName,
            upcomingActivityName: group.upcomingActivityName,
            weekday: formattedWeekday,
            startDate: formattedDate,
            startTime: formattedTime,
            cost: formatCost(group.upcomingCost),
            location: group.upcomingLocation,
            registrationOpensLabel,
            preregisterUrl: group.preregisterUrl,
            participants: group.participants.map(p => ({
              firstName: p.studentFirstName,
              lastName: p.studentLastName,
            })),
          });

          emailResult.success = sendResult.success;
          emailResult.error = sendResult.error;

          if (sendResult.success) {
            const registrationIds = group.participants.map(
              p => p.registrationId
            );
            await client.query(
              `UPDATE registration SET preregister_invited_at = NOW() WHERE id = ANY($1)`,
              [registrationIds]
            );
            // eslint-disable-next-line no-console
            console.log(
              `Updated preregister_invited_at for registrations: ${registrationIds.join(', ')}`
            );
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
            ? `[DRY RUN] Would send ${successCount} preregistration invite emails`
            : `Sent ${successCount} preregistration invite emails${failCount > 0 ? `, ${failCount} failed` : ''}`,
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
    console.error('Error in send-preregistration:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send preregistration invites',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
