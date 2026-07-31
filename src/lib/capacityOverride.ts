/** Query param that allows registration past sizeMax. */
export const CAPACITY_OVERRIDE_PARAM = 'overflow';

/** sessionStorage key: JSON string array of activity IDs with override. */
export const CAPACITY_OVERRIDE_STORAGE_KEY = 'pastfull';

export function hasCapacityOverrideParam(
  searchParams: URLSearchParams
): boolean {
  return searchParams.has(CAPACITY_OVERRIDE_PARAM);
}

/** Normalize a stored or request value into lowercased activity IDs. */
export function parseCapacityOverrideIds(raw: unknown): string[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map(id => id.toLowerCase());
}
