import { daysBetween, eachDate, isWeekend, workingDays } from './date.utils';

describe('date utils', () => {
  it('detects weekends', () => {
    expect(isWeekend('2026-11-07')).toBe(true); // Saturday
    expect(isWeekend('2026-11-08')).toBe(true); // Sunday
    expect(isWeekend('2026-11-09')).toBe(false); // Monday
  });

  it('lists every date inclusively', () => {
    expect(eachDate('2026-11-09', '2026-11-11')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('counts a Mon-Fri week as 5 working days', () => {
    expect(workingDays('2026-11-09', '2026-11-13', new Set())).toHaveLength(5);
  });

  it('skips weekends in a two-week range', () => {
    expect(workingDays('2026-11-09', '2026-11-22', new Set())).toHaveLength(10);
  });

  it('skips public holidays', () => {
    const holidays = new Set(['2026-11-11']);
    expect(workingDays('2026-11-09', '2026-11-13', holidays)).toHaveLength(4);
  });

  it('returns zero for a weekend-only range', () => {
    expect(workingDays('2026-11-07', '2026-11-08', new Set())).toHaveLength(0);
  });

  it('does not double-count a holiday that falls on a weekend', () => {
    const holidays = new Set(['2026-11-07']);
    expect(workingDays('2026-11-06', '2026-11-09', holidays)).toEqual(['2026-11-06', '2026-11-09']);
  });

  it('handles a single-day range', () => {
    expect(workingDays('2026-11-09', '2026-11-09', new Set())).toEqual(['2026-11-09']);
  });

  it('computes day differences across month ends', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
  });
});
