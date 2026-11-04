import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles } from '../auth/auth.decorators';
import { LeaveType, PublicHoliday, Role } from '../entities';
import { SettingsService } from '../settings/settings.service';

export class UpdateConfigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minNoticeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamOffPerDay?: number;
}

export class LeaveTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(0)
  yearlyAllowance: number;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearlyAllowance?: number;
}

export class HolidayDto {
  @IsDateString({ strict: true })
  date: string;

  @IsString()
  @MinLength(1)
  name: string;
}

/** Read-only reference data any logged-in user needs for the request form and calendar. */
@Controller()
export class ReferenceController {
  constructor(
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(PublicHoliday) private readonly holidays: Repository<PublicHoliday>,
  ) {}

  @Get('leave-types')
  listTypes() {
    return this.types.find({ order: { id: 'ASC' } });
  }

  @Get('holidays')
  listHolidays() {
    return this.holidays.find({ order: { date: 'ASC' } });
  }
}

/** Everything under /admin is admin-only. */
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly settings: SettingsService,
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(PublicHoliday) private readonly holidays: Repository<PublicHoliday>,
  ) {}

  @Get('config')
  getConfig() {
    return this.settings.getAll();
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateConfigDto) {
    if (dto.minNoticeDays !== undefined) await this.settings.set('minNoticeDays', dto.minNoticeDays);
    if (dto.maxTeamOffPerDay !== undefined) await this.settings.set('maxTeamOffPerDay', dto.maxTeamOffPerDay);
    return this.settings.getAll();
  }

  @Post('leave-types')
  createType(@Body() dto: LeaveTypeDto) {
    return this.types.save(dto);
  }

  @Patch('leave-types/:id')
  async updateType(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeaveTypeDto) {
    const type = await this.types.findOneBy({ id });
    if (!type) throw new NotFoundException('Leave type not found');
    return this.types.save({ ...type, ...dto });
  }

  @Post('holidays')
  createHoliday(@Body() dto: HolidayDto) {
    return this.holidays.save(dto);
  }

  @Delete('holidays/:id')
  async deleteHoliday(@Param('id', ParseIntPipe) id: number) {
    const res = await this.holidays.delete({ id });
    if (!res.affected) throw new NotFoundException('Holiday not found');
    return { deleted: true };
  }
}
