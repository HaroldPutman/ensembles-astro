/** sessionStorage key: JSON array of registration IDs in the checkout cart. */
export const REGISTRATIONS_STORAGE_KEY = 'registrations';

/**
 * sessionStorage flag set when the user chooses "Add Another Registration".
 * The next student-form submit appends to the cart; otherwise the cart is replaced
 * so abandoned in-progress registrations are not paid accidentally.
 */
export const ADDING_ANOTHER_STORAGE_KEY = 'addingAnotherRegistration';

export function parseRegistrationIds(raw: unknown): string[] {
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
    .filter(
      (id): id is string | number =>
        (typeof id === 'string' && id.length > 0) || typeof id === 'number'
    )
    .map(id => String(id));
}
