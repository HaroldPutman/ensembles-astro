import type { APIRoute } from 'astro';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@getbrevo/brevo';
import { logBlockedContactSubmission } from '../../lib/blockedContactSubmission';
import { getPool } from '../../lib/db';
import { isSpamContactSubmission } from '../../lib/gibberish';

export const prerender = false;

// Initialize the Brevo API client
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(
  TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

function successResponse() {
  return new Response(
    JSON.stringify({
      message: 'Message sent successfully',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

async function recordBlockedSubmission(
  submission: Parameters<typeof logBlockedContactSubmission>[1]
) {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await logBlockedContactSubmission(client, submission);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to log blocked contact submission:', error);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse the request body
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

    const { name, email, message, website } = body;
    const submissionFields = {
      name: String(name ?? ''),
      email: String(email ?? ''),
      message: String(message ?? ''),
      website: website ? String(website) : null,
    };

    // Honeypot: log and silently accept without sending email
    if (website) {
      await recordBlockedSubmission({
        ...submissionFields,
        blockReason: 'honeypot',
      });
      return successResponse();
    }

    // Gibberish: log and silently accept without sending email
    if (
      isSpamContactSubmission(submissionFields.name, submissionFields.message)
    ) {
      await recordBlockedSubmission({
        ...submissionFields,
        blockReason: 'gibberish',
      });
      return successResponse();
    }

    // Validate the input
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          message: 'Name, email, and message are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create the email
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    if (!senderEmail) {
      return new Response(
        JSON.stringify({ message: 'Email sender not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Ensembles Contact Form',
      email: senderEmail,
    };
    sendSmtpEmail.to = [{ email: 'info@charlestownensembles.com' }];
    sendSmtpEmail.replyTo = { email, name };
    sendSmtpEmail.subject = `New Contact Form Submission from ${name}`;
    sendSmtpEmail.htmlContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    // Send the email
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return new Response(
      JSON.stringify({
        message: 'Message sent successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to send message',
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
