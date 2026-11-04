import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('public_holidays')
export class PublicHoliday {
  @PrimaryGeneratedColumn()
  id: number;

  // ISO date string, YYYY-MM-DD.
  @Column({ type: 'date', unique: true })
  date: string;

  @Column()
  name: string;
}
