import nodemailer from 'nodemailer';
import { config } from './config.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const url = `${config.appUrl}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: config.smtp.user || 'noreply@schetovod.ru',
    to,
    subject: 'Подтверждение email — Счетовод',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1B2A2E; margin-bottom: 16px;">Подтвердите ваш email</h2>
        <p style="color: #5A6B67; line-height: 1.6;">
          Для завершения регистрации перейдите по ссылке:
        </p>
        <a href="${url}"
           style="display: inline-block; background: #1B2A2E; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Подтвердить email
        </a>
        <p style="color: #94A19D; font-size: 13px; margin-top: 24px;">
          Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте письмо.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const url = `${config.appUrl}/api/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: config.smtp.user || 'noreply@schetovod.ru',
    to,
    subject: 'Сброс пароля — Счетовод',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1B2A2E; margin-bottom: 16px;">Сброс пароля</h2>
        <p style="color: #5A6B67; line-height: 1.6;">
          Вы запросили сброс пароля. Перейдите по ссылке:
        </p>
        <a href="${url}"
           style="display: inline-block; background: #1B2A2E; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Задать новый пароль
        </a>
        <p style="color: #94A19D; font-size: 13px; margin-top: 24px;">
          Ссылка действительна 60 минут. Если вы не запрашивали сброс — проигнорируйте письмо.
        </p>
      </div>
    `,
  });
}
