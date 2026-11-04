import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Config, Holiday, LeaveType, errorMessage } from '../core/api';

@Component({
  imports: [FormsModule],
  template: `
    <h1>Settings</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (info()) { <p class="success">{{ info() }}</p> }

    <div class="grid two">
      <section class="card">
        <h2>Leave rules</h2>
        <p class="muted">Changes apply to the next request immediately; no restart or code change needed.</p>
        <label>Minimum notice (days before the start date)
          <input type="number" min="0" [(ngModel)]="config.minNoticeDays" name="notice" />
        </label>
        <label>Max team members off on the same day
          <input type="number" min="1" [(ngModel)]="config.maxTeamOffPerDay" name="cap" />
        </label>
        <button class="primary" (click)="saveConfig()">Save rules</button>
      </section>

      <section class="card">
        <h2>Yearly allowance by leave type</h2>
        @for (t of types(); track t.id) {
          <label>{{ t.name }} (days per year)
            <div class="row">
              <input type="number" min="0" [(ngModel)]="t.yearlyAllowance" [name]="'type' + t.id" />
              <button (click)="saveType(t)">Save</button>
            </div>
          </label>
        }
      </section>
    </div>

    <section class="card">
      <h2>Public holidays</h2>
      <p class="muted">Holidays are not counted as leave days.</p>
      <div class="row">
        <label>Date <input type="date" [(ngModel)]="newHoliday.date" name="hdate" /></label>
        <label>Name <input type="text" [(ngModel)]="newHoliday.name" name="hname" /></label>
      </div>
      <button (click)="addHoliday()">Add holiday</button>
      <table>
        <thead><tr><th>Date</th><th>Name</th><th></th></tr></thead>
        <tbody>
          @for (h of holidays(); track h.id) {
            <tr>
              <td>{{ h.date }}</td>
              <td>{{ h.name }}</td>
              <td class="actions"><button class="danger" (click)="removeHoliday(h)">Remove</button></td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class Admin {
  private api = inject(Api);

  config: Config = { minNoticeDays: 0, maxTeamOffPerDay: 1 };
  newHoliday = { date: '', name: '' };
  readonly types = signal<LeaveType[]>([]);
  readonly holidays = signal<Holiday[]>([]);
  readonly error = signal('');
  readonly info = signal('');

  constructor() {
    this.api.config().subscribe((c) => (this.config = c));
    this.api.leaveTypes().subscribe((t) => this.types.set(t));
    this.loadHolidays();
  }

  private ok(msg: string) {
    this.error.set('');
    this.info.set(msg);
  }
  private fail(e: unknown) {
    this.info.set('');
    this.error.set(errorMessage(e));
  }

  saveConfig() {
    this.api.saveConfig(this.config).subscribe({
      next: (c) => {
        this.config = c;
        this.ok('Rules saved.');
      },
      error: (e) => this.fail(e),
    });
  }

  saveType(t: LeaveType) {
    this.api.saveLeaveType(t.id, Number(t.yearlyAllowance)).subscribe({
      next: () => this.ok(`${t.name} allowance saved.`),
      error: (e) => this.fail(e),
    });
  }

  private loadHolidays() {
    this.api.holidays().subscribe((h) => this.holidays.set(h));
  }

  addHoliday() {
    this.api.addHoliday(this.newHoliday.date, this.newHoliday.name).subscribe({
      next: () => {
        this.newHoliday = { date: '', name: '' };
        this.ok('Holiday added.');
        this.loadHolidays();
      },
      error: (e) => this.fail(e),
    });
  }

  removeHoliday(h: Holiday) {
    this.api.deleteHoliday(h.id).subscribe({
      next: () => {
        this.ok('Holiday removed.');
        this.loadHolidays();
      },
      error: (e) => this.fail(e),
    });
  }
}
