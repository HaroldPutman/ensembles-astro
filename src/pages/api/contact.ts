import type { APIRoute } from 'astro';
import SibApiV3Sdk from 'sib-api-v3-sdk';

export const prerender = false;

// Initialize the Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = import.meta.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          message: 'Invalid JSON in request body',
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { name, email, message } = body;

    // Validate the input
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          message: 'Name, email, and message are required',
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Create the email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'Ensembles Contact Form', email: 'webapp@charlestownensembles.com' };
    sendSmtpEmail.to = [{ email: 'harold@charlestownensembles.com' }];
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
          'Content-Type': 'application/json'
        }
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
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 