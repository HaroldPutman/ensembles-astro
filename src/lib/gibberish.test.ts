import {
  gibberishScore,
  hasEnglishWords,
  isSpamContactSubmission,
  isSpamMessage,
  isSpamName,
} from './gibberish';

describe('gibberish', () => {
  describe('hasEnglishWords', () => {
    it('detects common English words', () => {
      expect(hasEnglishWords('I have a question about classes')).toBe(true);
    });

    it('returns false for random character strings', () => {
      expect(hasEnglishWords('yHyodyeVcxpMbLlCxQlfgN')).toBe(false);
    });
  });

  describe('isSpamMessage', () => {
    it('flags high gibberish scores', () => {
      expect(isSpamMessage('yHyodyeVcxpMbLlCxQlfgN')).toBe(true);
    });

    it('flags long text without English words', () => {
      expect(isSpamMessage('xqzwplmknjhbgvfcdrsxqwzplmknjhbgvfcdrsx')).toBe(
        true
      );
    });

    it('allows normal messages', () => {
      expect(
        isSpamMessage('Hi, I would like more information about piano lessons.')
      ).toBe(false);
    });

    it('allows short non-English-looking text', () => {
      expect(isSpamMessage('OK thanks')).toBe(false);
    });
  });

  describe('isSpamName', () => {
    it('flags extreme gibberish names', () => {
      expect(isSpamName('yHyodyeVcxpMbLlCxQlfgN')).toBe(true);
    });

    it('allows normal names', () => {
      expect(isSpamName('Jane Smith')).toBe(false);
      expect(isSpamName('Nguyen')).toBe(false);
      expect(isSpamName('Bartholomew')).toBe(false);
    });

    it('allows long two-part names', () => {
      expect(isSpamName('Christopher Montgomery')).toBe(false);
    });
  });

  describe('isSpamContactSubmission', () => {
    it('flags spam from either field', () => {
      expect(
        isSpamContactSubmission(
          'Jane Smith',
          'yHyodyeVcxpMbLlCxQlfgN yHyodyeVcxpMbLlCxQlfgN'
        )
      ).toBe(true);
      expect(
        isSpamContactSubmission('yHyodyeVcxpMbLlCxQlfgN', 'Hello there')
      ).toBe(true);
    });

    it('allows legitimate submissions', () => {
      expect(
        isSpamContactSubmission(
          'Jane Smith',
          'Could you tell me more about summer theater classes?'
        )
      ).toBe(false);
    });
  });

  describe('gibberishScore', () => {
    it('scores random strings higher than normal text', () => {
      expect(gibberishScore('yHyodyeVcxpMbLlCxQlfgN')).toBeGreaterThanOrEqual(
        4
      );
      expect(
        gibberishScore('Thanks for the information about classes.')
      ).toBeLessThan(4);
    });
  });
});
