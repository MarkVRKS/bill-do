import { z } from 'zod';

// ===== RUSSIAN INN VALIDATION =====

function validateINN(inn: string): boolean {
  const digits = inn.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 12) return false;

  const weights10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const weights12 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

  function checksum(weights: number[], digits: string): number {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(digits[i], 10) * weights[i];
    }
    return (sum % 11) % 10;
  }

  if (digits.length === 10) {
    return checksum(weights10, digits) === parseInt(digits[9], 10);
  }
  const d11 = checksum(weights12, digits);
  const d12 =
    (d11 * 2 + 4 * parseInt(digits[0], 10) + 10 * parseInt(digits[1], 10) + 3 * parseInt(digits[2], 10) +
      5 * parseInt(digits[3], 10) + 9 * parseInt(digits[4], 10) + 4 * parseInt(digits[5], 10) +
      6 * parseInt(digits[6], 10) + 8 * parseInt(digits[7], 10)) %
    11 %
    10;
  return d11 === parseInt(digits[10], 10) && d12 === parseInt(digits[11], 10);
}

// ===== SCHEMAS =====

export const registerSchema = z.object({
  email: z.string().email('Некорректный email').max(255),
  password: z.string().min(8, 'Пароль должен быть не менее 8 символов').max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Пароль должен быть не менее 8 символов').max(128),
});

export const innField = z
  .string()
  .max(12)
  .refine(
    (val) => !val || (val.length !== 10 && val.length !== 12) || validateINN(val),
    { message: 'Некорректный ИНН (проверьте контрольную сумму)' }
  );

export const kppField = z.string().max(9);
export const ogrnField = z.string().max(15);
export const bikField = z.string().max(9);
export const accountField = z.string().max(20);

export const organizationSchema = z.object({
  name: z.string().min(1, 'Введите наименование организации').max(500),
  legalForm: z.string().max(50).optional().default('ООО'),
  inn: innField.optional().default(''),
  kpp: kppField.optional().default(''),
  ogrn: ogrnField.optional().default(''),
  ogrnip: ogrnField.optional().default(''),
  address: z.string().max(2000).optional().default(''),
  director: z.string().max(500).optional().default(''),
  accountant: z.string().max(500).optional().default(''),
  bankName: z.string().max(500).optional().default(''),
  bankBik: bikField.optional().default(''),
  bankCorr: accountField.optional().default(''),
  bankAccount: accountField.optional().default(''),
  downloadPath: z.string().max(1000).optional().default(''),
});

export const counterpartySchema = z.object({
  name: z.string().min(1, 'Введите наименование организации').max(500),
  address: z.string().max(2000).optional().default(''),
  ogrn: ogrnField.optional().default(''),
  inn: innField.optional().default(''),
  kpp: kppField.optional().default(''),
  basis: z.string().max(1000).optional().default(''),
  bases: z.array(z.string().max(1000)).optional().default([]),
  signer: z.string().max(500).optional().default(''),
});

export const positionSchema = z.object({
  name: z.string().min(1, 'Введите наименование').max(1000),
  quantity: z.coerce.number().positive('Количество должно быть больше 0'),
  unit: z.string().max(50).optional().default('шт.'),
  price: z.coerce.number().min(0, 'Цена не может быть отрицательной'),
});

export const invoiceSchema = z.object({
  number: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: ГГГГ-ММ-ДД'),
  counterpartyId: z.string().uuid().optional().nullable(),
  basis: z.string().max(1000).optional().default(''),
  bases: z.array(z.string().max(1000)).optional().default([]),
  signer: z.string().max(500).optional().default(''),
  serviceMonth: z.coerce.number().min(1).max(12),
  serviceYear: z.coerce.number().min(2020).max(2099),
  vatType: z.enum(['none', '0', '10', '20', '22']).default('none'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional().default('sent'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  positions: z.array(positionSchema).min(1, 'Добавьте хотя бы одну позицию'),
});
