import { filterActiveSupporters, isSupporterActive } from './supporters';

const today = new Date(2026, 7, 27); // Aug 27, 2026

describe('isSupporterActive', () => {
  it('returns true when there is no expiration', () => {
    expect(isSupporterActive({}, today)).toBe(true);
  });

  it('returns true when expires is today', () => {
    expect(isSupporterActive({ expires: '8/27/2026' }, today)).toBe(true);
  });

  it('returns true when expires is in the future', () => {
    expect(isSupporterActive({ expires: '12/31/2026' }, today)).toBe(true);
  });

  it('returns false when expires is in the past', () => {
    expect(isSupporterActive({ expires: '8/26/2026' }, today)).toBe(false);
  });
});

describe('filterActiveSupporters', () => {
  it('keeps perpetual and not-yet-expired supporters', () => {
    const filtered = filterActiveSupporters(
      [
        { id: 'forever', name: 'Always' },
        { id: 'today', name: 'Today', expires: '8/27/2026' },
        { id: 'past', name: 'Past', expires: '1/1/2026' },
        { id: 'future', name: 'Future', expires: '9/1/2026' },
      ],
      today
    );

    expect(filtered.map(s => s.id)).toEqual(['forever', 'today', 'future']);
  });
});
