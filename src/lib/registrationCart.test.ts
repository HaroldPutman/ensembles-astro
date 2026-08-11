import {
  ADDING_ANOTHER_STORAGE_KEY,
  REGISTRATIONS_STORAGE_KEY,
  parseRegistrationIds,
} from './registrationCart';

describe('registrationCart', () => {
  it('exports stable sessionStorage keys', () => {
    expect(REGISTRATIONS_STORAGE_KEY).toBe('registrations');
    expect(ADDING_ANOTHER_STORAGE_KEY).toBe('addingAnotherRegistration');
  });

  it('parses registration id arrays from JSON strings', () => {
    expect(parseRegistrationIds('["1","2"]')).toEqual(['1', '2']);
    expect(parseRegistrationIds([3, '4'])).toEqual(['3', '4']);
  });

  it('returns an empty array for invalid input', () => {
    expect(parseRegistrationIds('')).toEqual([]);
    expect(parseRegistrationIds('not-json')).toEqual([]);
    expect(parseRegistrationIds(null)).toEqual([]);
    expect(parseRegistrationIds({ id: 1 })).toEqual([]);
  });
});
