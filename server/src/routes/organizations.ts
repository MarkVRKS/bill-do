import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { organizations } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { organizationSchema } from '../lib/validation.js';

export default async function organizationRoutes(app: FastifyInstance) {

  // ===== LIST ALL ORGANIZATIONS =====
  app.get('/api/organizations', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgs = await db.select().from(organizations);
    return reply.send({ organizations: orgs });
  });

  // ===== GET ACTIVE ORGANIZATION =====
  app.get('/api/organizations/active', { preHandler: [requireAuth] }, async (request, reply) => {
    // Find org marked as active, or fall back to the first one
    let [org] = await db.select().from(organizations).where(eq(organizations.isActive, true)).limit(1);
    if (!org) {
      [org] = await db.select().from(organizations).limit(1);
      if (org) {
        await db.update(organizations).set({ isActive: true }).where(eq(organizations.id, org.id));
      }
    }
    if (!org) {
      return reply.status(404).send({ error: 'Организация не найдена' });
    }
    return reply.send({ organization: org });
  });

  // ===== SWITCH ACTIVE ORGANIZATION =====
  app.post('/api/organizations/switch', { preHandler: [requireAuth] }, async (request, reply) => {
    const { organizationId } = request.body as { organizationId: string };

    // Deactivate all
    await db.update(organizations).set({ isActive: false });

    // Activate selected
    await db.update(organizations).set({ isActive: true }).where(eq(organizations.id, organizationId));

    return reply.send({ message: 'OK' });
  });

  // ===== CREATE ORGANIZATION (auto-activate) =====
  app.post('/api/organizations', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = organizationSchema.parse(request.body);

    // Deactivate all others first
    await db.update(organizations).set({ isActive: false });

    // Create new org as active
    const [org] = await db.insert(organizations).values({ ...body, isActive: true }).returning();
    return reply.status(201).send({ organization: org });
  });

  // ===== UPDATE ORGANIZATION =====
  app.put('/api/organizations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = organizationSchema.partial().parse(request.body);
    const [updated] = await db
      .update(organizations)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return reply.send({ organization: updated });
  });

  // ===== DELETE ORGANIZATION =====
  app.delete('/api/organizations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(organizations).where(eq(organizations.id, id));

    // If deleted org was active, activate first remaining
    const [remaining] = await db.select().from(organizations).limit(1);
    if (remaining) {
      await db.update(organizations).set({ isActive: true }).where(eq(organizations.id, remaining.id));
    }

    return reply.send({ message: 'Организация удалена' });
  });
}
