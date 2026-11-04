import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeaveStatus } from './leave-status.enum';
import { LeaveType } from './leave-type.entity';
import { User } from './user.entity';

@Entity('leave_requests')
@Index(['employeeId', 'startDate', 'endDate'])
export class LeaveRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  employee: User;

  @Column()
  employeeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  leaveType: LeaveType;

  @Column()
  leaveTypeId: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  // Working days counted (weekends and public holidays excluded), stored at request time.
  @Column({ type: 'int' })
  days: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  decidedBy: User | null;

  @Column({ nullable: true })
  decidedById: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
