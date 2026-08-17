import { Temporal } from '@js-temporal/polyfill';
import {
  cacheControlUntilNearestRegistrationOpens,
  isActivityEnded,
} from './activityStatus';

describe('isActivityEnded', () => {
  const base = {
    startDate: '8/6/2026',
    startTime: '10:00 am',
    duration: '60',
    repeat: 'FREQ=WEEKLY;COUNT=2',
  };

  it('is false during the final session (uses end time, not start)', () => {
    // Second weekly session starts 8/13/2026 10:00, ends 11:00
    const duringFinal = Temporal.ZonedDateTime.from(
      '2026-08-13T10:30:00[America/Louisville]'
    );
    expect(isActivityEnded(base, duringFinal)).toBe(false);
  });

  it('is true after the final session ends', () => {
    const afterFinal = Temporal.ZonedDateTime.from(
      '2026-08-13T11:00:01[America/Louisville]'
    );
    expect(isActivityEnded(base, afterFinal)).toBe(true);
  });

  it('uses a later additionalDates occurrence as the last session', () => {
    const withMakeup = {
      ...base,
      additionalDates: ['8/20/2026@2:00 pm+90'],
    };
    const beforeMakeupEnd = Temporal.ZonedDateTime.from(
      '2026-08-20T15:00:00[America/Louisville]'
    );
    const afterMakeupEnd = Temporal.ZonedDateTime.from(
      '2026-08-20T15:30:01[America/Louisville]'
    );
    expect(isActivityEnded(withMakeup, beforeMakeupEnd)).toBe(false);
    expect(isActivityEnded(withMakeup, afterMakeupEnd)).toBe(true);
  });

  it('treats open-ended schedules as not ended', () => {
    const openEnded = {
      ...base,
      repeat: 'FREQ=WEEKLY',
    };
    const farFuture = Temporal.ZonedDateTime.from(
      '2030-01-01T00:00:00[America/Louisville]'
    );
    expect(isActivityEnded(openEnded, farFuture)).toBe(false);
  });
});

describe('cacheControlUntilNearestRegistrationOpens', () => {
  it('uses the default max-age when nothing opens soon', () => {
    const farOpens = Temporal.ZonedDateTime.from(
      '2030-01-01T00:00:00[America/Louisville]'
    );
    expect(cacheControlUntilNearestRegistrationOpens([farOpens], 600)).toBe(
      'public, max-age=600, s-maxage=600'
    );
  });

  it('caps max-age to seconds until the next opens transition', () => {
    const opensSoon = Temporal.Now.zonedDateTimeISO('America/Louisville').add({
      seconds: 120,
    });
    const header = cacheControlUntilNearestRegistrationOpens([opensSoon], 600);
    const match = header.match(/^public, max-age=(\d+), s-maxage=(\d+)$/);
    expect(match).not.toBeNull();
    const maxAge = Number(match![1]);
    expect(maxAge).toBe(Number(match![2]));
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(120);
  });

  it('returns no-store when max-age would be zero or negative', () => {
    expect(cacheControlUntilNearestRegistrationOpens([], 0)).toBe(
      'private, no-store'
    );
  });

  it('returns no-store for immediate and sub-second openings', () => {
    const now = Temporal.Now.zonedDateTimeISO('America/Louisville');
    const immediate = now;
    const subSecond = now.add({ milliseconds: 500 });
    expect(cacheControlUntilNearestRegistrationOpens([immediate], 600)).toBe(
      'private, no-store'
    );
    expect(cacheControlUntilNearestRegistrationOpens([subSecond], 600)).toBe(
      'private, no-store'
    );
  });
});
