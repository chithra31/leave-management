import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PublicHoliday,
  Role,
  Setting,
  User,
} from './entities';
import { addDays, workingDays } from './leave/date.utils';
import {
  checkBalance,
  checkCoverage,
  checkSelfOverlap,
  RequestSlice,
} from './leave/rules';

const DEV_PASSWORD = 'Password123!';
const TODAY = '2026-11-04';

const HOLIDAYS: [string, string][] = [
  ['2026-01-01', "New Year's Day"],
  ['2026-04-03', 'Good Friday'],
  ['2026-05-01', 'Labour Day'],
  ['2026-08-15', 'Independence Day'],
  ['2026-11-26', 'Thanksgiving'],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-26', 'Boxing Day'],
];

const REASONS = [
  'Family trip',
  'Medical appointment',
  'Personal errand',
  'Wedding to attend',
  'Rest and recovery',
  'Moving house',
  'Visiting relatives',
  'Study leave',
];

// Small deterministic generator so every seed run produces the same data.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}


async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);

  await ds.query(
    'TRUNCATE leave_requests, settings, public_holidays, leave_types, users RESTART IDENTITY CASCADE',
  );

  const hash = await bcrypt.hash(DEV_PASSWORD, 10);
  const users = ds.getRepository(User);

  await users.save({ name: 'Alice Admin', email: 'admin@company.test', passwordHash: hash, role: Role.ADMIN });
  const managers = await users.save([
    { name: 'Maria Manager', email: 'maria@company.test', passwordHash: hash, role: Role.MANAGER },
    { name: 'James Manager', email: 'james@company.test', passwordHash: hash, role: Role.MANAGER },
  ]);
  const employeeNames = ['Liam', 'Olivia', 'Noah', 'Emma', 'Ava', 'Lucas', 'Mia', 'Ethan'];
  const employees = await users.save(
    employeeNames.map((n, i) => ({
      name: `${n} Employee`,
      email: `${n.toLowerCase()}@company.test`,
      passwordHash: hash,
      role: Role.EMPLOYEE,
      managerId: managers[i < 4 ? 0 : 1].id,
    })),
  );

  const types = await ds.getRepository(LeaveType).save([
    { name: 'Annual', yearlyAllowance: 20 },
    { name: 'Sick', yearlyAllowance: 10 },
    { name: 'Unpaid', yearlyAllowance: 30 },
  ]);

  await ds.getRepository(PublicHoliday).save(HOLIDAYS.map(([date, name]) => ({ date, name })));
  await ds.getRepository(Setting).save([
    { key: 'minNoticeDays', value: '2' },
    { key: 'maxTeamOffPerDay', value: '2' },
  ]);

  const holidays = new Set(HOLIDAYS.map(([d]) => d));
  const maxOff = 2;
  const rand = rng(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  // Target mix for the 40 requests.
  const statuses: LeaveStatus[] = [
    ...Array(10).fill(LeaveStatus.PENDING),
    ...Array(18).fill(LeaveStatus.APPROVED),
    ...Array(6).fill(LeaveStatus.REJECTED),
    ...Array(6).fill(LeaveStatus.CANCELLED),
  ];

  const made: (RequestSlice & { leaveTypeId: number; reason: string })[] = [];
  const toSave: Partial<LeaveRequest>[] = [];
  let attempts = 0;

  for (const status of statuses) {
    while (attempts++ < 5000) {
      const employee = pick(employees);
      const type = pick(types);
      // Pending requests must be in the future; the rest can be anywhere in the year.
      const startOffset = status === LeaveStatus.PENDING ? 10 + Math.floor(rand() * 50) : Math.floor(rand() * 340) - 300;
      const start = addDays(TODAY, startOffset);
      const end = addDays(start, Math.floor(rand() * 5));
      if (start.slice(0, 4) !== '2026' || end.slice(0, 4) !== '2026') continue;
      const days = workingDays(start, end, holidays);
      if (days.length === 0) continue;

      try {
        const sameType = made.filter((r) => r.employeeId === employee.id && r.leaveTypeId === type.id);
        checkBalance(type.yearlyAllowance, sameType, days.length);
        checkSelfOverlap(made.filter((r) => r.employeeId === employee.id), start, end);
        const teamIds = employees.filter((e) => e.managerId === employee.managerId).map((e) => e.id);
        checkCoverage(
          made.filter((r) => teamIds.includes(r.employeeId)),
          days,
          employee.id,
          maxOff,
        );
      } catch {
        continue;
      }

      const reason = pick(REASONS);
      made.push({ employeeId: employee.id, leaveTypeId: type.id, startDate: start, endDate: end, days: days.length, status, reason });
      toSave.push({
        employeeId: employee.id,
        leaveTypeId: type.id,
        startDate: start,
        endDate: end,
        days: days.length,
        reason,
        status,
        decidedById:
          status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED ? employee.managerId : null,
        decidedAt: status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED ? new Date(`${TODAY}T09:00:00Z`) : null,
      });
      break;
    }
  }

  await ds.getRepository(LeaveRequest).save(toSave);

  const count = await ds.getRepository(LeaveRequest).count();
  console.log(`Seeded: 1 admin, 2 managers, 8 employees, 3 leave types, ${HOLIDAYS.length} holidays, ${count} requests`);
  console.log(`All seeded users share the dev password: ${DEV_PASSWORD}`);
  await app.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
