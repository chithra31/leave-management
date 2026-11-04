// All dates are ISO strings (YYYY-MM-DD) handled in UTC, so server timezone never shifts a day.

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(iso: string): boolean {
  const day = toDate(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Every date from start to end, inclusive. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = toDate(start);
  const last = toDate(end);
  while (cur <= last) {
    out.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Days that count as leave: weekends and public holidays are skipped. */
export function workingDays(
  start: string,
  end: string,
  holidays: ReadonlySet<string>,
): string[] {
  return eachDate(start, end).filter((d) => !isWeekend(d) && !holidays.has(d));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function todayIso(): string {
  return toIso(new Date());
}
