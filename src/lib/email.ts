/**
 * Email utilities using Brevo Transactional Email API
 */

interface RegistrationItem {
  studentName: string;
  courseName: string;
  cost: number;
  donation?: number;
}

interface PaymentConfirmationData {
  recipientEmail: string;
  recipientName: string;
  confirmationCode: string;
  registrations: RegistrationItem[];
  totalAmount: number;
  paymentMethod: 'paypal' | 'check' | 'none';
  transactionId?: string;
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
          <strong>${reg.studentName}</strong><br>
          <span style="color: #666;">${reg.courseName}</span>
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
                Charlestown, IN
              </td>
            </tr>
          </table>
          <p style="color: #856404; margin-top: 15px; background: white; padding: 10px; border-radius: 4px; font-family: ${fontStack};">
            <strong>Important:</strong> Please include your confirmation code <strong style="font-family: 'Courier New', Courier, monospace;">${formattedCode}</strong> or student name on the check memo line.
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
              
              <p style="font-family: ${fontStack};">Hello ${data.recipientName},</p>
              
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
                      <li>Please arrive 10 minutes before your first class</li>
                      <li>If you have any questions, please contact us</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="color: #666; font-size: 14px; text-align: center; margin: 0; font-family: ${fontStack};">
                Questions? Contact us at <a href="mailto:info@ensemblesmusic.org" style="color: #2c3e50;">info@ensemblesmusic.org</a>
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
      let line = `- ${reg.studentName}: ${reg.courseName} - ${formatCurrency(reg.cost)}`;
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

Important: Please include your confirmation code ${formattedCode} or student name on the check memo line.
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

Total: ${formatCurrency(data.totalAmount)}

Status: ${paymentStatus}
${checkInstructions}

WHAT'S NEXT?
------------
- Please arrive 10 minutes before your first class
- Bring comfortable clothing for movement
- If you have any questions, please contact us

Questions? Contact us at info@ensemblesmusic.org

© ${new Date().getFullYear()} Ensembles, Inc. All rights reserved.
`;
}

/**
 * Sends a payment confirmation email via Brevo Transactional Email API
 */
export async function sendPaymentConfirmationEmail(
  data: PaymentConfirmationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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

export type { PaymentConfirmationData, RegistrationItem };
