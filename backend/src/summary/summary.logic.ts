import { eachDate, isWeekend, toDate } from '../leave/date.utils';

export interface AvailabilityEntry {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
}

const fmt = (iso: string) =>
  toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const span = (e: AvailabilityEntry) =>
  e.startDate === e.endDate ? fmt(e.startDate) : `${fmt(e.startDate)} to ${fmt(e.endDate)}`;

/** Working day with the most people off, or null when nobody is off. */
export function busiestDay(entries: AvailabilityEntry[], from: string, to: string) {
  let best: { date: string; count: number } | null = null;
  for (const date of eachDate(from, to)) {
    if (isWeekend(date)) continue;
    const people = new Set(
      entries.filter((e) => e.startDate <= date && e.endDate >= date).map((e) => e.employeeName),
    );
    if (people.size > 0 && (!best || people.size > best.count)) best = { date, count: people.size };
  }
  return best;
}

/** Deterministic summary used when no AI key is set or the AI call fails. */
export function templateSummary(entries: AvailabilityEntry[], from: string, to: string): string {
  const window = `${fmt(from)} to ${fmt(to)}`; // used after "from"
  if (entries.length === 0) {
    return `Everyone on the team is available from ${window}.`;
  }
  const people = [...new Set(entries.map((e) => e.employeeName))];
  const lines = entries.map(
    (e) => `${e.employeeName} is off ${span(e)} (${e.leaveType.toLowerCase()}${e.status === 'pending' ? ', awaiting approval' : ''}).`,
  );
  const busy = busiestDay(entries, from, to);
  const tail = busy && busy.count > 1 ? ` Busiest day: ${fmt(busy.date)} with ${busy.count} people off.` : '';
  return `From ${window}, ${people.length} team member${people.length === 1 ? ' is' : 's are'} off. ${lines.join(' ')}${tail}`;
}

/** Only names, dates and leave type are sent to the AI. Reasons are never included. */
export function buildPrompt(entries: AvailabilityEntry[], from: string, to: string): string {
  const rows = entries.map(
    (e) => `- ${e.employeeName}: ${e.startDate} to ${e.endDate} (${e.leaveType}, ${e.status})`,
  );
  return [
    `Write a short, plain-language summary (2 to 4 sentences) of team availability from ${from} to ${to}.`,
    'Mention who is away and when, flag any day with several people off, and note anything still pending approval.',
    'Use only the data below. Do not invent names or dates.',
    '',
    rows.length ? rows.join('\n') : '(nobody is on leave in this period)',
  ].join('\n');
}
