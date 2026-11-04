import { LeaveRequest, User } from '../entities';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

const range = (r: Pick<LeaveRequest, 'startDate' | 'endDate'>) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} to ${r.endDate}`;

/** To the manager when an employee submits a request. */
export function newRequestMail(req: LeaveRequest, employee: User, manager: User): Mail {
  return {
    to: manager.email,
    subject: `Leave request from ${employee.name}: ${range(req)}`,
    text: [
      `Hi ${manager.name},`,
      '',
      `${employee.name} has requested ${req.days} working day(s) of ${req.leaveType?.name ?? 'leave'}.`,
      `Dates: ${range(req)}`,
      `Reason: ${req.reason}`,
      '',
      'Please review it in the Leave Manager approvals page.',
    ].join('\n'),
  };
}

/** To the employee when a manager approves or rejects. */
export function decisionMail(req: LeaveRequest, employee: User, approved: boolean): Mail {
  const verb = approved ? 'approved' : 'rejected';
  return {
    to: employee.email,
    subject: `Your leave request was ${verb}: ${range(req)}`,
    text: [
      `Hi ${employee.name},`,
      '',
      `Your ${req.leaveType?.name ?? 'leave'} request for ${range(req)} (${req.days} working day(s)) was ${verb}.`,
      approved ? '' : 'The days remain available in your balance.',
    ].join('\n'),
  };
}

/** To the manager when an employee cancels, so they know the cover has changed. */
export function cancelledMail(req: LeaveRequest, employee: User, manager: User): Mail {
  return {
    to: manager.email,
    subject: `${employee.name} cancelled leave: ${range(req)}`,
    text: [
      `Hi ${manager.name},`,
      '',
      `${employee.name} cancelled their ${req.leaveType?.name ?? 'leave'} request for ${range(req)} (${req.days} working day(s)).`,
    ].join('\n'),
  };
}
