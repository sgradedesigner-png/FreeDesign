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
 * Example: test@example.com → t***@e***.com
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
      logger.error({ invalidEmails }, '[Email Service] Invalid email addresses');
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
      `<li>${escapeHtml(item.productName)} - ${escapeHtml(item.variantName)} x ${escapeHtml(item.quantity)} = ₮${(item.price * item.quantity).toLocaleString()}</li>`
    ).join('');

    const expiresText = qpayInvoiceExpiresAt
      ? `<p style="color: #f59e0b; font-weight: bold;">⏰ Анхаар: Төлбөрийн хугацаа ${qpayInvoiceExpiresAt.toLocaleString('mn-MN')} хүртэл</p>`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Захиалга баталгаажлаа</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h1 style="color: #059669; margin-bottom: 20px;">✅ Захиалга баталгаажлаа!</h1>

    <p>Сайн байна уу,</p>
    <p>Таны <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> дугаартай захиалга амжилттай үүслээ.</p>

    ${expiresText}

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Захиалгын дэлгэрэнгүй:</h3>
      <ul style="list-style: none; padding: 0;">
        ${itemsList}
      </ul>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
      <p style="font-size: 18px; font-weight: bold; text-align: right; margin: 0;">
        Нийт: ₮${total.toLocaleString()}
      </p>
    </div>

    ${qrCodeUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <p><strong>QPay QR кодоор төлөх:</strong></p>
      <p><a href="${qrCodeUrl}" style="color: #059669; text-decoration: none;">Төлбөр төлөх холбоос</a></p>
    </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        Асуулт байвал <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> хаягаар холбогдоно уу.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Баярлалаа,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `Захиалга баталгаажлаа - #${orderId.substring(0, 8).toUpperCase()}`,
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
  <title>Төлбөрийн хугацаа дуусах гэж байна</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; padding: 20px; border-radius: 10px; border: 2px solid #f59e0b;">
    <h1 style="color: #d97706; margin-bottom: 20px;">⏰ Анхааруулга: Төлбөрийн хугацаа дуусах гэж байна</h1>

    <p>Сайн байна уу,</p>
    <p>Таны <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> дугаартай захиалгын төлбөрийн хугацаа <strong style="color: #dc2626;">${escapeHtml(hoursRemaining)} цаг</strong>-ын дараа дуусна.</p>

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="font-size: 18px; font-weight: bold; margin: 0;">
        Нийт дүн: ₮${total.toLocaleString()}
      </p>
    </div>

    ${qrCodeUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${qrCodeUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Одоо төлөх
      </a>
    </div>
    ` : ''}

    <p style="color: #dc2626; font-weight: bold;">Хугацаа дуусмагц захиалга автоматаар цуцлагдана.</p>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        Асуулт байвал <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> хаягаар холбогдоно уу.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Баярлалаа,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `⏰ Төлбөрийн хугацаа дуусахад ${hoursRemaining} цаг үлдлээ - #${orderId.substring(0, 8).toUpperCase()}`,
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
  <title>Захиалгын хугацаа дууссан</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fee2e2; padding: 20px; border-radius: 10px; border: 2px solid #dc2626;">
    <h1 style="color: #dc2626; margin-bottom: 20px;">❌ Захиалгын хугацаа дууссан</h1>

    <p>Сайн байна уу,</p>
    <p>Уучлаарай, таны <strong>#${escapeHtml(orderId.substring(0, 8).toUpperCase())}</strong> дугаартай захиалгын төлбөрийн хугацаа дууссан тул автоматаар цуцлагдлаа.</p>

    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="font-size: 18px; font-weight: bold; margin: 0;">
        Нийт дүн: ₮${total.toLocaleString()}
      </p>
    </div>

    <p>Хэрэв та дахин захиалга өгөхийг хүсвэл манай вэбсайтаас шинээр захиалга үүсгэнэ үү.</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="https://korean-goods.com/products" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Дахин захиалах
      </a>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        Асуулт байвал <a href="mailto:${this.config.from}" style="color: #059669;">${this.config.from}</a> хаягаар холбогдоно уу.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Баярлалаа,<br>
        <strong>Korean Goods</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `Захиалгын хугацаа дууссан - #${orderId.substring(0, 8).toUpperCase()}`,
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
  <title>Тест мэйл</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h1 style="color: #059669;">✅ Email систем ажиллаж байна!</h1>
    <p>Энэ бол тест мэйл юм.</p>
    <p>Resend API болон support@korean-goods.com хаяг зөв ажиллаж байна.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Илгээсэн: ${new Date().toLocaleString('mn-MN')}
    </p>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: '✅ Korean Goods - Email систем тест',
      html
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
