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
  return registrations
    .map(reg => {
      let html = `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
          <strong>${reg.studentName}</strong><br>
          <span style="color: #666;">${reg.courseName}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">
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

  const checkPaymentInstructions =
    data.paymentMethod === 'check'
      ? `
    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #856404; margin-top: 0;">Payment Instructions</h3>
      <p style="color: #856404; margin-bottom: 10px;">Please mail your check to:</p>
      <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107;">
        <strong>Ensembles, Inc.</strong><br>
        1120 Monroe St.<br>
        Charlestown, IN
      </div>
      <p style="color: #856404; margin-top: 15px; background: white; padding: 10px; border-radius: 4px;">
        <strong>Important:</strong> Please include your confirmation code <strong style="font-family: monospace;">${formattedCode}</strong> or student name on the check memo line.
      </p>
    </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Registration Confirmed!</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">Thank you for registering with Ensembles</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
      <p style="margin: 0 0 5px; color: #666; font-size: 14px;">Confirmation Code</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 3px; color: #2c3e50;">${formattedCode}</p>
    </div>
    
    <p>Hello ${data.recipientName},</p>
    
    <p>Your registration has been confirmed. Here's a summary of your enrollment:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f8f9fa;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #2c3e50;">Student / Class</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #2c3e50;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${generateRegistrationsHtml(data.registrations)}
      </tbody>
      <tfoot>
        <tr style="background: #f8f9fa;">
          <td style="padding: 12px; font-weight: bold;">Total</td>
          <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.2em; color: #2c3e50;">${formatCurrency(data.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    
    <div style="background: ${paymentStatusColor}15; border-left: 4px solid ${paymentStatusColor}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: ${paymentStatusColor}; font-weight: 500;">${paymentStatusText}</p>
    </div>
    
    ${checkPaymentInstructions}
    
    <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin-top: 25px;">
      <h3 style="margin-top: 0; color: #2c3e50;">What's Next?</h3>
      <ul style="margin: 0; padding-left: 20px; color: #555;">
        <li>Please arrive 10 minutes before your first class</li>
        <li>Bring comfortable clothing for movement</li>
        <li>If you have any questions, please contact us</li>
      </ul>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
      Questions? Contact us at <a href="mailto:info@ensemblesmusic.org" style="color: #2c3e50;">info@ensemblesmusic.org</a>
    </p>
    
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="margin: 0; color: #666; font-size: 12px;">
      &copy; ${new Date().getFullYear()} Ensembles, Inc. All rights reserved.
    </p>
  </div>
  
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

  const emailPayload = {
    sender: {
      name: 'Ensembles',
      email: 'harold@charlestownensembles.com',
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
