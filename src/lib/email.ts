/**
 * Email utilities using Brevo Transactional Email API
 */

interface RegistrationItem {
  studentName: string;
  activityName: string;
  cost: number;
  donation?: number;
}

interface VoucherInfo {
  code: string;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

interface PaymentConfirmationData {
  recipientEmail: string;
  recipientName: string;
  confirmationCode: string;
  registrations: RegistrationItem[];
  subtotal: number;
  totalAmount: number;
  paymentMethod: 'paypal' | 'check' | 'none';
  transactionId?: string;
  voucher?: VoucherInfo;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Formats a number as currency (USD)
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Generates HTML for the registration items list
 */
function generateRegistrationsHtml(registrations: RegistrationItem[]): string {
  const fontStack = 'Arial, Helvetica, sans-serif';
  return registrations
    .map(reg => {
      let html = `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; font-family: ${fontStack};">
          <strong>${escapeHtml(reg.studentName)}</strong><br>
          <span style="color: #666;">${escapeHtml(reg.activityName)}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: ${fontStack};">
          ${formatCurrency(reg.cost)}`;
      if (reg.donation && reg.donation > 0) {
        html += `<br><span style="color: #666; font-size: 0.9em;">+ ${formatCurrency(reg.donation)} donation</span>`;
      }
      html += `
        </td>
      </tr>`;
      return html;
    })
    .join('');
}

/**
 * Generates the email HTML content
 */
function generateEmailHtml(data: PaymentConfirmationData): string {
  const formattedCode =
    data.confirmationCode.length === 6
      ? `${data.confirmationCode.slice(0, 3)}-${data.confirmationCode.slice(3)}`
      : data.confirmationCode;

  let paymentStatusText: string;
  let paymentStatusColor: string;

  switch (data.paymentMethod) {
    case 'paypal':
      paymentStatusText = 'Payment received via PayPal';
      paymentStatusColor = '#28a745';
      break;
    case 'check':
      paymentStatusText = 'Awaiting check payment';
      paymentStatusColor = '#ffc107';
      break;
    case 'none':
      paymentStatusText = 'No payment required';
      paymentStatusColor = '#28a745';
      break;
  }

  const fontStack = 'Arial, Helvetica, sans-serif';

  const checkPaymentInstructions =
    data.paymentMethod === 'check'
      ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px;">
          <h3 style="color: #856404; margin-top: 0; font-family: ${fontStack};">Payment Instructions</h3>
          <p style="color: #856404; margin-bottom: 10px; font-family: ${fontStack};">Please mail your check to:</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; font-family: ${fontStack};">
                <strong>Ensembles, Inc.</strong><br>
                1120 Monroe St.<br>
                Charlestown, IN 47111
              </td>
            </tr>
          </table>
          <p style="color: #856404; margin-top: 15px; background: white; padding: 10px; border-radius: 4px; font-family: ${fontStack};">
            <strong>Important:</strong> Please include your confirmation code <strong style="font-family: 'Courier New', Courier, monospace;">${formattedCode}</strong> or participant name on the check memo line.
          </p>
        </td>
      </tr>
    </table>
  `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; font-family: ${fontStack}; line-height: 1.6; color: #333;">
          
          <tr>
            <td style="background: #2c3e50; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-family: ${fontStack};">Registration Confirmed!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9; font-family: ${fontStack};">Thank you for registering with Ensembles</p>
            </td>
          </tr>
          
          <tr>
            <td style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
              
              <p style="font-family: ${fontStack};">Hello ${escapeHtml(data.recipientName)},</p>
              
              <p style="font-family: ${fontStack};">Your registration has been confirmed. Here's a summary of your enrollment:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: ${fontStack};">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #2c3e50; font-family: ${fontStack};">Participant / Activity</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #2c3e50; font-family: ${fontStack};">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateRegistrationsHtml(data.registrations)}
                </tbody>
                <tfoot>
                  ${data.voucher ? `
                  <tr>
                    <td style="padding: 12px; font-family: ${fontStack};">Subtotal</td>
                    <td style="padding: 12px; text-align: right; font-family: ${fontStack};">${formatCurrency(data.subtotal)}</td>
                  </tr>
                  <tr style="color: #28a745;">
                    <td style="padding: 12px; font-family: ${fontStack};">
                      Voucher: 
                      ${data.voucher.description ? `<br><span style="font-size: 0.85em; color: #666;">${escapeHtml(data.voucher.description)}</span>` : ''}
                    </td>
                    <td style="padding: 12px; text-align: right; font-family: ${fontStack};">-${formatCurrency(data.voucher.discountAmount)}</td>
                  </tr>
                  ` : ''}
                  <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; font-weight: bold; font-family: ${fontStack};">Total</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.2em; color: #2c3e50; font-family: ${fontStack};">${formatCurrency(data.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td style="background: ${paymentStatusColor}15; border-left: 4px solid ${paymentStatusColor}; padding: 15px;">
                    <p style="margin: 0; color: ${paymentStatusColor}; font-weight: 500; font-family: ${fontStack};">${paymentStatusText}</p>
                  </td>
                </tr>
              </table>
              
              ${checkPaymentInstructions}

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 18px;">
                <tr>
                  <td style="background: #fafbfc; border-radius: 6px; padding: 10px 14px; text-align: left;">
                    <span style="color: #888; font-family: ${fontStack};">Confirmation Code:</span>
                    <span style="margin-left: 8px; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; color: #555; background: #f1f1f1; padding: 2px 8px; border-radius: 4px;">${formattedCode}</span>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 25px;">
                <tr>
                  <td style="background: #e8f4fd; border-radius: 8px; padding: 20px;">
                    <h3 style="margin-top: 0; color: #2c3e50; font-family: ${fontStack};">What's Next?</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #555; font-family: ${fontStack};">
                      <li>Please arrive no earlier than 10 minutes before the scheduled start time</li>
                      <li>If you have any questions, please contact us</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; text-align: center; margin: 0; font-family: ${fontStack};">
                Questions? Contact us at <a href="mailto:info@charlestownensembles.com" style="color: #2c3e50;">info@charlestownensembles.com</a>
              </p>
              
            </td>
          </tr>
          
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
              <p style="margin: 0; color: #666; font-size: 12px; font-family: ${fontStack};">
                &copy; ${new Date().getFullYear()} Ensembles, Inc. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generates plain text version of the email
 */
function generateEmailText(data: PaymentConfirmationData): string {
  const formattedCode =
    data.confirmationCode.length === 6
      ? `${data.confirmationCode.slice(0, 3)}-${data.confirmationCode.slice(3)}`
      : data.confirmationCode;

  let paymentStatus: string;
  switch (data.paymentMethod) {
    case 'paypal':
      paymentStatus = 'Payment received via PayPal';
      break;
    case 'check':
      paymentStatus = 'Awaiting check payment';
      break;
    case 'none':
      paymentStatus = 'No payment required';
      break;
  }

  const registrationsList = data.registrations
    .map(reg => {
      let line = `- ${reg.studentName}: ${reg.activityName} - ${formatCurrency(reg.cost)}`;
      if (reg.donation && reg.donation > 0) {
        line += ` (+ ${formatCurrency(reg.donation)} donation)`;
      }
      return line;
    })
    .join('\n');

  const checkInstructions =
    data.paymentMethod === 'check'
      ? `
PAYMENT INSTRUCTIONS
--------------------
Please mail your check to:

Ensembles, Inc.
1120 Monroe St.
Charlestown, IN

Important: Please include your confirmation code ${formattedCode} or participant name on the check memo line.
`
      : '';

  return `
REGISTRATION CONFIRMED
======================

Confirmation Code: ${formattedCode}

Hello ${data.recipientName},

Your registration has been confirmed. Here's a summary of your enrollment:

REGISTRATION DETAILS
--------------------
${registrationsList}
${data.voucher ? `
Subtotal: ${formatCurrency(data.subtotal)}
Voucher: -${formatCurrency(data.voucher.discountAmount)}${data.voucher.description ? ` - ${data.voucher.description}` : ''}
` : ''}
Total: ${formatCurrency(data.totalAmount)}

Status: ${paymentStatus}
${checkInstructions}

WHAT'S NEXT?
------------
- Please arrive no earlier than 10 minutes before the scheduled start time
- If you have any questions, please contact us

Questions? Contact us at info@charlestownensembles.com

© ${new Date().getFullYear()} Ensembles, Inc. All rights reserved.
`;
}

/**
 * Sends a payment confirmation email via Brevo Transactional Email API
 */
export async function sendPaymentConfirmationEmail(
  data: PaymentConfirmationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Validate input data
  if (
    !data.recipientEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipientEmail)
  ) {
    return { success: false, error: 'Invalid recipient email address' };
  }

  if (!data.registrations || data.registrations.length === 0) {
    return { success: false, error: 'No registrations provided' };
  }

  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error('BREVO_API_KEY environment variable is not set');
    return { success: false, error: 'Email service not configured' };
  }

  let subject: string;
  switch (data.paymentMethod) {
    case 'paypal':
      subject = `Registration Confirmed - ${data.confirmationCode}`;
      break;
    case 'check':
      subject = `Registration Submitted - ${data.confirmationCode}`;
      break;
    case 'none':
      subject = `Registration Confirmed - ${data.confirmationCode}`;
      break;
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    console.error('BREVO_SENDER_EMAIL environment variable is not set');
    return { success: false, error: 'Email sender not configured' };
  }

  const emailPayload = {
    sender: {
      name: 'Ensembles',
      email: senderEmail,
    },
    to: [
      {
        email: data.recipientEmail,
        name: data.recipientName,
      },
    ],
    subject: subject,
    htmlContent: generateEmailHtml(data),
    textContent: generateEmailText(data),
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API error:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to send email',
      };
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// =============================================================================
// CLASS REMINDER EMAIL
// =============================================================================

interface ReminderParticipant {
  studentName: string;
}

interface ClassReminderData {
  recipientEmail: string;
  recipientName: string;
  activityName: string;
  weekday: string; // formatted day like "Tuesday"
  startDate: string; // formatted date like "January 14"
  startTime: string; // formatted time like "2:00 PM"
  participants: ReminderParticipant[];
}

/**
 * Generates HTML for the reminder email
 */
function generateReminderEmailHtml(data: ClassReminderData): string {
  const fontStack = 'Arial, Helvetica, sans-serif';
  const safeName = escapeHtml(data.recipientName);
  const safeActivityName = escapeHtml(data.activityName);

  const participantList = data.participants
    .map(
      p =>
        `<li style="margin-bottom: 4px; font-family: ${fontStack};">${escapeHtml(p.studentName)}</li>`
    )
    .join('');

  const participantHtml =
    data.participants.length > 1
      ? `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.5; color: #333; font-family: ${fontStack};">
         The following students are registered for this class:
      </p>
      <ul style="margin: 0 0 24px; padding-left: 24px; color: #333;">
        ${participantList}
      </ul>`
      : `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.5; color: #333; font-family: ${fontStack};">
        <strong>${escapeHtml(data.participants[0].studentName)}</strong> is registered for this class.
      </p>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Class Reminder - ${safeActivityName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: ${fontStack};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2c5530; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; font-family: ${fontStack};">
                Class Reminder
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #333; font-family: ${fontStack};">
                Hi ${safeName},
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #333; font-family: ${fontStack};">
                Your Ensembles class <strong>${safeActivityName}</strong> begins ${escapeHtml(data.weekday)} at ${escapeHtml(data.startTime)}.
              </p>
              
              <!-- Class Details Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666; font-family: ${fontStack};">
                      <strong>Class:</strong> ${safeActivityName}
                    </p>
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666; font-family: ${fontStack};">
                      <strong>Date:</strong> ${escapeHtml(data.weekday)}, ${escapeHtml(data.startDate)}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #666; font-family: ${fontStack};">
                      <strong>Time:</strong> ${escapeHtml(data.startTime)}
                    </p>
                  </td>
                </tr>
              </table>
                           
              ${participantHtml}
              
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #333; font-family: ${fontStack};">
                All classes are held at Charlestown Ensembles, 1120 Monroe St., Charlestown, IN.
                We look forward to seeing you there!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 14px; color: #666; font-family: ${fontStack};">
                Ensembles, Inc.<br>
                <a href="https://charlestownensembles.com" style="color: #2c5530;">CharlestownEnsembles.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates plain text version of the reminder email
 */
function generateReminderEmailText(data: ClassReminderData): string {
  const participantList = data.participants
    .map(p => `  - ${p.studentName}`)
    .join('\n');

  return `
CLASS REMINDER

Hi ${data.recipientName},

Your Ensembles class ${data.activityName} begins ${data.weekday} at ${data.startTime}.

Class: ${data.activityName}
Date: ${data.weekday}, ${data.startDate}
Time: ${data.startTime}

Registered participants:
${participantList}

All classes are held at Charlestown Ensembles, 1120 Monroe St., Charlestown, IN.
We look forward to seeing you there! 

---
Ensembles, Inc.
https://charlestownensembles.com
`.trim();
}

/**
 * Sends a class reminder email
 */
export async function sendClassReminderEmail(
  data: ClassReminderData
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('BREVO_API_KEY is not set');
    return { success: false, error: 'Email service not configured' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    console.error('BREVO_SENDER_EMAIL is not set');
    return { success: false, error: 'Email sender not configured' };
  }

  // Validate inputs
  if (
    !data.recipientEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipientEmail)
  ) {
    return { success: false, error: 'Invalid recipient email address' };
  }
  if (!data.participants.length) {
    return { success: false, error: 'Missing required email data' };
  }

  const subject = `Reminder: ${data.activityName} starts ${data.weekday}`;

  const emailPayload = {
    sender: {
      name: 'Ensembles',
      email: senderEmail,
    },
    to: [
      {
        email: data.recipientEmail,
        name: data.recipientName,
      },
    ],
    subject: subject,
    htmlContent: generateReminderEmailHtml(data),
    textContent: generateReminderEmailText(data),
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API error:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to send reminder email',
      };
    }

    const result = await response.json();
    // eslint-disable-next-line no-console
    console.log('Reminder email sent successfully:', result);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Error sending reminder email:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to send reminder email',
    };
  }
}

export type {
  PaymentConfirmationData,
  RegistrationItem,
  VoucherInfo,
  ClassReminderData,
};
