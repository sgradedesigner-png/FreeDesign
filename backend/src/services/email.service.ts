import { logger } from '../lib/logger';
// backend/src/services/email.service.ts
import { Resend } from 'resend';

/**
 * Escape HTML to prevent XSS attacks in email templates
 */
function escapeHtml(text: string | number): string {
  const str = String(text);
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Mask email address for privacy in logs (GDPR compliance)
 * Example: test@example.com â†’ t***@e***.com
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return '***';

  const maskedLocal = localPart.length > 1
    ? `${localPart[0]}***`
    : '***';

  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map(part =>
    part.length > 1 ? `${part[0]}***` : part
  ).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

interface EmailConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resend: Resend;
  private config: EmailConfig;

  constructor() {
    this.config = {
      apiKey: process.env.RESEND_API_KEY || '',
      from: process.env.EMAIL_FROM || 'support@korean-goods.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Korean Goods Support'
    };

    if (!this.config.apiKey) {
      logger.warn('[Email Service] RESEND_API_KEY not configured. Email sending will be disabled.');
    }

    this.resend = new Resend(this.config.apiKey);
    logger.info({ from: `${this.config.fromName} <${this.config.from}>` }, '[Email Service] Initialized');
  }

  /**
   * Send an email using Resend
   */
  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config.apiKey) {
      logger.error({}, '[Email Service] Cannot send email: RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    // Validate email addresses
    const emails = Array.isArray(params.to) ? params.to : [params.to];
    const invalidEmails = emails.filter(email => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      logger.error({ invalidEmails: invalidEmails.map(maskEmail) }, '[Email Service] Invalid email addresses');
      return { success: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` };
    }

    try {
      // Mask email in production logs for privacy (GDPR)
      const isProduction = process.env.NODE_ENV === 'production';
      const logTo = isProduction
        ? (Array.isArray(params.to) ? params.to.map(maskEmail) : maskEmail(params.to))
        : params.to;

      logger.info({
        to: logTo,
        subject: params.subject,
        from: `${this.config.fromName} <${this.config.from}>`
      }, '[Email Service] Sending email');

      const { data, error } = await this.resend.emails.send({
        from: `${this.config.fromName} <${this.config.from}>`,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || params.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });

      if (error) {
        logger.error({ error }, '[Email Service] Failed to send email');
        return { success: false, error: error.message };
      }

      logger.info({ messageId: data?.id }, '[Email Service] Email sent successfully');
      return { success: true, messageId: data?.id };
    } catch (error: any) {
      logger.error({ error }, '[Email Service] Error sending email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(to: string, orderData: {
    orderId: string;
    total: number;
    items: any[];
    qrCodeUrl?: string;
    qpayInvoiceExpiresAt?: Date;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { orderId, total, items, qrCodeUrl, qpayInvoiceExpiresAt } = orderData;

    const itemsList = items.map(item =>
      `<li>${escapeHtml(item.productName)} - ${escapeHtml(item.variantName)} x ${escapeHtml(item.quantity)} = â‚®${(item.price * item.quantity).toLocaleString()}</li>`
    ).join('');

    const expiresText = qpayInvoiceExpiresAt
      ? `<p style="color: #f59e0b; font-weight: bold;">â° ÐÐ½Ñ…Ð°Ð°Ñ€: Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° ${qpayInvoiceExpiresAt.toLocaleString('mn-MN')} Ñ…Ò¯Ñ€Ñ‚ÑÐ»</p>`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶Ð»Ð°Ð°</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h1 style="color: #059669; margin-bottom: 20px;">âœ… Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶Ð»Ð°Ð°!</h1>

    <p>Ð¡Ð°Ð¹Ð½ Ð±Ð°Ð¹Ð½Ð° ÑƒÑƒ,</p>
    <p>Ð¢Ð°Ð½Ñ‹ <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> Ð´ÑƒÐ³Ð°Ð°Ñ€Ñ‚Ð°Ð¹ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ñ‚Ð°Ð¹ Ò¯Ò¯ÑÐ»ÑÑ.</p>

    ${expiresText}

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹:</h3>
      <ul style="list-style: none; padding: 0;">
        ${itemsList}
      </ul>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
      <p style="font-size: 18px; font-weight: bold; text-align: right; margin: 0;">
        ÐÐ¸Ð¹Ñ‚: â‚®${total.toLocaleString()}
      </p>
    </div>

    ${qrCodeUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <p><strong>QPay QR ÐºÐ¾Ð´Ð¾Ð¾Ñ€ Ñ‚Ó©Ð»Ó©Ñ…:</strong></p>
      <p><a href="${qrCodeUrl}" style="color: #059669; text-decoration: none;">Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ‚Ó©Ð»Ó©Ñ… Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ</a></p>
    </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        ÐÑÑƒÑƒÐ»Ñ‚ Ð±Ð°Ð¹Ð²Ð°Ð» <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> Ñ…Ð°ÑÐ³Ð°Ð°Ñ€ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Ð‘Ð°ÑÑ€Ð»Ð°Ð»Ð°Ð°,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶Ð»Ð°Ð° - #${orderId.substring(0, 8).toUpperCase()}`,
      html
    });
  }

  /**
   * Send order expiration warning email
   */
  async sendExpirationWarning(to: string, orderData: {
    orderId: string;
    total: number;
    qrCodeUrl?: string;
    hoursRemaining: number;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { orderId, total, qrCodeUrl, hoursRemaining } = orderData;

    const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÐ°Ñ… Ð³ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; padding: 20px; border-radius: 10px; border: 2px solid #f59e0b;">
    <h1 style="color: #d97706; margin-bottom: 20px;">â° ÐÐ½Ñ…Ð°Ð°Ñ€ÑƒÑƒÐ»Ð³Ð°: Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÐ°Ñ… Ð³ÑÐ¶ Ð±Ð°Ð¹Ð½Ð°</h1>

    <p>Ð¡Ð°Ð¹Ð½ Ð±Ð°Ð¹Ð½Ð° ÑƒÑƒ,</p>
    <p>Ð¢Ð°Ð½Ñ‹ <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> Ð´ÑƒÐ³Ð°Ð°Ñ€Ñ‚Ð°Ð¹ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° <strong style="color: #dc2626;">${escapeHtml(hoursRemaining)} Ñ†Ð°Ð³</strong>-Ñ‹Ð½ Ð´Ð°Ñ€Ð°Ð° Ð´ÑƒÑƒÑÐ½Ð°.</p>

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="font-size: 18px; font-weight: bold; margin: 0;">
        ÐÐ¸Ð¹Ñ‚ Ð´Ò¯Ð½: â‚®${total.toLocaleString()}
      </p>
    </div>

    ${qrCodeUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${qrCodeUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ÐžÐ´Ð¾Ð¾ Ñ‚Ó©Ð»Ó©Ñ…
      </a>
    </div>
    ` : ''}

    <p style="color: #dc2626; font-weight: bold;">Ð¥ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÐ¼Ð°Ð³Ñ† Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ Ñ†ÑƒÑ†Ð»Ð°Ð³Ð´Ð°Ð½Ð°.</p>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        ÐÑÑƒÑƒÐ»Ñ‚ Ð±Ð°Ð¹Ð²Ð°Ð» <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> Ñ…Ð°ÑÐ³Ð°Ð°Ñ€ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Ð‘Ð°ÑÑ€Ð»Ð°Ð»Ð°Ð°,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `â° Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÐ°Ñ…Ð°Ð´ ${hoursRemaining} Ñ†Ð°Ð³ Ò¯Ð»Ð´Ð»ÑÑ - #${orderId.substring(0, 8).toUpperCase()}`,
      html
    });
  }

  /**
   * Send order expired notification
   */
  async sendOrderExpired(to: string, orderData: {
    orderId: string;
    total: number;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { orderId, total } = orderData;

    const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÑÐ°Ð½</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fee2e2; padding: 20px; border-radius: 10px; border: 2px solid #dc2626;">
    <h1 style="color: #dc2626; margin-bottom: 20px;">âŒ Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÑÐ°Ð½</h1>

    <p>Ð¡Ð°Ð¹Ð½ Ð±Ð°Ð¹Ð½Ð° ÑƒÑƒ,</p>
    <p>Ð£ÑƒÑ‡Ð»Ð°Ð°Ñ€Ð°Ð¹, Ñ‚Ð°Ð½Ñ‹ <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> Ð´ÑƒÐ³Ð°Ð°Ñ€Ñ‚Ð°Ð¹ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÑÐ°Ð½ Ñ‚ÑƒÐ» Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ Ñ†ÑƒÑ†Ð»Ð°Ð³Ð´Ð»Ð°Ð°.</p>

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="font-size: 18px; font-weight: bold; margin: 0;">
        ÐÐ¸Ð¹Ñ‚ Ð´Ò¯Ð½: â‚®${total.toLocaleString()}
      </p>
    </div>

    <p>Ð¥ÑÑ€ÑÐ² Ñ‚Ð° Ð´Ð°Ñ…Ð¸Ð½ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ó©Ð³Ó©Ñ…Ð¸Ð¹Ð³ Ñ…Ò¯ÑÐ²ÑÐ» Ð¼Ð°Ð½Ð°Ð¹ Ð²ÑÐ±ÑÐ°Ð¹Ñ‚Ð°Ð°Ñ ÑˆÐ¸Ð½ÑÑÑ€ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ò¯Ò¯ÑÐ³ÑÐ½Ñ Ò¯Ò¯.</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="https://korean-goods.com/products" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Ð”Ð°Ñ…Ð¸Ð½ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð°Ñ…
      </a>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        ÐÑÑƒÑƒÐ»Ñ‚ Ð±Ð°Ð¹Ð²Ð°Ð» <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> Ñ…Ð°ÑÐ³Ð°Ð°Ñ€ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Ð‘Ð°ÑÑ€Ð»Ð°Ð»Ð°Ð°,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÑÐ°Ð½ - #${orderId.substring(0, 8).toUpperCase()}`,
      html
    });
  }

  /**
   * Send production status update email
   */
  async sendProductionStatusUpdate(to: string, params: {
    orderId: string;
    fromStatus: string;
    toStatus: string;
    notes?: string | null;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { orderId, fromStatus, toStatus, notes } = params;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Production Status Updated</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <h1 style="margin: 0 0 16px; color: #0f172a;">Production Status Updated</h1>
    <p>Your order <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> has moved in production.</p>

    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
      <p style="margin: 0 0 6px;"><strong>From:</strong> ${escapeHtml(fromStatus)}</p>
      <p style="margin: 0;"><strong>To:</strong> ${escapeHtml(toStatus)}</p>
      ${notes ? `<p style="margin: 10px 0 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
    </div>

    <p style="margin-top: 18px; color: #475569; font-size: 14px;">
      You can view your order details in your account orders page.
    </p>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `Production update - #${orderId.substring(0, 8).toUpperCase()} (${toStatus})`,
      html,
    });
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ð¢ÐµÑÑ‚ Ð¼ÑÐ¹Ð»</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h1 style="color: #059669;">âœ… Email ÑÐ¸ÑÑ‚ÐµÐ¼ Ð°Ð¶Ð¸Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°!</h1>
    <p>Ð­Ð½Ñ Ð±Ð¾Ð» Ñ‚ÐµÑÑ‚ Ð¼ÑÐ¹Ð» ÑŽÐ¼.</p>
    <p>Resend API Ð±Ð¾Ð»Ð¾Ð½ support@korean-goods.com Ñ…Ð°ÑÐ³ Ð·Ó©Ð² Ð°Ð¶Ð¸Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Ð˜Ð»Ð³ÑÑÑÑÐ½: ${new Date().toLocaleString('mn-MN')}
    </p>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: 'âœ… Korean Goods - Email ÑÐ¸ÑÑ‚ÐµÐ¼ Ñ‚ÐµÑÑ‚',
      html
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();

