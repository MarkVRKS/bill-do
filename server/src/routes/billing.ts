import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { subscriptionPlans, userSubscriptions, payments, invoices, userOrganizations } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { createPayment, cancelSubscription } from '../lib/yookassa-mock.js';

export default async function billingRoutes(app: FastifyInstance) {
  // ===== LIST PLANS =====
  app.get('/api/billing/plans', async (_request, reply) => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));

    return reply.send({ plans });
  });

  // ===== GET CURRENT SUBSCRIPTION =====
  app.get(
    '/api/billing/subscription',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id;

      const [sub] = await db
        .select({
          id: userSubscriptions.id,
          planId: userSubscriptions.planId,
          planCode: subscriptionPlans.code,
          planName: subscriptionPlans.name,
          status: userSubscriptions.status,
          currentPeriodEnd: userSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
          priceKopeks: subscriptionPlans.priceKopeks,
          monthlyInvoiceLimit: subscriptionPlans.monthlyInvoiceLimit,
          maxOrganizations: subscriptionPlans.maxOrganizations,
          features: subscriptionPlans.features,
        })
        .from(userSubscriptions)
        .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            eq(userSubscriptions.status, 'active')
          )
        )
        .limit(1);

      // Get active org for user
      const [org] = await db
        .select({ organizationId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(and(eq(userOrganizations.userId, userId), eq(userOrganizations.isActive, true)))
        .limit(1);

      // Current month invoice count
      let invoicesThisMonth = 0;
      if (org) {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

        const [stats] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(invoices)
          .where(
            and(
              eq(invoices.organizationId, org.organizationId),
              sql`${invoices.date} >= ${monthStart}`,
              sql`${invoices.date} <= ${monthEnd}`
            )
          );
        invoicesThisMonth = stats?.count || 0;
      }

      return reply.send({
        subscription: sub || null,
        usage: {
          invoicesThisMonth,
          limit: sub?.monthlyInvoiceLimit || null,
        },
      });
    }
  );

  // ===== SUBSCRIBE TO PLAN =====
  app.post(
    '/api/billing/subscribe',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { planId } = request.body as { planId: string };

      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

      if (!plan) {
        return reply.status(404).send({ error: 'Тариф не найден' });
      }

      const [existing] = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active'))
        )
        .limit(1);

      if (existing) {
        return reply.status(400).send({ error: 'Уже есть активная подписка' });
      }

      const payment = await createPayment(
        plan.priceKopeks,
        `Подписка: ${plan.name}`,
        { userId, planId: plan.id }
      );

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [sub] = await db
        .insert(userSubscriptions)
        .values({
          userId,
          planId,
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          yookassaSubscriptionId: payment.id,
        })
        .returning({ id: userSubscriptions.id });

      await db.insert(payments).values({
        userId,
        subscriptionId: sub.id,
        amountKopeks: plan.priceKopeks,
        status: payment.status === 'succeeded' ? 'succeeded' : 'pending',
        paymentType: 'subscription',
        description: `Подписка: ${plan.name}`,
        yookassaPaymentId: payment.id,
      });

      return reply.send({
        subscription: sub,
        paymentUrl: payment.confirmation?.confirmation_url,
      });
    }
  );

  // ===== CANCEL SUBSCRIPTION =====
  app.post(
    '/api/billing/cancel',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id;

      const [sub] = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active'))
        )
        .limit(1);

      if (!sub) {
        return reply.status(404).send({ error: 'Нет активной подписки' });
      }

      if (sub.yookassaSubscriptionId) {
        await cancelSubscription(sub.yookassaSubscriptionId);
      }

      await db
        .update(userSubscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(userSubscriptions.id, sub.id));

      return reply.send({ message: 'Подписка будет отменена в конце периода' });
    }
  );

  // ===== MOCK PAYMENT CONFIRMATION =====
  app.get('/payment/mock', async (request, reply) => {
    const { payment_id } = request.query as { payment_id: string };

    await db
      .update(payments)
      .set({ status: 'succeeded', updatedAt: new Date() })
      .where(eq(payments.yookassaPaymentId, payment_id));

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return reply.redirect(`${appUrl}/dashboard/billing?payment=success`);
  });

  // ===== SEED PLANS =====
  app.post('/api/billing/seed-plans', async (_request, reply) => {
    const plans = [
      {
        code: 'free',
        name: 'Пробный',
        priceKopeks: 0,
        monthlyInvoiceLimit: 1,
        maxOrganizations: 1,
        features: { exportHistory: false, prioritySupport: false },
      },
      {
        code: 'basic',
        name: 'Базовый',
        priceKopeks: 49000,
        monthlyInvoiceLimit: 100,
        maxOrganizations: 2,
        features: { exportHistory: true, prioritySupport: false },
      },
      {
        code: 'pro',
        name: 'Профессиональный',
        priceKopeks: 99000,
        monthlyInvoiceLimit: null,
        maxOrganizations: 10,
        features: { exportHistory: true, prioritySupport: true },
      },
    ];

    for (const plan of plans) {
      await db
        .insert(subscriptionPlans)
        .values(plan)
        .onConflictDoNothing({ target: subscriptionPlans.code });
    }

    return reply.send({ message: 'Plans seeded' });
  });
}
