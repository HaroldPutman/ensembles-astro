declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: {
      authentications: {
        'api-key': {
          apiKey: string;
        };
      };
    };
  }

  export class SendSmtpEmail {
    sender: { name: string; email: string };
    to: Array<{ email: string }>;
    replyTo: { email: string; name: string };
    subject: string;
    htmlContent: string;
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(email: SendSmtpEmail): Promise<any>;
  }
} 