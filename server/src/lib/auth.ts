import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { users, sessions } from '../db/schema.js';
import { type InferSelectModel } from 'drizzle-orm';
import { eq, and, gt } from 'drizzle-orm';

export type User = InferSelectModel<typeof users>;
import { config } from './config.js';

const SALT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const EMAIL_VERIFY_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_MINUTES = 60;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return nanoid(48);
}

// ===== SESSIONS =====

export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const sessionId = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    expiresAt,
  });

  return sessionId;
}

export async function getSession(sessionId: string): Promise<User | null> {
  const now = new Date();
  const result = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  return result[0]?.user || null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ===== EMAIL VERIFICATION =====

export async function createEmailVerifyToken(userId: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      emailVerifyToken: token,
      emailVerifyExpires: expires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return token;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const now = new Date();
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.emailVerifyToken, token), gt(users.emailVerifyExpires, now)))
    .limit(1);

  if (!user[0]) return false;

  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user[0].id));

  return true;
}

// ===== PASSWORD RESET =====

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user[0]) return null;

  const token = generateToken();
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      passwordResetToken: token,
      passwordResetExpires: expires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user[0].id));

  return token;
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const now = new Date();
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.passwordResetToken, token), gt(users.passwordResetExpires, now)))
    .limit(1);

  if (!user[0]) return false;

  const hash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user[0].id));

  // Invalidate all sessions after password change
  await deleteAllUserSessions(user[0].id);

  return true;
}
