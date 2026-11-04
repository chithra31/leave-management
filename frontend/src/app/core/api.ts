import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export const API_URL = 'http://localhost:3000';

export type Role = 'employee' | 'manager' | 'admin';
export type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  managerId: number | null;
}

export interface Balance {
  leaveTypeId: number;
  leaveType: string;
  allowance: number;
  approved: number;
  pending: number;
  remaining: number;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: Status;
  leaveType?: { id: number; name: string };
  employee?: { id: number; name: string };
}

export interface CalendarEntry {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: Status;
}

export interface AvailabilitySummary {
  from: string;
  to: string;
  summary: string;
  source: 'ai' | 'template';
}

export interface LeaveType {
  id: number;
  name: string;
  yearlyAllowance: number;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface Config {
  minNoticeDays: number;
  maxTeamOffPerDay: number;
}

export interface NewLeave {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

/** Pull the server's message out of an HTTP error so the UI can show it. */
export function errorMessage(err: unknown): string {
  const body = (err as { error?: { message?: string | string[] } })?.error;
  const msg = body?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  return msg ?? 'Something went wrong. Is the API running?';
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string; user: User }>(`${API_URL}/auth/login`, { email, password });
  }

  balance(year: number) {
    return this.http.get<Balance[]>(`${API_URL}/leave-requests/balance`, { params: { year } });
  }
  mine() {
    return this.http.get<LeaveRequest[]>(`${API_URL}/leave-requests/mine`);
  }
  create(body: NewLeave) {
    return this.http.post<LeaveRequest>(`${API_URL}/leave-requests`, body);
  }
  cancel(id: number) {
    return this.http.patch<LeaveRequest>(`${API_URL}/leave-requests/${id}/cancel`, {});
  }
  team(status?: Status) {
    return this.http.get<LeaveRequest[]>(`${API_URL}/leave-requests/team`, { params: status ? { status } : {} });
  }
  decide(id: number, action: 'approve' | 'reject') {
    return this.http.patch<LeaveRequest>(`${API_URL}/leave-requests/${id}/${action}`, {});
  }
  summary() {
    return this.http.get<AvailabilitySummary>(`${API_URL}/leave-requests/summary`);
  }
  calendar(from: string, to: string) {
    return this.http.get<CalendarEntry[]>(`${API_URL}/leave-requests/calendar`, { params: { from, to } });
  }

  leaveTypes() {
    return this.http.get<LeaveType[]>(`${API_URL}/leave-types`);
  }
  holidays() {
    return this.http.get<Holiday[]>(`${API_URL}/holidays`);
  }

  config() {
    return this.http.get<Config>(`${API_URL}/admin/config`);
  }
  saveConfig(c: Config) {
    return this.http.put<Config>(`${API_URL}/admin/config`, c);
  }
  saveLeaveType(id: number, yearlyAllowance: number) {
    return this.http.patch<LeaveType>(`${API_URL}/admin/leave-types/${id}`, { yearlyAllowance });
  }
  addHoliday(date: string, name: string) {
    return this.http.post<Holiday>(`${API_URL}/admin/holidays`, { date, name });
  }
  deleteHoliday(id: number) {
    return this.http.delete(`${API_URL}/admin/holidays/${id}`);
  }
}
