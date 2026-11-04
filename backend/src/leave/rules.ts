import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeaveStatus } from '../entities';
import { daysBetween } from './date.utils';

export interface RequestSlice {
  id?: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
}

/** Pending and approved requests hold days; rejected and cancelled ones do not. */
export function isActive(r: Pick<RequestSlice, 'status'>): boolean {
  return r.status === LeaveStatus.PENDING || r.status === LeaveStatus.APPROVED;
}

export function validateDates(start: string, end: string): void {
  if (end < start) {
    throw new BadRequestException('End date cannot be before start date');
  }
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    throw new BadRequestException(
      'A request cannot span two calendar years; submit one request per year',
    );
  }
}

export function checkNotice(start: string, today: string, minNoticeDays: number): void {
  if (daysBetween(today, start) < minNoticeDays) {
    throw new BadRequestException(
      `Leave must be requested at least ${minNoticeDays} day(s) in advance`,
    );
  }
}

export function checkHasWorkingDays(days: number): void {
  if (days <= 0) {
    throw new BadRequestException(
      'The selected range contains no working days (weekends and public holidays are excluded)',
    );
  }
}

/** Days already held by this employee for one leave type in one year (pending + approved). */
export function usedDays(requests: RequestSlice[]): number {
  return requests.filter(isActive).reduce((sum, r) => sum + r.days, 0);
}

export function remainingBalance(allowance: number, requests: RequestSlice[]): number {
  return allowance - usedDays(requests);
}

export function checkBalance(allowance: number, existing: RequestSlice[], requested: number): void {
  const remaining = remainingBalance(allowance, existing);
  if (requested > remaining) {
    throw new ConflictException(
      `Insufficient balance: ${requested} day(s) requested, ${remaining} remaining`,
    );
  }
}

/** An employee cannot hold two active requests whose date ranges intersect. */
export function checkSelfOverlap(
  existing: RequestSlice[],
  start: string,
  end: string,
  ignoreId?: number,
): void {
  const clash = existing.find(
    (r) => isActive(r) && r.id !== ignoreId && r.startDate <= end && r.endDate >= start,
  );
  if (clash) {
    throw new ConflictException(
      `Overlaps your existing request (${clash.startDate} to ${clash.endDate})`,
    );
  }
}

/**
 * No more than `maxOff` team members may be off on the same working day.
 * `teamRequests` are the other members' requests; the new employee counts as one more.
 */
export function checkCoverage(
  teamRequests: RequestSlice[],
  requestedWorkingDays: string[],
  employeeId: number,
  maxOff: number,
): void {
  const others = teamRequests.filter((r) => isActive(r) && r.employeeId !== employeeId);
  for (const day of requestedWorkingDays) {
    const off = new Set(
      others.filter((r) => r.startDate <= day && r.endDate >= day).map((r) => r.employeeId),
    );
    if (off.size + 1 > maxOff) {
      throw new ConflictException(
        `Team coverage limit reached on ${day}: ${off.size} teammate(s) already off (max ${maxOff})`,
      );
    }
  }
}
