import { Temporal } from '@js-temporal/polyfill';
import type { CollectionEntry } from 'astro:content';
import {
  getActivitySlug,
  pairCurrentClassesWithUpcoming,
} from './preregistrationInvites';

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

describe('getActivitySlug', () => {
  it('uses the last path segment', () => {
    expect(getActivitySlug('2026/09/piano1b')).toBe('piano1b');
    expect(getActivitySlug('2026/08/piano1a')).toBe('piano1a');
  });

  it('lowercases and handles a bare slug', () => {
    expect(getActivitySlug('Piano1B')).toBe('piano1b');
    expect(getActivitySlug('piano1b')).toBe('piano1b');
  });
});

describe('pairCurrentClassesWithUpcoming', () => {
  const now = Temporal.ZonedDateTime.from(
    '2026-08-17T12:00:00[America/Louisville]'
  );

  const currentPiano1b = makeActivity('2026/08/piano1b', {
    name: 'Beginning Piano (5pm)',
    kind: 'class',
    startDate: '8/4/2026',
    startTime: '5:00pm',
    duration: '45m',
    repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
  });
  const upcomingPiano1b = makeActivity('2026/09/piano1b', {
    name: 'Beginning Piano (5pm)',
    kind: 'class',
    startDate: '9/15/2026',
    startTime: '5:00pm',
    duration: '45m',
    repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
    registrationOpens: '8/22/2026',
  });
  const currentPiano1a = makeActivity('2026/08/piano1a', {
    name: 'Beginning Piano (4pm)',
    kind: 'class',
    startDate: '8/4/2026',
    startTime: '4:00pm',
    duration: '45m',
    repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
  });
  const upcomingPiano1a = makeActivity('2026/09/piano1a', {
    name: 'Beginning Piano (4pm)',
    kind: 'class',
    startDate: '9/15/2026',
    startTime: '4:00pm',
    duration: '45m',
    repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
    registrationOpens: '8/22/2026',
  });

  it('pairs a current class with the next session of the same slug', () => {
    const pairs = pairCurrentClassesWithUpcoming(
      [currentPiano1b, upcomingPiano1b, currentPiano1a, upcomingPiano1a],
      now
    );

    expect(pairs).toHaveLength(2);
    expect(pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          current: expect.objectContaining({ id: '2026/08/piano1b' }),
          upcoming: expect.objectContaining({ id: '2026/09/piano1b' }),
        }),
        expect.objectContaining({
          current: expect.objectContaining({ id: '2026/08/piano1a' }),
          upcoming: expect.objectContaining({ id: '2026/09/piano1a' }),
        }),
      ])
    );
  });

  it('does not pair piano1a with piano1b', () => {
    const pairs = pairCurrentClassesWithUpcoming(
      [currentPiano1a, upcomingPiano1b],
      now
    );
    expect(pairs).toHaveLength(0);
  });

  it('picks the soonest upcoming session when several share a slug', () => {
    const laterPiano1b = makeActivity('2026/11/piano1b', {
      name: 'Beginning Piano (5pm)',
      kind: 'class',
      startDate: '11/10/2026',
      startTime: '5:00pm',
      duration: '45m',
      repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
    });

    const pairs = pairCurrentClassesWithUpcoming(
      [currentPiano1b, upcomingPiano1b, laterPiano1b],
      now
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.upcoming.id).toBe('2026/09/piano1b');
  });

  it('skips ended current classes and non-class activities', () => {
    const ended = makeActivity('2026/04/piano1b', {
      name: 'Beginning Piano (5pm)',
      kind: 'class',
      startDate: '4/1/2026',
      startTime: '5:00pm',
      duration: '45m',
      repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
    });
    const camp = makeActivity('2026/08/camppno', {
      name: 'Piano Camp',
      kind: 'camp',
      startDate: '8/4/2026',
      startTime: '10:00am',
      duration: '60',
      repeat: 'FREQ=DAILY;COUNT=5',
    });

    const pairs = pairCurrentClassesWithUpcoming(
      [ended, camp, upcomingPiano1b],
      now
    );
    expect(pairs).toHaveLength(0);
  });

  it('skips cancelled or closed upcoming classes', () => {
    const cancelledUpcoming = makeActivity('2026/09/piano1b', {
      name: 'Beginning Piano (5pm)',
      kind: 'class',
      startDate: '9/15/2026',
      startTime: '5:00pm',
      duration: '45m',
      repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
      status: 'cancelled',
    });
    const closedUpcoming = makeActivity('2026/09/piano1a', {
      name: 'Beginning Piano (4pm)',
      kind: 'class',
      startDate: '9/15/2026',
      startTime: '4:00pm',
      duration: '45m',
      repeat: 'FREQ=WEEKLY;BYDAY=TU;COUNT=6',
      registrationCloses: '8/1/2026',
    });

    expect(
      pairCurrentClassesWithUpcoming([currentPiano1b, cancelledUpcoming], now)
    ).toHaveLength(0);
    expect(
      pairCurrentClassesWithUpcoming([currentPiano1a, closedUpcoming], now)
    ).toHaveLength(0);
  });
});
