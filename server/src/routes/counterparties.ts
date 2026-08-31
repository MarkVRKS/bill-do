import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { counterparties } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { withOrganization } from '../lib/multi-tenancy.js';
import { counterpartySchema } from '../lib/validation.js';

export default async function counterpartyRoutes(app: FastifyInstance) {
  // ===== LIST COUNTERPARTIES =====
  app.get(
    '/api/counterparties',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const orgId = (request as any).organizationId;
      const list = await db
        .select()
        .from(counterparties)
        .where(eq(counterparties.organizationId, orgId));

      return reply.send({ counterparties: list });
    }
  );

  // ===== GET COUNTERPARTY =====
  app.get(
    '/api/counterparties/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const [cp] = await db
        .select()
        .from(counterparties)
        .where(
          and(eq(counterparties.id, id), eq(counterparties.organizationId, orgId))
        )
        .limit(1);

      if (!cp) {
        return reply.status(404).send({ error: 'Контрагент не найден' });
      }

      return reply.send({ counterparty: cp });
    }
  );

  // ===== CREATE COUNTERPARTY =====
  app.post(
    '/api/counterparties',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const body = counterpartySchema.parse(request.body);
      const orgId = (request as any).organizationId;

      const [cp] = await db
        .insert(counterparties)
        .values({ ...body, organizationId: orgId })
        .returning();

      return reply.status(201).send({ counterparty: cp });
    }
  );

  // ===== UPDATE COUNTERPARTY =====
  app.put(
    '/api/counterparties/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = counterpartySchema.partial().parse(request.body);
      const orgId = (request as any).organizationId;

      const [updated] = await db
        .update(counterparties)
        .set({ ...body, updatedAt: new Date() })
        .where(
          and(eq(counterparties.id, id), eq(counterparties.organizationId, orgId))
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Контрагент не найден' });
      }

      return reply.send({ counterparty: updated });
    }
  );

  // ===== DELETE COUNTERPARTY =====
  app.delete(
    '/api/counterparties/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const [deleted] = await db
        .delete(counterparties)
        .where(
          and(eq(counterparties.id, id), eq(counterparties.organizationId, orgId))
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: 'Контрагент не найден' });
      }

      return reply.send({ message: 'Контрагент удалён' });
    }
  );
}
