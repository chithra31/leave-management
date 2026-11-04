import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeaveStatus } from '../entities';
import {
  checkBalance,
  checkCoverage,
  checkHasWorkingDays,
  checkNotice,
  checkSelfOverlap,
  remainingBalance,
  RequestSlice,
  usedDays,
  validateDates,
} from './rules';

const req = (over: Partial<RequestSlice>): RequestSlice => ({
  id: 1,
  employeeId: 1,
  startDate: '2026-11-09',
  endDate: '2026-11-13',
  days: 5,
  status: LeaveStatus.APPROVED,
  ...over,
});

describe('date validation', () => {
  it('rejects an end date before the start date', () => {
    expect(() => validateDates('2026-11-10', '2026-11-09')).toThrow(BadRequestException);
  });

  it('accepts a same-day request', () => {
    expect(() => validateDates('2026-11-10', '2026-11-10')).not.toThrow();
  });

  it('rejects a range spanning two calendar years', () => {
    expect(() => validateDates('2026-12-30', '2027-01-02')).toThrow(BadRequestException);
  });

  it('rejects a range with no working days', () => {
    expect(() => checkHasWorkingDays(0)).toThrow(BadRequestException);
  });
});

describe('minimum notice', () => {
  it('rejects a request with too little notice', () => {
    expect(() => checkNotice('2026-11-05', '2026-11-04', 3)).toThrow(BadRequestException);
  });

  it('accepts a request with exactly the required notice', () => {
    expect(() => checkNotice('2026-11-07', '2026-11-04', 3)).not.toThrow();
  });

  it('changing the configured value changes the outcome with no code change', () => {
    expect(() => checkNotice('2026-11-06', '2026-11-04', 1)).not.toThrow();
    expect(() => checkNotice('2026-11-06', '2026-11-04', 5)).toThrow(BadRequestException);
  });
});

describe('balance rule', () => {
  it('rejects a request larger than the remaining balance', () => {
    expect(() => checkBalance(10, [req({ days: 8 })], 3)).toThrow(ConflictException);
  });

  it('allows a request that uses the balance exactly', () => {
    expect(() => checkBalance(10, [req({ days: 8 })], 2)).not.toThrow();
  });

  it('counts pending requests against the balance', () => {
    const pending = req({ days: 8, status: LeaveStatus.PENDING });
    expect(remainingBalance(10, [pending])).toBe(2);
    expect(() => checkBalance(10, [pending], 3)).toThrow(ConflictException);
  });

  it('ignores rejected requests', () => {
    expect(usedDays([req({ days: 8, status: LeaveStatus.REJECTED })])).toBe(0);
  });

  it('restores the balance when an approved request is cancelled', () => {
    const request = req({ days: 6, status: LeaveStatus.APPROVED });
    expect(remainingBalance(10, [request])).toBe(4);
    request.status = LeaveStatus.CANCELLED;
    expect(remainingBalance(10, [request])).toBe(10);
  });

  it('restores the balance when a pending request is cancelled', () => {
    const request = req({ days: 3, status: LeaveStatus.PENDING });
    request.status = LeaveStatus.CANCELLED;
    expect(() => checkBalance(10, [request], 10)).not.toThrow();
  });

  it('uses the new allowance when the admin changes it', () => {
    const existing = [req({ days: 8 })];
    expect(() => checkBalance(10, existing, 5)).toThrow(ConflictException);
    expect(() => checkBalance(15, existing, 5)).not.toThrow();
  });
});

describe('self overlap rule', () => {
  const existing = [req({ startDate: '2026-11-09', endDate: '2026-11-13' })];

  it('rejects a partly overlapping request', () => {
    expect(() => checkSelfOverlap(existing, '2026-11-12', '2026-11-16')).toThrow(ConflictException);
  });

  it('rejects overlap on a single shared boundary day', () => {
    expect(() => checkSelfOverlap(existing, '2026-11-13', '2026-11-20')).toThrow(ConflictException);
  });

  it('allows a request on the next day', () => {
    expect(() => checkSelfOverlap(existing, '2026-11-14', '2026-11-20')).not.toThrow();
  });

  it('ignores cancelled and rejected requests', () => {
    const dead = [req({ status: LeaveStatus.CANCELLED }), req({ id: 2, status: LeaveStatus.REJECTED })];
    expect(() => checkSelfOverlap(dead, '2026-11-09', '2026-11-13')).not.toThrow();
  });
});

describe('team coverage rule', () => {
  const day = ['2026-11-10'];
  const mate = (id: number, status = LeaveStatus.APPROVED) =>
    req({ id, employeeId: id + 10, status, startDate: '2026-11-09', endDate: '2026-11-11' });

  it('rejects when the cap is already reached', () => {
    expect(() => checkCoverage([mate(1), mate(2)], day, 1, 2)).toThrow(ConflictException);
  });

  it('allows when there is room under the cap', () => {
    expect(() => checkCoverage([mate(1)], day, 1, 2)).not.toThrow();
  });

  it('counts pending teammates too', () => {
    expect(() => checkCoverage([mate(1), mate(2, LeaveStatus.PENDING)], day, 1, 2)).toThrow(ConflictException);
  });

  it('ignores cancelled teammates', () => {
    expect(() => checkCoverage([mate(1), mate(2, LeaveStatus.CANCELLED)], day, 1, 2)).not.toThrow();
  });

  it('counts a teammate once even with several requests on the same day', () => {
    const twice = [mate(1), { ...mate(1), id: 99 }];
    expect(() => checkCoverage(twice, day, 1, 2)).not.toThrow();
  });

  it('is not triggered on days where nobody is off', () => {
    expect(() => checkCoverage([mate(1), mate(2)], ['2026-11-16'], 1, 2)).not.toThrow();
  });

  it('respects a changed cap', () => {
    expect(() => checkCoverage([mate(1), mate(2)], day, 1, 3)).not.toThrow();
  });
});
