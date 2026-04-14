/**
 * Activity `status` from MDX frontmatter (see `content.config.ts`).
 * Add cases here when new status values are introduced.
 */
export function isActivityCancelled(data: { status?: string }): boolean {
  return data.status === 'cancelled';
}
