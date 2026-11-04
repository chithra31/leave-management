import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Balance, Holiday, LeaveRequest, LeaveType, errorMessage } from '../core/api';

@Component({
  imports: [FormsModule],
  template: `
    <h1>My leave</h1>

    <div class="grid two">
      <section class="card">
        <h2>Balance {{ year }}</h2>
        <div class="bars">
          @for (b of balances(); track b.leaveTypeId) {
            <div>
              <div class="bar-head">
                <strong>{{ b.leaveType }}</strong>
                <span>{{ b.remaining }} of {{ b.allowance }} days left</span>
              </div>
              <div class="bar" role="img" [attr.aria-label]="b.leaveType + ': ' + b.approved + ' approved, ' + b.pending + ' pending'">
                <div class="seg approved" [style.width.%]="pct(b.approved, b.allowance)"></div>
                <div class="seg pending" [style.width.%]="pct(b.pending, b.allowance)"></div>
              </div>
            </div>
          }
        </div>
        <div class="legend">
          <span><i class="dot approved"></i>Approved</span>
          <span><i class="dot pending"></i>Pending</span>
          <span><i class="dot"></i>Remaining</span>
        </div>
      </section>

      <section class="card">
        <h2>Request leave</h2>
        <form (ngSubmit)="submit()">
          <label>Leave type
            <select name="type" [(ngModel)]="form.leaveTypeId" required>
              @for (t of types(); track t.id) {
                <option [ngValue]="t.id">{{ t.name }}</option>
              }
            </select>
          </label>
          <div class="row">
            <label>Start date <input name="start" type="date" [(ngModel)]="form.startDate" required /></label>
            <label>End date <input name="end" type="date" [(ngModel)]="form.endDate" required /></label>
          </div>
          @if (estimateDays() !== null) {
            <p class="muted">This will use about <strong>{{ estimateDays() }}</strong> working day(s). Weekends and public holidays are not counted.</p>
          }
          <label>Reason <textarea name="reason" rows="2" [(ngModel)]="form.reason" required minlength="3"></textarea></label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (info()) { <p class="success">{{ info() }}</p> }
          <button class="primary" type="submit" [disabled]="busy()">Submit request</button>
        </form>
      </section>
    </div>

    <section class="card">
      <h2>My requests</h2>
      @if (requests().length === 0) {
        <p class="muted">No requests yet.</p>
      } @else {
        <table>
          <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (r of requests(); track r.id) {
              <tr>
                <td>{{ r.leaveType?.name }}</td>
                <td>{{ r.startDate }} → {{ r.endDate }}</td>
                <td>{{ r.days }}</td>
                <td>{{ r.reason }}</td>
                <td><span class="badge" [class]="'badge ' + r.status">{{ r.status }}</span></td>
                <td class="actions">
                  @if (r.status === 'pending' || r.status === 'approved') {
                    <button class="danger" (click)="cancel(r)">Cancel</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class MyLeave {
  private api = inject(Api);

  readonly year = new Date().getFullYear();
  readonly balances = signal<Balance[]>([]);
  readonly requests = signal<LeaveRequest[]>([]);
  readonly types = signal<LeaveType[]>([]);
  readonly holidays = signal<Set<string>>(new Set());
  readonly error = signal('');
  readonly info = signal('');
  readonly busy = signal(false);

  form = { leaveTypeId: 1, startDate: '', endDate: '', reason: '' };

  constructor() {
    this.api.leaveTypes().subscribe((t) => {
      this.types.set(t);
      if (t.length) this.form.leaveTypeId = t[0].id;
    });
    this.api.holidays().subscribe((h: Holiday[]) => this.holidays.set(new Set(h.map((x) => x.date))));
    this.reload();
  }

  /** Display-only preview. The server is the source of truth and recounts on submit. */
  estimateDays(): number | null {
    const { startDate, endDate } = this.form;
    if (!startDate || !endDate || endDate < startDate) return null;
    let n = 0;
    const cur = new Date(`${startDate}T00:00:00Z`);
    const last = new Date(`${endDate}T00:00:00Z`);
    while (cur <= last) {
      const dow = cur.getUTCDay();
      if (dow !== 0 && dow !== 6 && !this.holidays().has(cur.toISOString().slice(0, 10))) n++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return n;
  }

  pct(days: number, allowance: number): number {
    return allowance > 0 ? Math.min(100, (days / allowance) * 100) : 0;
  }

  reload() {
    this.api.balance(this.year).subscribe((b) => this.balances.set(b));
    this.api.mine().subscribe((r) => this.requests.set(r));
  }

  submit() {
    this.error.set('');
    this.info.set('');
    this.busy.set(true);
    this.api.create(this.form).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.info.set(`Request submitted for ${r.days} working day(s). It is pending approval.`);
        this.form = { ...this.form, startDate: '', endDate: '', reason: '' };
        this.reload();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  cancel(r: LeaveRequest) {
    this.error.set('');
    this.info.set('');
    this.api.cancel(r.id).subscribe({
      next: () => {
        this.info.set(`Request cancelled. ${r.days} day(s) returned to your balance.`);
        this.reload();
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
