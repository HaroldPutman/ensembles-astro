import type { PoolClient } from 'pg';

export type ContactBlockReason = 'honeypot' | 'gibberish';

export interface BlockedContactSubmission {
  name: string;
  email: string;
  message: string;
  website: string | null;
  blockReason: ContactBlockReason;
}

export async function logBlockedContactSubmission(
  client: PoolClient,
  submission: BlockedContactSubmission
): Promise<void> {
  await client.query(
    `INSERT INTO blocked_contact_submission (name, email, message, website, block_reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      submission.name,
      submission.email,
      submission.message,
      submission.website,
      submission.blockReason,
    ]
  );
}
