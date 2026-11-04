import { Body, Controller, Get, ParseIntPipe, Param, Patch, Post, Query } from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { LeaveStatus, Role } from '../entities';
import { SummaryService } from '../summary/summary.service';
import { addDays, todayIso } from './date.utils';
import { LeaveService } from './leave.service';

export class CreateLeaveDto {
  @IsInt()
  @Type(() => Number)
  leaveTypeId: number;

  @IsDateString({ strict: true })
  startDate: string;

  @IsDateString({ strict: true })
  endDate: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class CalendarQuery {
  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;
}

export class SummaryQuery {
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class ListQuery {
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}

@Controller('leave-requests')
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly summary: SummaryService,
  ) {}

  @Roles(Role.EMPLOYEE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveDto) {
    return this.leave.create(user.id, dto);
  }

  @Roles(Role.EMPLOYEE)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.leave.listMine(user.id);
  }

  @Roles(Role.EMPLOYEE)
  @Get('balance')
  balance(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.leave.balanceSummary(user.id, Number(year) || new Date().getUTCFullYear());
  }

  /** The manager's approval queue: requests from their own reports only. */
  @Roles(Role.MANAGER)
  @Get('team')
  team(@CurrentUser() user: AuthUser, @Query() q: ListQuery) {
    return this.leave.listForManager(user.id, q.status);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query() q: CalendarQuery) {
    return this.leave.calendar(user, q.from, q.to);
  }

  /** Plain-language availability for the caller's team. Defaults to the next 14 days. */
  @Get('summary')
  availability(@CurrentUser() user: AuthUser, @Query() q: SummaryQuery) {
    const from = q.from ?? todayIso();
    const to = q.to ?? addDays(from, 13);
    return this.summary.availability(user, from, to);
  }

  @Roles(Role.MANAGER)
  @Patch(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leave.decide(id, user, true);
  }

  @Roles(Role.MANAGER)
  @Patch(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leave.decide(id, user, false);
  }

  @Roles(Role.EMPLOYEE, Role.ADMIN)
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leave.cancel(id, user);
  }
}
