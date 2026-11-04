import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  // A team is the set of users who share the same manager.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  manager: User | null;

  @Column({ nullable: true })
  managerId: number | null;
}
