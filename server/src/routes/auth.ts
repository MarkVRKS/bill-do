import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users, organizations, userOrganizations } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  createEmailVerifyToken,
  verifyEmail,
  createPasswordResetToken,
  resetPassword,
} from '../lib/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../lib/config.js';

export default async function authRoutes(app: FastifyInstance) {
  // ===== REGISTER =====
  app.post('/api/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    // Check if email exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing[0]) {
      // Enumeration-safe: same message regardless of whether user exists
      return reply.status(201).send({
        message: 'Если такой email зарегистрирован, на него отправлено письмо для подтверждения.',
      });
    }

    // Create user — email verified by default, no verification needed
    const passwordHash = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id, email: users.email });

    // Create default organization
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Моя организация' })
      .returning({ id: organizations.id });

    // Link user to organization
    await db.insert(userOrganizations).values({
      userId: user.id,
      organizationId: org.id,
      role: 'owner',
      isActive: true,
    });

    // Auto-login after registration
    const sessionId = await createSession(user.id, request.headers['user-agent'], request.ip);

    reply.setCookie(config.sessionSecret + '_sid', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        onboardingDone: false,
      },
    });
  });

  // ===== LOGIN =====
  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }

    // TODO: включить в продакшене
    // if (!user.emailVerified) {
    //   return reply.status(403).send({
    //     error: 'Email не подтверждён. Проверьте почту или запросите повторную отправку.',
    //     code: 'EMAIL_NOT_VERIFIED',
    //   });
    // }

    // Create session
    const sessionId = await createSession(
      user.id,
      request.headers['user-agent'],
      request.ip
    );

    reply.setCookie(config.sessionSecret + '_sid', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        onboardingDone: user.onboardingDone,
      },
    });
  });

  // ===== LOGOUT =====
  app.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies?.[config.sessionSecret + '_sid'];
    if (sessionId) {
      await deleteSession(sessionId);
    }
    reply.clearCookie(config.sessionSecret + '_sid', { path: '/' });
    return reply.send({ message: 'OK' });
  });

  // ===== CURRENT USER =====
  app.get('/api/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!;
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        onboardingDone: user.onboardingDone,
      },
    });
  });

  // ===== FORGOT PASSWORD =====
  app.post('/api/auth/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    const token = await createPasswordResetToken(normalizedEmail);

    // Enumeration-safe: always return success
    if (token) {
      try {
        await sendPasswordResetEmail(normalizedEmail, token);
      } catch (err) {
        app.log.error(err, 'Failed to send password reset email');
      }
    }

    return reply.send({
      message: 'Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.',
    });
  });

  // ===== RESET PASSWORD =====
  app.post('/api/auth/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    const success = await resetPassword(body.token, body.password);
    if (!success) {
      return reply.status(400).send({
        error: 'Ссылка недействительна или уже использована',
      });
    }

    return reply.send({ message: 'Пароль успешно изменён. Войдите с новым паролем.' });
  });

  // ===== ONBOARDING =====
  app.post('/api/auth/onboarding-done', { preHandler: [requireAuth] }, async (request, reply) => {
    await db
      .update(users)
      .set({ onboardingDone: true, updatedAt: new Date() })
      .where(eq(users.id, request.user!.id));

    return reply.send({ message: 'OK' });
  });
}
