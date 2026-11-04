import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, LeaveRequest, Status, errorMessage } from '../core/api';

@Component({
  imports: [FormsModule],
  template: `
    <h1>Approvals</h1>
    <section class="card">
      <div class="toolbar">
        <h2>Requests from your team</h2>
        <label>Show
          <select [ngModel]="filter()" (ngModelChange)="setFilter($event)">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="">All</option>
          </select>
        </label>
      </div>
      @if (error()) { <p class="error">{{ error() }}</p> }
      @if (requests().length === 0) {
        <p class="muted">Nothing to show.</p>
      } @else {
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (r of requests(); track r.id) {
              <tr>
                <td>{{ r.employee?.name }}</td>
                <td>{{ r.leaveType?.name }}</td>
                <td>{{ r.startDate }} → {{ r.endDate }}</td>
                <td>{{ r.days }}</td>
                <td>{{ r.reason }}</td>
                <td><span class="badge" [class]="'badge ' + r.status">{{ r.status }}</span></td>
                <td class="actions">
                  @if (r.status === 'pending') {
                    <button class="good" (click)="decide(r, 'approve')">Approve</button>
                    <button class="danger" (click)="decide(r, 'reject')">Reject</button>
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
export class Approvals {
  private api = inject(Api);

  readonly requests = signal<LeaveRequest[]>([]);
  readonly filter = signal<Status | ''>('pending');
  readonly error = signal('');

  constructor() {
    this.load();
  }

  setFilter(value: Status | '') {
    this.filter.set(value);
    this.load();
  }

  load() {
    this.api.team(this.filter() || undefined).subscribe({
      next: (r) => this.requests.set(r),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  decide(r: LeaveRequest, action: 'approve' | 'reject') {
    this.error.set('');
    this.api.decide(r.id, action).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
