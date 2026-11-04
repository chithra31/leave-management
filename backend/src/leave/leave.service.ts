import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PublicHoliday,
  Role,
  User,
} from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { daysBetween, todayIso, workingDays } from './date.utils';
import {
  checkBalance,
  checkCoverage,
  checkHasWorkingDays,
  checkNotice,
  checkSelfOverlap,
  isActive,
  remainingBalance,
  validateDates,
} from './rules';

export interface Actor {
  id: number;
  role: Role;
}

export interface CreateLeaveInput {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

@Injectable()
export class LeaveService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(employeeId: number, input: CreateLeaveInput, today = todayIso()): Promise<LeaveRequest> {
    validateDates(input.startDate, input.endDate);

    const saved = await this.ds.transaction(async (em) => {
      const employee = await em.findOne(User, { where: { id: employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      // Lock the team's manager row so two simultaneous requests on one team are checked one at a time.
      await em.findOne(User, {
        where: { id: employee.managerId ?? employee.id },
        lock: { mode: 'pessimistic_write' },
      });

      const leaveType = await em.findOne(LeaveType, { where: { id: input.leaveTypeId } });
      if (!leaveType) throw new NotFoundException('Leave type not found');

      const holidayRows = await em.find(PublicHoliday, {
        where: { date: Between(input.startDate, input.endDate) },
      });
      const holidays = new Set(holidayRows.map((h) => h.date));
      const days = workingDays(input.startDate, input.endDate, holidays);
      checkHasWorkingDays(days.length);

      checkNotice(input.startDate, today, await this.settings.getNumber('minNoticeDays', em));

      const year = input.startDate.slice(0, 4);
      const sameTypeThisYear = await em.find(LeaveRequest, {
        where: {
          employeeId,
          leaveTypeId: leaveType.id,
          startDate: Between(`${year}-01-01`, `${year}-12-31`),
        },
      });
      checkBalance(leaveType.yearlyAllowance, sameTypeThisYear, days.length);

      const overlapping = await em.find(LeaveRequest, {
        where: {
          employeeId,
          startDate: LessThanOrEqual(input.endDate),
          endDate: MoreThanOrEqual(input.startDate),
        },
      });
      checkSelfOverlap(overlapping, input.startDate, input.endDate);

      if (employee.managerId) {
        const team = await em.find(User, { where: { managerId: employee.managerId } });
        const teamRequests = await em.find(LeaveRequest, {
          where: {
            employeeId: In(team.map((u) => u.id)),
            startDate: LessThanOrEqual(input.endDate),
            endDate: MoreThanOrEqual(input.startDate),
          },
        });
        const maxOff = await this.settings.getNumber('maxTeamOffPerDay', em);
        checkCoverage(teamRequests, days, employeeId, maxOff);
      }

      return em.save(
        em.create(LeaveRequest, {
          employeeId,
          leaveTypeId: leaveType.id,
          startDate: input.startDate,
          endDate: input.endDate,
          days: days.length,
          reason: input.reason,
          status: LeaveStatus.PENDING,
        }),
      );
    });
    void this.notifications.requestCreated(saved.id);
    return saved;
  }

  /** Cancelling frees the days: balances are computed from pending + approved only. */
  async cancel(requestId: number, actor: Actor, today = todayIso()): Promise<LeaveRequest> {
    const req = await this.mustFind(requestId);
    if (actor.role !== Role.ADMIN && req.employeeId !== actor.id) {
      throw new ForbiddenException('You can only cancel your own requests');
    }
    if (!isActive(req)) {
      throw new BadRequestException(`A ${req.status} request cannot be cancelled`);
    }
    if (req.status === LeaveStatus.APPROVED && daysBetween(today, req.startDate) < 0) {
      throw new BadRequestException('Leave that has already started cannot be cancelled');
    }
    req.status = LeaveStatus.CANCELLED;
    const saved = await this.ds.getRepository(LeaveRequest).save(req);
    if (actor.id === req.employeeId) void this.notifications.requestCancelled(saved.id);
    return saved;
  }

  async decide(requestId: number, actor: Actor, approve: boolean): Promise<LeaveRequest> {
    if (actor.role !== Role.MANAGER) {
      throw new ForbiddenException('Only managers can approve or reject requests');
    }
    const req = await this.mustFind(requestId);
    const employee = await this.ds.getRepository(User).findOneByOrFail({ id: req.employeeId });
    if (employee.managerId !== actor.id) {
      throw new ForbiddenException('You can only decide on requests from your own reports');
    }
    if (req.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Only pending requests can be decided (this one is ${req.status})`);
    }
    req.status = approve ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    req.decidedById = actor.id;
    req.decidedAt = new Date();
    const saved = await this.ds.getRepository(LeaveRequest).save(req);
    void this.notifications.requestDecided(saved.id, approve);
    return saved;
  }

  async balanceSummary(employeeId: number, year: number) {
    const types = await this.ds.getRepository(LeaveType).find({ order: { id: 'ASC' } });
    const requests = await this.ds.getRepository(LeaveRequest).find({
      where: { employeeId, startDate: Between(`${year}-01-01`, `${year}-12-31`) },
    });
    return types.map((t) => {
      const mine = requests.filter((r) => r.leaveTypeId === t.id);
      const sum = (s: LeaveStatus) => mine.filter((r) => r.status === s).reduce((n, r) => n + r.days, 0);
      return {
        leaveTypeId: t.id,
        leaveType: t.name,
        allowance: t.yearlyAllowance,
        approved: sum(LeaveStatus.APPROVED),
        pending: sum(LeaveStatus.PENDING),
        remaining: remainingBalance(t.yearlyAllowance, mine),
      };
    });
  }

  listMine(employeeId: number): Promise<LeaveRequest[]> {
    return this.ds.getRepository(LeaveRequest).find({
      where: { employeeId },
      relations: { leaveType: true },
      order: { startDate: 'DESC' },
    });
  }

  /** Requests from the manager's own reports, optionally filtered by status. */
  listForManager(managerId: number, status?: LeaveStatus): Promise<LeaveRequest[]> {
    return this.ds.getRepository(LeaveRequest).find({
      where: { employee: { managerId }, ...(status ? { status } : {}) },
      relations: { employee: true, leaveType: true },
      order: { startDate: 'ASC' },
    });
  }

  /** Active (pending + approved) leave overlapping the range, for the people the caller may see. */
  async calendar(actor: Actor, from: string, to: string) {
    const users = this.ds.getRepository(User);
    let scope: User[];
    if (actor.role === Role.ADMIN) {
      scope = await users.find();
    } else if (actor.role === Role.MANAGER) {
      scope = await users.find({ where: { managerId: actor.id } });
    } else {
      const me = await users.findOneByOrFail({ id: actor.id });
      scope = me.managerId ? await users.find({ where: { managerId: me.managerId } }) : [me];
    }
    const rows = await this.ds.getRepository(LeaveRequest).find({
      where: {
        employeeId: In(scope.map((u) => u.id)),
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        startDate: LessThanOrEqual(to),
        endDate: MoreThanOrEqual(from),
      },
      relations: { employee: true, leaveType: true },
      order: { startDate: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      leaveType: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      status: r.status,
    }));
  }

  private async mustFind(id: number): Promise<LeaveRequest> {
    const req = await this.ds.getRepository(LeaveRequest).findOne({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    return req;
  }
}
