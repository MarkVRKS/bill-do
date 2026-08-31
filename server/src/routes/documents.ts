import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { invoices, invoicePositions, organizations, counterparties } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { withOrganization } from '../lib/multi-tenancy.js';
import { generateExcel } from '../lib/excel-generator.js';
import { generatePDF } from '../lib/pdf-generator.js';
import { generateAct } from '../lib/act-generator.js';
import { generateActPDF } from '../lib/act-pdf-generator.js';
import { generatePrintHTML, generateActPrintHTML } from '../lib/print-generator.js';

const MONTHS_NOMINATIVE = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function buildFilename(
  type: 'invoice' | 'act',
  invoiceNumber: string,
  legalForm: string,
  cpName: string,
  month: number,
  year: number,
  ext: string
): string {
  const prefix = type === 'invoice' ? 'Счет_на_оплату' : 'Акт_оказанных_услуг';
  const safeLf = (legalForm || '').replace(/[^а-яА-Яa-zA-Z]/g, '');
  const safeCp = (cpName || 'без_покупателя').replace(/[^а-яА-Яa-zA-Z0-9]/g, '_');
  const monthName = MONTHS_NOMINATIVE[month] || '';
  return `${prefix}_№${invoiceNumber}_${safeLf}_${safeCp}_${monthName}_${year}${ext}`;
}

async function getInvoiceFullData(invoiceId: string, orgId: string) {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, orgId)))
    .limit(1);

  if (!inv) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  let cp = null;
  if (inv.counterpartyId) {
    [cp] = await db
      .select()
      .from(counterparties)
      .where(eq(counterparties.id, inv.counterpartyId))
      .limit(1);
  }

  const positions = await db
    .select()
    .from(invoicePositions)
    .where(eq(invoicePositions.invoiceId, inv.id))
    .orderBy(invoicePositions.sortOrder);

  return { inv, org, cp, positions };
}

export default async function documentRoutes(app: FastifyInstance) {
  // ===== DOWNLOAD EXCEL =====
  app.get(
    '/api/invoices/:id/excel',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const buffer = await generateExcel(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '', bankName: org.bankName || '',
          bankBik: org.bankBik || '', bankCorr: org.bankCorr || '',
          bankAccount: org.bankAccount || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          basis: inv.basis || '', signer: inv.signer || '',
          serviceMonth: inv.serviceMonth || 1, serviceYear: inv.serviceYear || 2024,
          vatType: inv.vatType, total: inv.total,
          vatAmount: inv.vatAmount || '0', totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      const filename = buildFilename(
        'invoice',
        inv.number, org.legalForm || 'ООО',
        cp?.name || '', inv.serviceMonth || 1, inv.serviceYear || 2024, '.xlsx'
      );

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
        .send(buffer);
    }
  );

  // ===== DOWNLOAD PDF =====
  app.get(
    '/api/invoices/:id/pdf',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const buffer = await generatePDF(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '', bankName: org.bankName || '',
          bankBik: org.bankBik || '', bankCorr: org.bankCorr || '',
          bankAccount: org.bankAccount || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          basis: inv.basis || '', serviceMonth: inv.serviceMonth || 1,
          serviceYear: inv.serviceYear || 2024, vatType: inv.vatType,
          total: inv.total, vatAmount: inv.vatAmount || '0',
          totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      const filename = buildFilename(
        'invoice',
        inv.number, org.legalForm || 'ООО',
        cp?.name || '', inv.serviceMonth || 1, inv.serviceYear || 2024, '.pdf'
      );

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
        .send(buffer);
    }
  );

  // ===== DOWNLOAD ACT (EXCEL) =====
  app.get(
    '/api/invoices/:id/act',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const bases = Array.isArray(inv.bases) && inv.bases.length > 0
        ? inv.bases
        : inv.basis ? [inv.basis] : [];

      const buffer = await generateAct(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          bases, serviceMonth: inv.serviceMonth || 1,
          serviceYear: inv.serviceYear || 2024, vatType: inv.vatType,
          total: inv.total, vatAmount: inv.vatAmount || '0',
          totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      const filename = buildFilename(
        'act',
        inv.number, org.legalForm || 'ООО',
        cp?.name || '', inv.serviceMonth || 1, inv.serviceYear || 2024, '.xlsx'
      );

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
        .send(buffer);
    }
  );

  // ===== DOWNLOAD ACT PDF =====
  app.get(
    '/api/invoices/:id/act-pdf',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const bases = Array.isArray(inv.bases) && inv.bases.length > 0
        ? inv.bases
        : inv.basis ? [inv.basis] : [];

      const buffer = await generateActPDF(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          bases, serviceMonth: inv.serviceMonth || 1,
          serviceYear: inv.serviceYear || 2024, vatType: inv.vatType,
          total: inv.total, vatAmount: inv.vatAmount || '0',
          totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      const filename = buildFilename(
        'act',
        inv.number, org.legalForm || 'ООО',
        cp?.name || '', inv.serviceMonth || 1, inv.serviceYear || 2024, '.pdf'
      );

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
        .send(buffer);
    }
  );

  // ===== PRINT INVOICE (HTML) =====
  app.get(
    '/api/invoices/:id/print',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const html = generatePrintHTML(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '', bankName: org.bankName || '',
          bankBik: org.bankBik || '', bankCorr: org.bankCorr || '',
          bankAccount: org.bankAccount || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          basis: inv.basis || '', serviceMonth: inv.serviceMonth || 1,
          serviceYear: inv.serviceYear || 2024, vatType: inv.vatType,
          total: inv.total, vatAmount: inv.vatAmount || '0',
          totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    }
  );

  // ===== PRINT ACT (HTML) =====
  app.get(
    '/api/invoices/:id/act-print',
    { preHandler: [requireAuth, withOrganization] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const orgId = (request as any).organizationId;

      const data = await getInvoiceFullData(id, orgId);
      if (!data) {
        return reply.status(404).send({ error: 'Счёт не найден' });
      }

      const { inv, org, cp, positions } = data;

      const bases = Array.isArray(inv.bases) && inv.bases.length > 0
        ? inv.bases
        : inv.basis ? [inv.basis] : [];

      const html = generateActPrintHTML(
        {
          name: org.name, inn: org.inn || '', kpp: org.kpp || '',
          address: org.address || '', director: org.director || '',
          accountant: org.accountant || '',
        },
        cp ? {
          name: cp.name, address: cp.address || '',
          ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '',
        } : null,
        {
          number: inv.number, date: inv.date,
          bases, serviceMonth: inv.serviceMonth || 1,
          serviceYear: inv.serviceYear || 2024, vatType: inv.vatType,
          total: inv.total, vatAmount: inv.vatAmount || '0',
          totalWithVat: inv.totalWithVat,
          positions: positions.map((p) => ({
            sortOrder: p.sortOrder, name: p.name,
            quantity: p.quantity, unit: p.unit,
            price: p.price, amount: p.amount,
          })),
        }
      );

      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    }
  );
}
