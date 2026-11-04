import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveType, PublicHoliday } from '../entities';
import { LeaveModule } from '../leave/leave.module';
import { AdminController, ReferenceController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, PublicHoliday]), LeaveModule],
  controllers: [AdminController, ReferenceController],
})
export class AdminModule {}
