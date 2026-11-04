import { Component, computed, inject, signal } from '@angular/core';
import { Api, AvailabilitySummary, CalendarEntry, Holiday } from '../core/api';

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
  weekend: boolean;
  holiday: string | null;
  entries: CalendarEntry[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

@Component({
  template: `
    <h1>Team calendar</h1>
    <section class="card">
      <h2>Availability, next 14 days
        @if (summary(); as s) {
          <span class="badge" [class.role]="s.source === 'ai'">{{ s.source === 'ai' ? 'AI summary' : 'Auto summary' }}</span>
        }
      </h2>
      @if (summary(); as s) {
        <p>{{ s.summary }}</p>
      } @else if (summaryFailed()) {
        <p class="muted">Summary unavailable right now.</p>
      } @else {
        <p class="muted">Writing summary…</p>
      }
    </section>
    <section class="card">
      <div class="toolbar">
        <button (click)="shift(-1)" aria-label="Previous month">‹</button>
        <h2>{{ title() }}</h2>
        <button (click)="shift(1)" aria-label="Next month">›</button>
      </div>
      <div class="cal">
        @for (d of dows; track d) { <div class="dow">{{ d }}</div> }
        @for (c of cells(); track c.iso) {
          <div class="day" [class.out]="!c.inMonth" [class.weekend]="c.weekend" [class.holiday]="c.holiday">
            <div class="num"><span>{{ c.day }}</span>@if (c.entries.length > 1) { <span class="muted">{{ c.entries.length }} off</span> }</div>
            @if (c.holiday) { <span class="muted">{{ c.holiday }}</span> }
            @for (e of c.entries; track e.id) {
              <span class="chip" [class.pending]="e.status === 'pending'" [title]="e.employeeName + ' - ' + e.leaveType + ' (' + e.status + ')'">{{ e.employeeName }}</span>
            }
          </div>
        }
      </div>
      <div class="legend">
        <span><i class="dot approved"></i>Approved</span>
        <span><i class="dot pending"></i>Pending</span>
        <span>Yellow day = public holiday</span>
      </div>
    </section>
  `,
})
export class TeamCalendar {
  private api = inject(Api);

  readonly dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly month = signal(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)));
  readonly entries = signal<CalendarEntry[]>([]);
  readonly holidays = signal<Holiday[]>([]);

  readonly title = computed(() =>
    this.month().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  );

  /** Whole weeks (Monday first) covering the month. */
  private range = computed(() => {
    const first = this.month();
    const offset = (first.getUTCDay() + 6) % 7;
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - offset);
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const end = new Date(last);
    end.setUTCDate(end.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
    return { start, end };
  });

  readonly cells = computed<Cell[]>(() => {
    const { start, end } = this.range();
    const month = this.month().getUTCMonth();
    const holidayByDate = new Map(this.holidays().map((h) => [h.date, h.name]));
    const out: Cell[] = [];
    for (const cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
      const key = iso(cur);
      const dow = cur.getUTCDay();
      out.push({
        iso: key,
        day: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === month,
        weekend: dow === 0 || dow === 6,
        holiday: holidayByDate.get(key) ?? null,
        entries: this.entries().filter((e) => e.startDate <= key && e.endDate >= key),
      });
    }
    return out;
  });

  readonly summary = signal<AvailabilitySummary | null>(null);
  readonly summaryFailed = signal(false);

  constructor() {
    this.api.summary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summaryFailed.set(true),
    });
    this.api.holidays().subscribe((h) => this.holidays.set(h));
    this.load();
  }

  shift(by: number) {
    const m = this.month();
    this.month.set(new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + by, 1)));
    this.load();
  }

  private load() {
    const { start, end } = this.range();
    this.api.calendar(iso(start), iso(end)).subscribe((e) => this.entries.set(e));
  }
}
