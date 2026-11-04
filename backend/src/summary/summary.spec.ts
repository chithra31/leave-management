import { AvailabilityEntry, buildPrompt, busiestDay, templateSummary } from './summary.logic';

const entry = (over: Partial<AvailabilityEntry>): AvailabilityEntry => ({
  employeeName: 'Noah Employee',
  leaveType: 'Annual',
  startDate: '2026-11-09',
  endDate: '2026-11-10',
  status: 'approved',
  ...over,
});

describe('availability summary', () => {
  it('says everyone is available when nobody is off', () => {
    expect(templateSummary([], '2026-11-09', '2026-11-20')).toContain('Everyone on the team is available');
  });

  it('names who is off and when', () => {
    const text = templateSummary([entry({})], '2026-11-09', '2026-11-20');
    expect(text).toContain('Noah Employee is off');
    expect(text).toContain('1 team member is off');
  });

  it('flags pending requests as awaiting approval', () => {
    const text = templateSummary([entry({ status: 'pending' })], '2026-11-09', '2026-11-20');
    expect(text).toContain('awaiting approval');
  });

  it('finds the busiest working day', () => {
    const entries = [entry({}), entry({ employeeName: 'Emma Employee', startDate: '2026-11-10', endDate: '2026-11-11' })];
    expect(busiestDay(entries, '2026-11-09', '2026-11-13')).toEqual({ date: '2026-11-10', count: 2 });
  });

  it('mentions the busiest day only when several people are off', () => {
    const one = templateSummary([entry({})], '2026-11-09', '2026-11-13');
    const two = templateSummary(
      [entry({}), entry({ employeeName: 'Emma Employee' })],
      '2026-11-09',
      '2026-11-13',
    );
    expect(one).not.toContain('Busiest day');
    expect(two).toContain('Busiest day');
  });

  it('never puts the leave reason in the AI prompt', () => {
    const prompt = buildPrompt([{ ...entry({}), reason: 'private medical matter' } as AvailabilityEntry], '2026-11-09', '2026-11-13');
    expect(prompt).toContain('Noah Employee');
    expect(prompt).not.toContain('private medical matter');
  });
});
