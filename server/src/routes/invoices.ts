import type { FastifyInstance } from 'fastify';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { invoices, invoicePositions, organizations, counterparties } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { withOrganization } from '../lib/multi-tenancy.js';
import { invoiceSchema } from '../lib/validation.js';

export default async function invoiceRoutes(app: FastifyInstance) {
  // ===== LIST INVOICES =====
  app.get(
    '/api/invoices',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const orgId = (request as any).organizationId;
      const q = request.query as Record<string, string>;

      const conditions = [eq(invoices.organizationId, orgId)];

      if (q.status) conditions.push(eq(invoices.status, q.status as any));
      if (q.dateFrom) conditions.push(sql`${invoices.date} >= ${q.dateFrom}`);
      if (q.dateTo) conditions.push(sql`${invoices.date} <= ${q.dateTo}`);
      if (q.search) {
        conditions.push(
          sql`(${invoices.number} ILIKE ${'%' + q.search + '%'} OR ${invoices.basis} ILIKE ${'%' + q.search + '%'})`
        );
      }

      const list = await db
        .select({
          id: invoices.id,
          number: invoices.number,
          date: invoices.date,
          counterpartyId: invoices.counterpartyId,
          counterpartyName: counterparties.name,
          basis: invoices.basis,
          bases: invoices.bases,
          signer: invoices.signer,
          serviceMonth: invoices.serviceMonth,
          serviceYear: invoices.serviceYear,
          vatType: invoices.vatType,
          status: invoices.status,
          total: invoices.total,
          vatAmount: invoices.vatAmount,
          totalWithVat: invoices.totalWithVat,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(counterparties, eq(invoices.counterpartyId, counterparties.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt));

      return reply.send({ invoices: list });
    }
  );

  // ===== GET INVOICE (with positions) =====
  app.get(
    '/api/invoices/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const [inv] = await db
        .select({
          id: invoices.id,
          number: invoices.number,
          date: invoices.date,
          counterpartyId: invoices.counterpartyId,
          counterpartyName: counterparties.name,
          basis: invoices.basis,
          bases: invoices.bases,
          signer: invoices.signer,
          serviceMonth: invoices.serviceMonth,
          serviceYear: invoices.serviceYear,
          vatType: invoices.vatType,
          status: invoices.status,
          total: invoices.total,
          vatAmount: invoices.vatAmount,
          totalWithVat: invoices.totalWithVat,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .leftJoin(counterparties, eq(invoices.counterpartyId, counterparties.id))
        .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
        .limit(1);

      if (!inv) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const positions = await db
        .select()
        .from(invoicePositions)
        .where(eq(invoicePositions.invoiceId, id))
        .orderBy(invoicePositions.sortOrder);

      return reply.send({ invoice: { ...inv, positions } });
    }
  );

  // ===== CREATE INVOICE =====
  app.post(
    '/api/invoices',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const body = invoiceSchema.parse(request.body);
      const orgId = (request as any).organizationId;

      // Get next invoice number from organization
      const [org] = await db
        .select({ nextInvoiceNumber: organizations.nextInvoiceNumber })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const invoiceNumber = body.number || String(org!.nextInvoiceNumber);

      // Calculate totals server-side (never trust client)
      let total = 0;
      const positions = body.positions.map((pos, i) => {
        const amount = Math.round(pos.quantity * pos.price * 100) / 100;
        total += amount;
        return {
          sortOrder: i + 1,
          name: pos.name,
          quantity: String(pos.quantity),
          unit: pos.unit || 'шт.',
          price: String(pos.price),
          amount: String(amount),
        };
      });

      total = Math.round(total * 100) / 100;
      let vatAmount = 0;
      let totalWithVat = total;

      if (body.vatType === '20') {
        vatAmount = Math.round(total * 0.2 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      } else if (body.vatType === '22') {
        vatAmount = Math.round(total * 0.22 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      } else if (body.vatType === '10') {
        vatAmount = Math.round(total * 0.1 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      }

      // Insert invoice
      const [inv] = await db
        .insert(invoices)
        .values({
          organizationId: orgId,
          number: invoiceNumber,
          date: body.date,
          counterpartyId: body.counterpartyId || null,
          basis: body.basis,
          bases: body.bases || [],
          signer: body.signer,
          serviceMonth: body.serviceMonth,
          serviceYear: body.serviceYear,
          vatType: body.vatType,
          status: body.status || 'sent',
          total: String(total),
          vatAmount: String(vatAmount),
          totalWithVat: String(totalWithVat),
          dueDate: body.dueDate || null,
        })
        .returning({ id: invoices.id });

      // Insert positions
      if (positions.length > 0) {
        await db.insert(invoicePositions).values(
          positions.map((pos) => ({ ...pos, invoiceId: inv.id }))
        );
      }

      // Increment next invoice number
      await db
        .update(organizations)
        .set({ nextInvoiceNumber: (org!.nextInvoiceNumber || 0) + 1 })
        .where(eq(organizations.id, orgId));

      return reply.status(201).send({ invoice: { id: inv.id, number: invoiceNumber } });
    }
  );

  // ===== UPDATE INVOICE =====
  app.put(
    '/api/invoices/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = invoiceSchema.parse(request.body);
      const orgId = (request as any).organizationId;

      // Verify ownership
      const [existing] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      // Recalculate totals server-side
      let total = 0;
      const positions = body.positions.map((pos, i) => {
        const amount = Math.round(pos.quantity * pos.price * 100) / 100;
        total += amount;
        return {
          sortOrder: i + 1,
          name: pos.name,
          quantity: String(pos.quantity),
          unit: pos.unit || 'шт.',
          price: String(pos.price),
          amount: String(amount),
        };
      });

      total = Math.round(total * 100) / 100;
      let vatAmount = 0;
      let totalWithVat = total;

      if (body.vatType === '20') {
        vatAmount = Math.round(total * 0.2 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      } else if (body.vatType === '22') {
        vatAmount = Math.round(total * 0.22 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      } else if (body.vatType === '10') {
        vatAmount = Math.round(total * 0.1 * 100) / 100;
        totalWithVat = Math.round((total + vatAmount) * 100) / 100;
      }

      // Update invoice
      await db
        .update(invoices)
        .set({
          number: body.number,
          date: body.date,
          counterpartyId: body.counterpartyId || null,
          basis: body.basis,
          bases: body.bases || [],
          signer: body.signer,
          serviceMonth: body.serviceMonth,
          serviceYear: body.serviceYear,
          vatType: body.vatType,
          status: body.status || 'sent',
          total: String(total),
          vatAmount: String(vatAmount),
          totalWithVat: String(totalWithVat),
          dueDate: body.dueDate || null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id));

      // Replace positions
      await db.delete(invoicePositions).where(eq(invoicePositions.invoiceId, id));
      if (positions.length > 0) {
        await db.insert(invoicePositions).values(
          positions.map((pos) => ({ ...pos, invoiceId: id }))
        );
      }

      return reply.send({ message: 'Счёт обновлён' });
    }
  );

  // ===== UPDATE INVOICE STATUS =====
  app.patch(
    '/api/invoices/:id/status',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };
      const orgId = (request as any).organizationId;

      const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Недопустимый статус' });
      }

      const update: Record<string, any> = { status, updatedAt: new Date() };
      if (status === 'paid') update.paidAt = new Date();

      const [updated] = await db
        .update(invoices)
        .set(update)
        .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
        .returning({ id: invoices.id });

      if (!updated) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      return reply.send({ message: 'Статус обновлён' });
    }
  );

  // ===== DELETE INVOICE =====
  app.delete(
    '/api/invoices/:id',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const [deleted] = await db
        .delete(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
        .returning({ id: invoices.id });

      if (!deleted) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      return reply.send({ message: 'Счёт удалён' });
    }
  );

  // ===== INVOICE STATISTICS (for dashboard) =====
  app.get(
    '/api/invoices/stats',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const orgId = (request as any).organizationId;
      const q = request.query as Record<string, string>;

      const conditions = [eq(invoices.organizationId, orgId)];
      if (q.dateFrom) conditions.push(sql`${invoices.date} >= ${q.dateFrom}`);
      if (q.dateTo) conditions.push(sql`${invoices.date} <= ${q.dateTo}`);

      const [stats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
          totalWithVat: sql<string>`coalesce(sum(${invoices.totalWithVat}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...conditions));

      // Monthly breakdown for chart
      const monthly = await db
        .select({
          month: sql<string>`extract(month from ${invoices.date})::int`,
          year: sql<string>`extract(year from ${invoices.date})::int`,
          sum: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...conditions))
        .groupBy(
          sql`extract(month from ${invoices.date})`,
          sql`extract(year from ${invoices.date})`
        );

      return reply.send({
        stats: {
          count: stats?.count || 0,
          total: stats?.total || '0',
          totalWithVat: stats?.totalWithVat || '0',
          average: stats?.count ? String(Number(stats.total) / stats.count) : '0',
        },
        monthly,
      });
    }
  );
}
