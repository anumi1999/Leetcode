import { parseDate, monthsBetween } from '../../main/transformer/parsers/dateParser';

describe('dateParser', () => {
  describe('parseDate', () => {
    it('passes through already-ISO dates unchanged', () => {
      expect(parseDate('2021-11-12')).toBe('2021-11-12');
    });

    it('parses DD-MM-YYYY format', () => {
      expect(parseDate('10-11-2002')).toBe('2002-11-10');
      expect(parseDate('20-06-2006')).toBe('2006-06-20');
    });

    it('parses DD-Month-YYYY format', () => {
      expect(parseDate('15-July-2001')).toBe('2001-07-15');
      expect(parseDate('01-October-2005')).toBe('2005-10-01');
      expect(parseDate('11-March-2021')).toBe('2021-03-11');
      expect(parseDate('12-September-2005')).toBe('2005-09-12');
    });

    it('pads single-digit day and month', () => {
      expect(parseDate('1-1-2020')).toBe('2020-01-01');
    });

    it('returns empty string for empty input', () => {
      expect(parseDate('')).toBe('');
    });

    it('passes through unrecognised formats as-is', () => {
      expect(parseDate('unknown-date')).toBe('unknown-date');
    });
  });

  describe('monthsBetween', () => {
    it('calculates months correctly', () => {
      expect(monthsBetween('2002-11-10', '2006-06-12')).toBe(43);
    });

    it('returns 0 for invalid dates', () => {
      expect(monthsBetween('', 'bad')).toBe(0);
    });

    it('returns 0 when start equals end', () => {
      expect(monthsBetween('2020-01-01', '2020-01-01')).toBe(0);
    });
  });
});
