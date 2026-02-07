import {
  makeICalDate,
  makeICalTime,
  makeICalDuration,
  shortDescription,
  makeICalRRule,
  getFirstAndLastDates,
} from './datelib';

describe('datelib', () => {
  describe('makeICalDuration', () => {
    describe('number inputs (minutes)', () => {
      it('should normalize single digit minutes', () => {
        expect(makeICalDuration('5')).toBe('PT5M');
      });

      it('should normalize double digit minutes', () => {
        expect(makeICalDuration('30')).toBe('PT30M');
      });

      it('should normalize large minute values', () => {
        expect(makeICalDuration('120')).toBe('PT120M');
      });
    });

    describe('clock time inputs (HH:MM)', () => {
      it('should normalize hours and minutes', () => {
        expect(makeICalDuration('1:30')).toBe('PT1H30M');
      });

      it('should normalize single digit hours', () => {
        expect(makeICalDuration('0:45')).toBe('PT0H45M');
      });

      it('should normalize double digit hours', () => {
        expect(makeICalDuration('12:15')).toBe('PT12H15M');
      });
    });

    describe('day inputs', () => {
      it('should normalize single day', () => {
        expect(makeICalDuration('1D')).toBe('P1D');
      });

      it('should normalize multiple days', () => {
        expect(makeICalDuration('5D')).toBe('P5D');
      });

      it('should normalize with P prefix', () => {
        expect(makeICalDuration('P2D')).toBe('P2D');
      });
    });

    describe('week inputs', () => {
      it('should normalize single week', () => {
        expect(makeICalDuration('1W')).toBe('P1W');
      });

      it('should normalize multiple weeks', () => {
        expect(makeICalDuration('3W')).toBe('P3W');
      });

      it('should normalize with P prefix', () => {
        expect(makeICalDuration('P1W')).toBe('P1W');
      });
    });

    describe('complex duration inputs', () => {
      it('should normalize week and day', () => {
        expect(makeICalDuration('1W1D')).toBe('P1W1D');
      });

      it('should normalize week, day and hours', () => {
        expect(makeICalDuration('1W1DT10H')).toBe('P1W1DT10H');
      });

      it('should normalize day and hours', () => {
        expect(makeICalDuration('1DT10H')).toBe('P1DT10H');
      });

      it('should normalize hours and minutes', () => {
        expect(makeICalDuration('2H30M')).toBe('PT2H30M');
      });

      it('should normalize hours, minutes and seconds', () => {
        expect(makeICalDuration('1H30M45S')).toBe('PT1H30M45S');
      });

      it('should normalize minutes and seconds', () => {
        expect(makeICalDuration('30M15S')).toBe('PT30M15S');
      });

      it('should normalize seconds only', () => {
        expect(makeICalDuration('45S')).toBe('PT45S');
      });
    });

    describe('already normalized inputs', () => {
      it('should preserve already normalized durations', () => {
        expect(makeICalDuration('P2DT4H')).toBe('P2DT4H');
      });

      it('should preserve complex normalized durations', () => {
        expect(makeICalDuration('P1W1DT2H30M')).toBe('P1W1DT2H30M');
      });
    });

    describe('error cases', () => {
      it('should throw error for invalid duration', () => {
        expect(() => makeICalDuration('invalid')).toThrow(
          'Invalid duration: invalid'
        );
      });

      it('should throw error for malformed duration', () => {
        expect(() => makeICalDuration('1X')).toThrow('Invalid duration: 1X');
      });

      it('should throw error for empty string', () => {
        expect(() => makeICalDuration('')).toThrow('Invalid duration: ');
      });
    });
  });

  describe('makeICalTime', () => {
    it('should make a time string in the format of HH:MM:SS', () => {
      expect(makeICalTime('9:30')).toBe('093000');
    });
    it('should make a time string in the format of HH:MM:SS with PM', () => {
      expect(makeICalTime('9:30 PM')).toBe('213000');
    });
    it('should make a time string in the format of HH:MM:SS with AM', () => {
      expect(makeICalTime('9:30 AM')).toBe('093000');
    });
    it('should make a time string in the format of HH:MM:SS with 12:00 PM', () => {
      expect(makeICalTime('12:00 PM')).toBe('120000');
    });
    it('should convert 12:00 AM to midnight (000000)', () => {
      expect(makeICalTime('12:00 AM')).toBe('000000');
    });
    it('should convert 12:30 PM to noon (123000)', () => {
      expect(makeICalTime('12:30 PM')).toBe('123000');
    });
  });

  describe('makeICalDate', () => {
    it('should make a date string in the format of YYYYMMDD', () => {
      expect(makeICalDate('1/1/2025')).toBe('20250101');
      expect(makeICalDate('1/12/2025')).toBe('20250112');
      expect(makeICalDate('12/1/2025')).toBe('20251201');
    });
  });

  describe('makeICalRRule', () => {
    it('should leave a good RRule string alone', () => {
      expect(makeICalRRule('FREQ=WEEKLY;BYDAY=TH', '093000')).toBe(
        'FREQ=WEEKLY;BYDAY=TH'
      );
    });
    it('should convert a date in mm/dd/yyyy format to yyyymmdd', () => {
      expect(
        makeICalRRule('FREQ=WEEKLY;BYDAY=TH;EXDATE=1/14/2025', '093000')
      ).toBe(
        'FREQ=WEEKLY;BYDAY=TH\nEXDATE;TZID=America/Louisville:20250114T093000'
      );
    });

    describe('RDATE handling', () => {
      it('should convert RDATE with single date using event start time', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;RDATE=3/15/2026', '14:00:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH\nRDATE;TZID=America/Louisville:20260315T14:00:00'
        );
      });

      it('should convert RDATE with single date and custom time', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;RDATE=3/15/2026@10:30', '14:00:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH\nRDATE;TZID=America/Louisville:20260315T10:30:00'
        );
      });

      it('should convert RDATE with multiple dates', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;RDATE=3/15/2026,3/22/2026', '14:00:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH\nRDATE;TZID=America/Louisville:20260315T14:00:00,20260322T14:00:00'
        );
      });

      it('should convert RDATE with mixed dates (some with times, some without)', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;RDATE=3/15/2026@10:30,3/22/2026', '14:00:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH\nRDATE;TZID=America/Louisville:20260315T10:30:00,20260322T14:00:00'
        );
      });

      it('should handle RDATE at end of string without trailing semicolon', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;COUNT=6;RDATE=4/1/2026', '09:30:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH;COUNT=6\nRDATE;TZID=America/Louisville:20260401T09:30:00'
        );
      });

      it('should handle both EXDATE and RDATE together', () => {
        expect(
          makeICalRRule('FREQ=WEEKLY;BYDAY=TH;EXDATE=3/19/2026;RDATE=4/1/2026', '14:00:00')
        ).toBe(
          'FREQ=WEEKLY;BYDAY=TH\nEXDATE;TZID=America/Louisville:20260319T14:00:00\nRDATE;TZID=America/Louisville:20260401T14:00:00'
        );
      });
    });
  });

  describe('shortDescription', () => {
    it('should return a short description of a 6 week class', () => {
      expect(
        shortDescription(
          '11/3/2025',
          '12:30',
          '1h',
          'FREQ=WEEKLY;BYDAY=MO;COUNT=6;EXDATE=11/24/2025'
        )
      ).toBe('Mondays 12:30 PM - 1:30 PM, Nov 3 - Dec 15');
    });
  });

  describe('getFirstAndLastDates', () => {
    describe('deviationNote values', () => {
      it('should return undefined when no EXDATE or RDATE', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6'
        );
        expect(deviationNote).toBeUndefined();
      });

      it('should return "Not meeting on {date}" for single EXDATE', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6;EXDATE=3/17/2026'
        );
        expect(deviationNote).toBe('Not meeting on Mar 17');
      });

      it('should return "Also meeting on {date}" for single RDATE', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6;RDATE=4/7/2026'
        );
        expect(deviationNote).toBe('Also meeting on Apr 7');
      });

      it('should return "With some exceptions." for multiple EXDATEs', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6;EXDATE=3/17/2026,3/24/2026'
        );
        expect(deviationNote).toBe('With some exceptions.');
      });

      it('should return "With some exceptions." for multiple RDATEs', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6;RDATE=4/7/2026,4/14/2026'
        );
        expect(deviationNote).toBe('With some exceptions.');
      });

      it('should return "With some exceptions." for combined EXDATE and RDATE', () => {
        const [, , , deviationNote] = getFirstAndLastDates(
          '2/24/2026',
          '10:00 AM',
          '45m',
          'FREQ=WEEKLY;BYDAY=TU;COUNT=6;EXDATE=3/17/2026;RDATE=4/7/2026'
        );
        expect(deviationNote).toBe('With some exceptions.');
      });
    });
  });
});
