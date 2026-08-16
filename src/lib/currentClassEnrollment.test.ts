import { Temporal } from '@js-temporal/polyfill';
import { studentHasMatchingCurrentClassEnrollment } from './currentClassEnrollment';
import type { CollectionEntry } from 'astro:content';

function makeActivity(
  id: string,
  data: Partial<CollectionEntry<'activities'>['data']> & {
    kind: CollectionEntry<'activities'>['data']['kind'];
    startDate: string;
    startTime: string;
    duration: string;
    name?: string;
  }
): CollectionEntry<'activities'> {
  return {
    id,
    collection: 'activities',
    data: {
      name: data.name ?? id,
      instructors: [],
      repeat: '',
      additionalDates: [],
      registration: true,
      ...data,
    },
  } as CollectionEntry<'activities'>;
}

describe('studentHasMatchingCurrentClassEnrollment', () => {
  it('returns false with no paid registrations', () => {
    expect(studentHasMatchingCurrentClassEnrollment([], [], 'Guitar 1')).toBe(
      false
    );
  });

  it('requires a paid, non-ended class with the same name', () => {
    // 8/1/2026 weekly × 8 ends on 9/19/2026; keep "now" before that final session.
    const now = Temporal.ZonedDateTime.from(
      '2026-08-15T12:00:00[America/Louisville]'
    );

    const currentGuitar = makeActivity('2026/08/guitar1', {
      name: 'Guitar 1',
      kind: 'class',
      startDate: '8/1/2026',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=WEEKLY;COUNT=8',
    });
    const currentPiano = makeActivity('2026/08/piano', {
      name: 'Piano 2/3',
      kind: 'class',
      startDate: '8/1/2026',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=WEEKLY;COUNT=8',
    });
    const endedGuitar = makeActivity('2025/01/guitar1', {
      name: 'Guitar 1',
      kind: 'class',
      startDate: '1/1/2020',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=WEEKLY;COUNT=2',
    });
    const camp = makeActivity('2026/06/camp', {
      name: 'Guitar 1',
      kind: 'camp',
      startDate: '6/1/2026',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=DAILY;COUNT=5',
    });

    expect(
      studentHasMatchingCurrentClassEnrollment(
        ['2026/08/guitar1'],
        [currentGuitar, currentPiano],
        'Guitar 1',
        now
      )
    ).toBe(true);

    expect(
      studentHasMatchingCurrentClassEnrollment(
        ['2026/08/guitar1'],
        [currentGuitar, currentPiano],
        'guitar 1',
        now
      )
    ).toBe(true);

    expect(
      studentHasMatchingCurrentClassEnrollment(
        ['2026/08/guitar1'],
        [currentGuitar, currentPiano],
        'Piano 2/3',
        now
      )
    ).toBe(false);

    expect(
      studentHasMatchingCurrentClassEnrollment(
        ['2025/01/guitar1'],
        [endedGuitar],
        'Guitar 1',
        now
      )
    ).toBe(false);

    expect(
      studentHasMatchingCurrentClassEnrollment(
        ['2026/06/camp'],
        [camp],
        'Guitar 1',
        now
      )
    ).toBe(false);
  });
});
