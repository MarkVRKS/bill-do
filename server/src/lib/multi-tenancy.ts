import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './db.js';
import { organizations, userOrganizations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Finds the first organization or creates a default one.
 */
async function ensureDefaultOrganization(): Promise<string> {
  const [existing] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (existing) return existing.id;

  const [org] = await db.insert(organizations).values({
    name: 'Моя организация',
    legalForm: 'ООО',
  }).returning({ id: organizations.id });

  return org.id;
}

/**
 * Middleware: attaches organizationId to request.
 * Without auth — always uses the first organization.
 */
export async function withOrganization(request: FastifyRequest, reply: FastifyReply) {
  const orgId = await ensureDefaultOrganization();
  (request as any).organizationId = orgId;
}

export async function switchOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  // Without auth — just activate the selected org globally
  await db.update(userOrganizations).set({ isActive: false });
  const [membership] = await db.select().from(userOrganizations).where(eq(userOrganizations.organizationId, organizationId)).limit(1);
  if (membership) {
    await db.update(userOrganizations).set({ isActive: true }).where(eq(userOrganizations.id, membership.id));
  }
  return true;
}
