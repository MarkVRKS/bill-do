import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config } from './lib/config.js';
import { ZodError } from 'zod';
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import counterpartyRoutes from './routes/counterparties.js';
import invoiceRoutes from './routes/invoices.js';
import documentRoutes from './routes/documents.js';
import billingRoutes from './routes/billing.js';

const app = Fastify({
  logger: {
    level: 'info',
  },
});

// ===== PLUGINS =====

await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? config.appUrl : true,
  credentials: true,
});

await app.register(cookie, {
  secret: config.sessionSecret,
  hook: 'onRequest',
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// ===== GLOBAL ERROR HANDLER =====

app.setErrorHandler((error, request, reply) => {
  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((i) => i.message);
    return reply.status(400).send({ error: 'Ошибка валидации', details: messages });
  }

  const err = error as Error & { statusCode?: number };
  // Don't leak internal errors in production
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Внутренняя ошибка сервера'
      : err.message;

  app.log.error(err);
  return reply.status(statusCode).send({ error: message });
});

// ===== HEALTH CHECK =====

app.get('/api/health', async () => ({ status: 'ok' }));

// ===== ROUTES =====

await app.register(authRoutes);
await app.register(organizationRoutes);
await app.register(counterpartyRoutes);
await app.register(invoiceRoutes);
await app.register(documentRoutes);
await app.register(billingRoutes);

// ===== START =====

async function start() {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
