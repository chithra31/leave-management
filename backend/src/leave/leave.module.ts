import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { SummaryService } from '../summary/summary.service';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  controllers: [LeaveController],
  providers: [LeaveService, SettingsService, NotificationsService, SummaryService],
  exports: [LeaveService, SettingsService],
})
export class LeaveModule {}
