import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  // Days per calendar year. Admin-configurable.
  @Column({ type: 'int' })
  yearlyAllowance: number;
}
