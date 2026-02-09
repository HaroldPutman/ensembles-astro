import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { getCollection } from 'astro:content';
import { getPool } from '../../lib/db';
import { sendRosterEmail, type ClassRosterData } from '../../lib/email';
import { getFirstDate } from '../../lib/datelib';
import { Temporal } from '@js-temporal/polyfill';
import privateInstructorData from '../../../collections/instructors-private.json';

export const prerender = false;

interface RegistrationRow {
  id: number;
  activity: string;
  student_firstname: string;
  student_lastname: string;
  student_dob: Date | null;
}

interface ActivityData {
  id: string;
  name: string;
  instructors: string[];
  startDate: string;
  startTime: string;
  duration: string;
  repeat: string;
  firstDate: Temporal.ZonedDateTime;
}

interface InstructorInfo {
  id: string;
  name: string;
  email: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Calculate age in years from date of birth
 */
function calculateAge(dob: Date, referenceDate: Date): number {
  const ageInMs = referenceDate.getTime() - dob.getTime();
  const ageInYears = ageInMs / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(ageInYears);
}

/**
 * GET /api/send-rosters
 *
 * Sends roster emails to instructors for their classes.
 * Only includes classes with kind === 'class'.
 *
 * Authentication: Requires either:
 *   - A valid Clerk session (for browser-based calls)
 *   - A valid API key in Authorization header: "Bearer <REMINDER_API_KEY>"
 *
 * Query params:
 *   - instructor: Instructor ID - sends rosters for all classes they teach
 *   - class: Activity ID - sends roster for that class to all its instructors
 *   - (none): Sends rosters to all instructors teaching current classes
 *   - dry-run: If present, don't send emails, just return what would be sent
 */
export const POST: APIRoute = async ({ url, locals, request }) => {
  // Authentication check
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
  const instructorParam = url.searchParams.get('instructor');
  const classParam = url.searchParams.get('class');

  console.log(
    `Send rosters API called (dry-run: ${dryRun}, instructor: ${instructorParam || 'all'}, class: ${classParam || 'all'}, auth: ${hasValidSession ? 'session' : 'api-key'})`
  );

  try {
    // Get all activities with kind === 'class'
    const allActivities = await getCollection('activities');
    const now = Temporal.Now.zonedDateTimeISO('America/Louisville');

    // Get instructor info from collections
    const instructorCollection = await getCollection('instructors');
    const instructorMap = new Map<string, InstructorInfo>();

    for (const inst of instructorCollection) {
      const privateInfo = privateInstructorData.find(
        (p: { id: string; email: string }) => p.id === inst.id
      );
      if (privateInfo?.email) {
        instructorMap.set(inst.id, {
          id: inst.id,
          name: inst.data.name,
          email: privateInfo.email,
        });
      }
    }

    // Filter activities: kind === 'class' and upcoming (first date in future)
    const classActivities: ActivityData[] = [];

    for (const activity of allActivities) {
      // Only include classes
      if (activity.data.kind !== 'class') continue;

      // If class param specified, only include that class
      if (classParam && activity.id !== classParam) continue;

      // If instructor param specified, only include classes with that instructor
      if (
        instructorParam &&
        !activity.data.instructors?.includes(instructorParam)
      ) {
        continue;
      }

      try {
        const firstDate = getFirstDate(
          activity.data.startDate,
          activity.data.startTime,
          activity.data.duration,
          activity.data.repeat || ''
        );

        // Only include upcoming classes (first date in future)
        if (Temporal.ZonedDateTime.compare(firstDate, now) > 0) {
          classActivities.push({
            id: activity.id,
            name: activity.data.name,
            instructors: activity.data.instructors || [],
            startDate: activity.data.startDate,
            startTime: activity.data.startTime,
            duration: activity.data.duration,
            repeat: activity.data.repeat || '',
            firstDate,
          });
        }
      } catch (e) {
        console.warn(
          `Could not calculate first date for activity ${activity.id}:`,
          e
        );
      }
    }

    if (classActivities.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No upcoming classes found',
          emailsSent: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const activityIds = classActivities.map(a => a.id);
    console.log(`Found ${classActivities.length} upcoming classes:`, activityIds);

    // Query registrations for these classes
    const pool = getPool();
    const client = await pool.connect();

    try {
      const result = await client.query<RegistrationRow>(
        `SELECT 
          r.id,
          r.activity,
          s.firstname as student_firstname,
          s.lastname as student_lastname,
          s.dob as student_dob
        FROM registration r
        JOIN student s ON r.student_id = s.id
        WHERE r.activity = ANY($1)
          AND r.payment_id IS NOT NULL
          AND r.cancelled_at IS NULL
        ORDER BY r.activity, s.lastname, s.firstname`,
        [activityIds]
      );

      console.log(`Found ${result.rows.length} registrations`);

      // Group registrations by activity
      const registrationsByActivity = new Map<string, RegistrationRow[]>();
      for (const row of result.rows) {
        if (!registrationsByActivity.has(row.activity)) {
          registrationsByActivity.set(row.activity, []);
        }
        registrationsByActivity.get(row.activity)!.push(row);
      }

      // Build rosters grouped by instructor
      const rostersByInstructor = new Map<
        string,
        {
          instructor: InstructorInfo;
          classes: ClassRosterData[];
        }
      >();

      for (const activity of classActivities) {
        const regs = registrationsByActivity.get(activity.id) || [];
        if (regs.length === 0) continue; // Skip classes with no registrations

        const formattedWeekday = activity.firstDate.toLocaleString('en-US', {
          weekday: 'long',
        });
        const formattedDate = activity.firstDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
        });
        const formattedTime = activity.firstDate.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const referenceDate = new Date(
          activity.firstDate.epochMilliseconds
        );
        const students = regs.map(reg => ({
          name: `${reg.student_firstname} ${reg.student_lastname}`,
          age: reg.student_dob
            ? calculateAge(new Date(reg.student_dob), referenceDate)
            : 0,
        }));

        const classRoster: ClassRosterData = {
          recipientEmail: '', // Will be set per instructor
          recipientName: '', // Will be set per instructor
          activityName: activity.name,
          activityId: activity.id,
          weekday: formattedWeekday,
          startDate: formattedDate,
          startTime: formattedTime,
          students,
        };

        // Add this roster to each instructor
        for (const instructorId of activity.instructors) {
          // If instructor param specified, only include that instructor
          if (instructorParam && instructorId !== instructorParam) continue;

          const instructor = instructorMap.get(instructorId);
          if (!instructor) {
            console.warn(`Instructor ${instructorId} not found or has no email`);
            continue;
          }

          if (!rostersByInstructor.has(instructorId)) {
            rostersByInstructor.set(instructorId, {
              instructor,
              classes: [],
            });
          }
          rostersByInstructor.get(instructorId)!.classes.push({
            ...classRoster,
            recipientEmail: instructor.email,
            recipientName: instructor.name,
          });
        }
      }

      if (rostersByInstructor.size === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No instructors found with enrolled classes',
            emailsSent: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(
        `Sending rosters to ${rostersByInstructor.size} instructors`
      );

      // Send roster emails
      const results: {
        instructorId: string;
        classCount: number;
        totalStudents: number;
        success: boolean;
        error?: string;
      }[] = [];

      for (const [instructorId, data] of rostersByInstructor) {
        const totalStudents = data.classes.reduce(
          (sum, c) => sum + c.students.length,
          0
        );

        const emailResult = {
          instructorId,
          classCount: data.classes.length,
          totalStudents,
          success: false,
          error: undefined as string | undefined,
        };

        if (dryRun) {
          emailResult.success = true;
          console.log(
            `[DRY RUN] Would send roster to ${instructorId} for ${data.classes.length} classes`
          );
        } else {
          const sendResult = await sendRosterEmail({
            recipientEmail: data.instructor.email,
            recipientName: data.instructor.name,
            classes: data.classes,
          });

          emailResult.success = sendResult.success;
          emailResult.error = sendResult.error;
        }

        results.push(emailResult);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({
          success: failCount === 0,
          message: dryRun
            ? `[DRY RUN] Would send ${successCount} roster emails`
            : `Sent ${successCount} roster emails${failCount > 0 ? `, ${failCount} failed` : ''}`,
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
    console.error('Error in send-rosters:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send rosters',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
