import { studentHasCurrentClassEnrollment } from './currentClassEnrollment';
import type { CollectionEntry } from 'astro:content';

function makeActivity(
  id: string,
  data: Partial<CollectionEntry<'activities'>['data']> & {
    kind: CollectionEntry<'activities'>['data']['kind'];
    startDate: string;
    startTime: string;
    duration: string;
  }
): CollectionEntry<'activities'> {
  return {
    id,
    collection: 'activities',
    data: {
      name: id,
      instructors: [],
      repeat: '',
      additionalDates: [],
      registration: true,
      ...data,
    },
  } as CollectionEntry<'activities'>;
}

describe('studentHasCurrentClassEnrollment', () => {
  it('returns false with no paid registrations', () => {
    expect(studentHasCurrentClassEnrollment([], [])).toBe(false);
  });

  it('requires a paid class that has not ended', () => {
    const currentClass = makeActivity('2026/08/piano', {
      kind: 'class',
      startDate: '8/1/2026',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=WEEKLY;COUNT=8',
    });
    const endedClass = makeActivity('2025/01/art', {
      kind: 'class',
      startDate: '1/1/2020',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=WEEKLY;COUNT=2',
    });
    const camp = makeActivity('2026/06/camp', {
      kind: 'camp',
      startDate: '6/1/2026',
      startTime: '10:00 am',
      duration: '60',
      repeat: 'FREQ=DAILY;COUNT=5',
    });

    expect(
      studentHasCurrentClassEnrollment(['2026/08/piano'], [currentClass])
    ).toBe(true);
    expect(
      studentHasCurrentClassEnrollment(['2025/01/art'], [endedClass])
    ).toBe(false);
    expect(studentHasCurrentClassEnrollment(['2026/06/camp'], [camp])).toBe(
      false
    );
  });
});
