import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { DataSource } from 'typeorm';
import { LeaveRequest } from '../entities';
import { Mail, cancelledMail, decisionMail, newRequestMail } from './mail.templates';

export interface MailTransport {
  sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

/**
 * Sends email about leave requests. Email is a side effect: a failure is logged and
 * swallowed so it can never block or roll back the leave request itself.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private transport: MailTransport | null;
  private readonly from: string;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    config: ConfigService,
  ) {
    this.from = config.get('MAIL_FROM', 'Leave Manager <no-reply@company.test>');
    const host = config.get<string>('SMTP_HOST');
    this.transport = host
      ? nodemailer.createTransport({ host, port: Number(config.get('SMTP_PORT', 1025)), secure: false })
      : null;
    if (!this.transport) this.log.warn('SMTP_HOST not set: email notifications are disabled');
  }

  /** Lets tests (or another provider) replace the SMTP transport. */
  useTransport(transport: MailTransport | null) {
    this.transport = transport;
  }

  async requestCreated(requestId: number): Promise<void> {
    await this.run(requestId, (req) =>
      req.employee.manager ? [newRequestMail(req, req.employee, req.employee.manager)] : [],
    );
  }

  async requestDecided(requestId: number, approved: boolean): Promise<void> {
    await this.run(requestId, (req) => [decisionMail(req, req.employee, approved)]);
  }

  async requestCancelled(requestId: number): Promise<void> {
    await this.run(requestId, (req) =>
      req.employee.manager ? [cancelledMail(req, req.employee, req.employee.manager)] : [],
    );
  }

  private async run(requestId: number, build: (req: LeaveRequest) => Mail[]) {
    if (!this.transport) return;
    try {
      const req = await this.ds.getRepository(LeaveRequest).findOne({
        where: { id: requestId },
        relations: { employee: { manager: true }, leaveType: true },
      });
      if (!req) return;
      for (const mail of build(req)) {
        await this.transport.sendMail({ from: this.from, ...mail });
      }
    } catch (err) {
      this.log.warn(`Email for request ${requestId} not sent: ${(err as Error).message}`);
    }
  }
}
