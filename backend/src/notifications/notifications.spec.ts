import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LeaveRequest, LeaveStatus, Role, User } from '../entities';
import { cancelledMail, decisionMail, newRequestMail } from './mail.templates';
import { NotificationsService } from './notifications.service';

const manager = { id: 1, name: 'Maria Manager', email: 'maria@company.test', role: Role.MANAGER } as User;
const employee = { id: 2, name: 'Liam Employee', email: 'liam@company.test', role: Role.EMPLOYEE, manager } as User;
const request = {
  id: 7,
  startDate: '2026-12-14',
  endDate: '2026-12-18',
  days: 5,
  reason: 'Year end break',
  status: LeaveStatus.PENDING,
  leaveType: { id: 1, name: 'Annual' },
  employee,
} as LeaveRequest;

describe('mail templates', () => {
  it('sends the new request to the manager with the key details', () => {
    const mail = newRequestMail(request, employee, manager);
    expect(mail.to).toBe('maria@company.test');
    expect(mail.subject).toContain('Liam Employee');
    expect(mail.text).toContain('5 working day(s)');
    expect(mail.text).toContain('Year end break');
  });

  it('sends the decision to the employee', () => {
    expect(decisionMail(request, employee, true).subject).toContain('approved');
    expect(decisionMail(request, employee, false).subject).toContain('rejected');
    expect(decisionMail(request, employee, true).to).toBe('liam@company.test');
  });

  it('tells the manager when leave is cancelled', () => {
    const mail = cancelledMail(request, employee, manager);
    expect(mail.to).toBe('maria@company.test');
    expect(mail.subject).toContain('cancelled');
  });
});

describe('NotificationsService', () => {
  const ds = {
    getRepository: () => ({ findOne: async () => request }),
  } as unknown as DataSource;
  const config = { get: (_k: string, d?: string) => d } as unknown as ConfigService; // no SMTP_HOST

  it('does nothing when SMTP is not configured', async () => {
    const service = new NotificationsService(ds, config);
    await expect(service.requestCreated(7)).resolves.toBeUndefined();
  });

  it('sends the new-request email to the manager', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const service = new NotificationsService(ds, config);
    service.useTransport({ sendMail });
    await service.requestCreated(7);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe('maria@company.test');
  });

  it('never throws when the mail server is down', async () => {
    const service = new NotificationsService(ds, config);
    service.useTransport({ sendMail: vi.fn().mockRejectedValue(new Error('connection refused')) });
    await expect(service.requestDecided(7, true)).resolves.toBeUndefined();
  });
});
