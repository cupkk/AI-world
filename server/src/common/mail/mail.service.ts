import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { isProductionEnv, parseBooleanFlag } from '../config/runtime.util';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Mail service using nodemailer.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * If SMTP_HOST is not set, mails are logged to console instead of sent
 * (useful for local development).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;
  private readonly requireSmtp: boolean;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST', '');
    const smtpPort = Number(config.get<string>('SMTP_PORT', '465'));
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    this.from = config.get<string>('MAIL_FROM', 'AI-World <noreply@ai-world.asia>');
    this.requireSmtp = parseBooleanFlag(
      config.get<string>('REQUIRE_SMTP'),
      isProductionEnv(nodeEnv),
    );
    this.enabled = !!host;

    if (this.requireSmtp && !this.enabled) {
      throw new Error(
        'SMTP is required in this environment. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.',
      );
    }

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
        auth: {
          user: config.get<string>('SMTP_USER', ''),
          pass: config.get<string>('SMTP_PASS', ''),
        },
      });
    }
  }

  async onModuleInit() {
    if (this.enabled && this.transporter) {
      this.logger.log('SMTP transport configured');
    } else {
      this.logger.warn('SMTP not configured - emails will be logged to console');
    }
  }

  /**
   * Send an email. Falls back to console logging when SMTP is not available.
   */
  async send(options: SendMailOptions): Promise<void> {
    const { to, subject, text, html } = options;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`Email sent to ${to}: ${subject}`);
      } catch (err) {
        this.logger.error(`Failed to send email to ${to}`, err);
        throw err;
      }
    } else {
      if (this.requireSmtp) {
        throw new Error('SMTP transport is required but not available.');
      }
      // Dev fallback - log the email content
      this.logger.warn(`[DEV MAIL] To: ${to} | Subject: ${subject}`);
      this.logger.warn(`[DEV MAIL] Body: ${text || html || '(empty)'}`);
    }
  }
}
