/**
 * Format an age range string based on ageMin and ageMax values.
 * @param ageMin - The minimum age (optional)
 * @param ageMax - The maximum age (optional, can be 'adult')
 * @returns A formatted age range string
 */
export function formatAgeRange(
  ageMin?: number,
  ageMax?: number | 'adult'
): string {
  if (ageMin === undefined && ageMax === undefined) {
    return 'all ages';
  }
  if (ageMin === undefined && ageMax !== undefined) {
    return `up to ${ageMax}`;
  }
  if (ageMin !== undefined && ageMax === undefined) {
    return `${ageMin} and up`;
  }
  return `${ageMin}-${ageMax}`;
}
