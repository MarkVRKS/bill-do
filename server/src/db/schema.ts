import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  inet,
  jsonb,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ===== ENUMS =====

export const vatTypeEnum = pgEnum('vat_type', ['none', '0', '10', '20', '22']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'expired']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'cancelled', 'refunded']);
export const paymentTypeEnum = pgEnum('payment_type', ['subscription', 'one_time']);
export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member']);

// ===== USERS =====

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifyToken: varchar('email_verify_token', { length: 255 }),
  emailVerifyExpires: timestamp('email_verify_expires'),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  onboardingDone: boolean('onboarding_done').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== ORGANIZATIONS =====

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 500 }).notNull(),
  legalForm: varchar('legal_form', { length: 50 }).default('ООО'),
  inn: varchar('inn', { length: 12 }),
  kpp: varchar('kpp', { length: 9 }),
  ogrn: varchar('ogrn', { length: 15 }),
  ogrnip: varchar('ogrnip', { length: 15 }),
  address: text('address'),
  director: varchar('director', { length: 500 }),
  accountant: varchar('accountant', { length: 500 }),
  bankName: varchar('bank_name', { length: 500 }),
  bankBik: varchar('bank_bik', { length: 9 }),
  bankCorr: varchar('bank_corr', { length: 20 }),
  bankAccount: varchar('bank_account', { length: 20 }),
  logoUrl: varchar('logo_url', { length: 1000 }),
  signatureUrl: varchar('signature_url', { length: 1000 }),
  stampUrl: varchar('stamp_url', { length: 1000 }),
  downloadPath: varchar('download_path', { length: 1000 }).default(''),
  isActive: boolean('is_active').default(true).notNull(),
  nextInvoiceNumber: integer('next_invoice_number').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== USER ↔ ORGANIZATION =====

export const userOrganizations = pgTable(
  'user_organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 20 }).default('owner').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('user_org_unique').on(t.userId, t.organizationId)]
);

// ===== COUNTERPARTIES =====

export const counterparties = pgTable('counterparties', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  address: text('address'),
  ogrn: varchar('ogrn', { length: 15 }),
  inn: varchar('inn', { length: 12 }),
  kpp: varchar('kpp', { length: 9 }),
  basis: text('basis'),
  bases: jsonb('bases').$type<string[]>().default([]),
  signer: varchar('signer', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== INVOICES =====

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    number: varchar('number', { length: 50 }).notNull(),
    date: date('date').notNull(),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    basis: text('basis'),
    bases: jsonb('bases').$type<string[]>().default([]),
    signer: varchar('signer', { length: 500 }),
    serviceMonth: integer('service_month'),
    serviceYear: integer('service_year'),
    vatType: vatTypeEnum('vat_type').default('none').notNull(),
    status: invoiceStatusEnum('status').default('draft').notNull(),
    total: decimal('total', { precision: 15, scale: 2 }).default('0').notNull(),
    vatAmount: decimal('vat_amount', { precision: 15, scale: 2 }).default('0'),
    totalWithVat: decimal('total_with_vat', { precision: 15, scale: 2 }).default('0').notNull(),
    dueDate: date('due_date'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('invoice_org_number_unique').on(t.organizationId, t.number)]
);

// ===== INVOICE POSITIONS =====

export const invoicePositions = pgTable('invoice_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  sortOrder: integer('sort_order').notNull(),
  name: text('name').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).default('шт.').notNull(),
  price: decimal('price', { precision: 15, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
});

// ===== SUBSCRIPTION PLANS =====

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  priceKopeks: integer('price_kopeks').notNull(),
  monthlyInvoiceLimit: integer('monthly_invoice_limit'), // NULL = без лимита
  maxOrganizations: integer('max_organizations').default(1),
  features: jsonb('features'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ===== USER SUBSCRIPTIONS =====

export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum('status').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  yookassaSubscriptionId: varchar('yookassa_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== PAYMENTS =====

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id),
  amountKopeks: integer('amount_kopeks').notNull(),
  currency: varchar('currency', { length: 3 }).default('RUB'),
  status: paymentStatusEnum('status').notNull(),
  paymentType: paymentTypeEnum('payment_type').notNull(),
  description: text('description'),
  yookassaPaymentId: varchar('yookassa_payment_id', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== SESSIONS =====

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userAgent: text('user_agent'),
  ipAddress: inet('ip_address'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ===== RATE LIMITS =====

export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 255 }).primaryKey(),
  attempts: integer('attempts').default(1),
  windowStart: timestamp('window_start'),
});
