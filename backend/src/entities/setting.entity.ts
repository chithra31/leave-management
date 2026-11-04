import { Column, Entity, PrimaryColumn } from 'typeorm';

// Admin-configurable key/value rules, e.g. minNoticeDays, maxTeamOffPerDay.
@Entity('settings')
export class Setting {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;
}
