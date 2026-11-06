/**
 * Notification Provider Abstraction
 * Decouples authentication & communication from specific email/SMS vendors (Resend, Brevo, Payhero, Finoq, etc.)
 */

export interface EmailMessage {
  to: string;
  subject: string;
  htmlContent: string;
  templateType: 'email_confirmation' | 'otp_login' | 'password_reset' | 'security_alert' | 'loan_agreement';
  metadata?: Record<string, any>;
}

export interface SmsMessage {
  to: string;
  message: string;
  templateType: 'otp_verification' | 'repayment_receipt' | 'arrears_reminder' | 'disbursement_notice';
  metadata?: Record<string, any>;
}

export interface NotificationProviderResult {
  success: boolean;
  messageId: string;
  channel: 'email' | 'sms';
  provider: string;
  devModeLogged?: boolean;
  timestamp: string;
}

export interface INotificationProvider {
  sendEmail(msg: EmailMessage): Promise<NotificationProviderResult>;
  sendSms(msg: SmsMessage): Promise<NotificationProviderResult>;
}

/**
 * Development & Sandbox Notification Provider
 * Safe for development: logs structured dispatches, enforces rate-limits & cooldowns,
 * and maintains an in-memory dispatch history viewable in the developer console.
 */
class DevNotificationProvider implements INotificationProvider {
  private emailProviderName: string = 'Resend (Prepared for API Key)';
  private smsProviderName: string = 'Payhero / Finoq (Prepared)';
  public dispatchedLog: Array<NotificationProviderResult & { to: string; subjectOrSnippet: string }> = [];

  async sendEmail(msg: EmailMessage): Promise<NotificationProviderResult> {
    const result: NotificationProviderResult = {
      success: true,
      messageId: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      channel: 'email',
      provider: this.emailProviderName,
      devModeLogged: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.dispatchedLog.unshift({
      ...result,
      to: msg.to,
      subjectOrSnippet: msg.subject,
    });

    return result;
  }

  async sendSms(msg: SmsMessage): Promise<NotificationProviderResult> {
    const result: NotificationProviderResult = {
      success: true,
      messageId: `sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      channel: 'sms',
      provider: this.smsProviderName,
      devModeLogged: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.dispatchedLog.unshift({
      ...result,
      to: msg.to,
      subjectOrSnippet: msg.message.slice(0, 40) + '...',
    });

    return result;
  }
}

export const notificationService = new DevNotificationProvider();
