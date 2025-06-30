import { normalizeDuration, shortDescription } from './datelib';

describe('datelib', () => {
  describe('normalizeDuration', () => {
    describe('number inputs (minutes)', () => {
      it('should normalize single digit minutes', () => {
        expect(normalizeDuration('5')).toBe('PT5M');
      });

      it('should normalize double digit minutes', () => {
        expect(normalizeDuration('30')).toBe('PT30M');
      });

      it('should normalize large minute values', () => {
        expect(normalizeDuration('120')).toBe('PT120M');
      });
    });

    describe('clock time inputs (HH:MM)', () => {
      it('should normalize hours and minutes', () => {
        expect(normalizeDuration('1:30')).toBe('PT1H30M');
      });

      it('should normalize single digit hours', () => {
        expect(normalizeDuration('0:45')).toBe('PT0H45M');
      });

      it('should normalize double digit hours', () => {
        expect(normalizeDuration('12:15')).toBe('PT12H15M');
      });
    });

    describe('day inputs', () => {
      it('should normalize single day', () => {
        expect(normalizeDuration('1D')).toBe('P1D');
      });

      it('should normalize multiple days', () => {
        expect(normalizeDuration('5D')).toBe('P5D');
      });

      it('should normalize with P prefix', () => {
        expect(normalizeDuration('P2D')).toBe('P2D');
      });
    });

    describe('week inputs', () => {
      it('should normalize single week', () => {
        expect(normalizeDuration('1W')).toBe('P1W');
      });

      it('should normalize multiple weeks', () => {
        expect(normalizeDuration('3W')).toBe('P3W');
      });

      it('should normalize with P prefix', () => {
        expect(normalizeDuration('P1W')).toBe('P1W');
      });
    });

    describe('complex duration inputs', () => {
      it('should normalize week and day', () => {
        expect(normalizeDuration('1W1D')).toBe('P1W1D');
      });

      it('should normalize week, day and hours', () => {
        expect(normalizeDuration('1W1DT10H')).toBe('P1W1DT10H');
      });

      it('should normalize day and hours', () => {
        expect(normalizeDuration('1DT10H')).toBe('P1DT10H');
      });

      it('should normalize hours and minutes', () => {
        expect(normalizeDuration('2H30M')).toBe('PT2H30M');
      });

      it('should normalize hours, minutes and seconds', () => {
        expect(normalizeDuration('1H30M45S')).toBe('PT1H30M45S');
      });

      it('should normalize minutes and seconds', () => {
        expect(normalizeDuration('30M15S')).toBe('PT30M15S');
      });

      it('should normalize seconds only', () => {
        expect(normalizeDuration('45S')).toBe('PT45S');
      });
    });

    describe('already normalized inputs', () => {
      it('should preserve already normalized durations', () => {
        expect(normalizeDuration('P2DT4H')).toBe('P2DT4H');
      });

      it('should preserve complex normalized durations', () => {
        expect(normalizeDuration('P1W1DT2H30M')).toBe('P1W1DT2H30M');
      });
    });

    describe('error cases', () => {
      it('should throw error for invalid duration', () => {
        expect(() => normalizeDuration('invalid')).toThrow(
          'Invalid duration: invalid'
        );
      });

      it('should throw error for malformed duration', () => {
        expect(() => normalizeDuration('1X')).toThrow('Invalid duration: 1X');
      });

      it('should throw error for empty string', () => {
        expect(() => normalizeDuration('')).toThrow('Invalid duration: ');
      });
    });
  });

  describe('shortDescription', () => {
    describe('weekly events', () => {
      it('should describe weekly event with byDay', () => {
        const dtstart = '20240111T190000';
        const rrule = 'FREQ=WEEKLY;BYDAY=TH';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every Thursday starting January 11');
      });

      it('should describe weekly event with multiple byDay', () => {
        const dtstart = '20240111T190000';
        const rrule = 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=5';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe(
          'every Monday, Wednesday and Friday starting January 12'
        );
      });

      it('should describe weekly event without byDay (derived from start date)', () => {
        const dtstart = '20250114T190000'; // Jan 14, 2025 is a Tuesday
        const rrule = 'FREQ=WEEKLY';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every Tuesday starting January 14');
      });

      it('should describe weekly Sunday event without byDay (derived from start date)', () => {
        const dtstart = '20250323T190000'; // Mar 23, 2025 is a Sunday
        const rrule = 'FREQ=WEEKLY';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every Sunday starting March 23');
      });
    });

    describe('non-weekly events', () => {
      it('should return rrule text for daily events', () => {
        const dtstart = '20240111T190000';
        const rrule = 'FREQ=DAILY;COUNT=5';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every day for 5 times'); // Default description is OK for now.
      });

      it('should return rrule text for monthly events', () => {
        const dtstart = '20240111T190000';
        const rrule = 'FREQ=MONTHLY;BYMONTHDAY=11';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every month on the 11th day of the month');
      });

      it('should return rrule text for yearly events', () => {
        const dtstart = '20240111T190000';
        const rrule = 'FREQ=YEARLY';

        const result = shortDescription(dtstart, undefined, undefined, rrule);

        expect(result).toBe('every year');
      });
    });

    describe('with duration and end date', () => {
      it('should handle events with duration', () => {
        const dtstart = '20240111T190000';
        const dtend = '20240111T200000';
        const duration = '1H';
        const rrule = 'FREQ=WEEKLY;BYDAY=TH';

        const result = shortDescription(dtstart, dtend, duration, rrule);

        expect(result).toBe('every Thursday starting January 11');
      });

      it('should handle events with end date only', () => {
        const dtstart = '20240111T190000';
        const dtend = '20240111T200000';
        const rrule = 'FREQ=WEEKLY;BYDAY=TH';

        const result = shortDescription(dtstart, dtend, undefined, rrule);

        expect(result).toBe('every Thursday starting January 11');
      });
    });

    describe('day name mapping', () => {
      const testCases = [
        { byDay: 'MO', expected: 'Monday' },
        { byDay: 'TU', expected: 'Tuesday' },
        { byDay: 'WE', expected: 'Wednesday' },
        { byDay: 'TH', expected: 'Thursday' },
        { byDay: 'FR', expected: 'Friday' },
        { byDay: 'SA', expected: 'Saturday' },
        { byDay: 'SU', expected: 'Sunday' },
      ];

      testCases.forEach(({ byDay, expected }) => {
        it(`should map ${byDay} to ${expected}`, () => {
          const dtstart = '20240111T190000';
          const rrule = `FREQ=WEEKLY;BYDAY=${byDay}`;

          const result = shortDescription(dtstart, undefined, undefined, rrule);

          expect(result).toContain(`every ${expected}`);
        });
      });
    });

    describe('date derivation from start date', () => {
      const testCases = [
        { date: '20240108T190000', expected: 'Monday' }, // Jan 8, 2024
        { date: '20240109T190000', expected: 'Tuesday' }, // Jan 9, 2024
        { date: '20240110T190000', expected: 'Wednesday' }, // Jan 10, 2024
        { date: '20240111T190000', expected: 'Thursday' }, // Jan 11, 2024
        { date: '20240112T190000', expected: 'Friday' }, // Jan 12, 2024
        { date: '20240113T190000', expected: 'Saturday' }, // Jan 13, 2024
        { date: '20240114T190000', expected: 'Sunday' }, // Jan 14, 2024
      ];

      testCases.forEach(({ date, expected }) => {
        it(`should derive ${expected} from ${date}`, () => {
          const rrule = 'FREQ=WEEKLY';

          const result = shortDescription(date, undefined, undefined, rrule);

          expect(result).toContain(`every ${expected}`);
        });
      });
    });
  });
});
