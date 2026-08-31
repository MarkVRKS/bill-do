import 'dotenv/config';

export const config = {
  port: parseInt(process.env.APP_PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/schetovod',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  yookassa: {
    shopId: process.env.YOOKASSA_SHOP_ID || 'test',
    secretKey: process.env.YOOKASSA_SECRET_KEY || 'test',
  },
};
