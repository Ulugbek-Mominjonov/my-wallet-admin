'use server';

import {
  expenseMonthKey,
  incomeMonthKey,
  paymentStatus,
  type Expense,
  type Income,
  DEFAULT_PERSONAL_CATEGORY_KEY,
  normalizeKey,
} from '@byudjet/calc';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { refs } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/session';
import {
  commitBulkPaid,
  commitExpenseChange,
  commitIncomeChange,
} from './writer';
import { getSettings, listTag, monthTag } from './queries';

/**
 * Server Action'lar — brauzerga Firestore'ga yozish huquqi BERILMAYDI.
 *
 * Har bir action:
 * 1. sessiyani tekshiradi (`requireUser`),
 * 2. kirishni `zod` bilan validatsiya qiladi,
 * 3. yozuvni bitta batchda bajaradi (delta bilan),
 * 4. FAQAT tegishli kesh tegini yangilaydi — butun keshni emas (§12.5).
 */

const moneySchema = z.coerce.number().int().min(0);

const expenseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nom to'ldirilishi shart"),
  category: z.string().trim().min(1, 'Kategoriya kerak'),
  method: z.enum(['card', 'cash']),
  planned: moneySchema.nullable().optional(),
  actual: moneySchema.nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri"),
  manualMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable()
    .optional(),
  debtId: z.string().nullable().optional(),
  autoPay: z.boolean().optional(),
});

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
}

const personalKey = async (uid: string): Promise<string> => {
  const settings = await getSettings(uid);
  const category = settings.app.personalCategory as string | undefined;
  return category ? normalizeKey(category) : DEFAULT_PERSONAL_CATEGORY_KEY;
};

const refreshMonth = (uid: string, ...months: string[]): void => {
  for (const month of new Set(months.filter(Boolean))) {
    revalidateTag(monthTag(uid, month));
  }
  revalidateTag(listTag(uid, 'totals'));
  revalidateTag(listTag(uid, 'months'));
};

export async function saveExpense(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Xato' };
  }
  const data = parsed.data;
  if (data.planned == null && data.actual == null) {
    return {
      ok: false,
      message: "Reja yoki fakt summasidan kamida bittasi to'ldirilsin",
    };
  }

  const store = refs(user.uid);
  const id = data.id ?? store.expenses.doc().id;
  const before = data.id ? await loadExpense(user.uid, data.id) : null;
  const monthKey = expenseMonthKey(data.dueDate, data.manualMonth ?? null);

  const after: Expense = {
    id,
    name: data.name,
    category: data.category,
    method: data.method,
    planned: data.planned ?? null,
    actual: data.actual ?? null,
    dueDate: data.dueDate,
    monthKey,
    monthKeySource: data.manualMonth ? 'manual' : 'auto',
    debtId: data.debtId ?? null,
    autoPay: data.autoPay ?? false,
    status: paymentStatus(
      data.planned ?? null,
      data.actual ?? null,
      data.dueDate,
      new Date(),
    ),
  };

  await commitExpenseChange(user.uid, user.uid, {
    before,
    after,
    personalCategoryKey: await personalKey(user.uid),
  });
  refreshMonth(user.uid, monthKey, before?.monthKey ?? '');
  return { ok: true, message: '✅ Saqlandi' };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const before = await loadExpense(user.uid, id);
  if (!before) return { ok: false, message: 'Yozuv topilmadi' };

  await commitExpenseChange(user.uid, user.uid, {
    before,
    after: null,
    personalCategoryKey: await personalKey(user.uid),
  });
  refreshMonth(user.uid, before.monthKey);
  return { ok: true, message: "🗑 O'chirildi" };
}

/** ★ Bulk "To'landi" — 40 ta to'lov = 1 batch. */
export async function markManyPaid(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (ids.length === 0) return { ok: false, message: 'Hech narsa tanlanmadi' };

  const store = refs(user.uid);
  const documents = await store.expenses.where('__name__', 'in', ids.slice(0, 30)).get();
  const items = documents.docs
    .map((doc) => {
      const data = doc.data();
      const planned = data.planned == null ? null : Number(data.planned);
      if (!planned || planned <= 0) return null;
      return {
        before: {
          id: doc.id,
          name: String(data.name ?? ''),
          category: String(data.category ?? ''),
          method: data.method === 'card' ? 'card' : 'cash',
          planned,
          actual: data.actual == null ? null : Number(data.actual),
          dueDate: '1970-01-01',
          monthKey: String(data.monthKey ?? ''),
          debtId: data.debtId ?? null,
        } as Expense,
        amount: planned,
      };
    })
    .filter((item): item is { before: Expense; amount: number } => item !== null);

  const result = await commitBulkPaid(
    user.uid,
    user.uid,
    items,
    await personalKey(user.uid),
  );
  refreshMonth(user.uid, ...items.map((item) => item.before.monthKey));
  return {
    ok: true,
    message: `✅ ${result.updated} ta to'lov belgilandi (${result.batches} batch)`,
  };
}

const incomeSchema = z.object({
  id: z.string().optional(),
  amount: z.coerce.number().int().positive('Summa musbat bo\'lsin'),
  type: z.string().trim().min(1),
  method: z.enum(['card', 'cash']),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  debtId: z.string().nullable().optional(),
});

export async function saveIncome(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Xato' };
  }
  const data = parsed.data;
  const settings = await getSettings(user.uid);
  const store = refs(user.uid);
  const id = data.id ?? store.incomes.doc().id;
  const before = data.id ? await loadIncome(user.uid, data.id) : null;

  const after: Income = {
    id,
    amount: data.amount,
    type: data.type,
    method: data.method,
    paidAt: data.paidAt,
    monthKey: incomeMonthKey(data.paidAt, data.type, settings.incomeRules),
    debtId: data.debtId ?? null,
  };

  await commitIncomeChange(user.uid, user.uid, { before, after });
  refreshMonth(user.uid, after.monthKey, before?.monthKey ?? '');
  return { ok: true, message: '✅ Saqlandi' };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const before = await loadIncome(user.uid, id);
  if (!before) return { ok: false, message: 'Yozuv topilmadi' };
  await commitIncomeChange(user.uid, user.uid, { before, after: null });
  refreshMonth(user.uid, before.monthKey);
  return { ok: true, message: "🗑 O'chirildi" };
}

const rulesSchema = z.object({
  rules: z.array(
    z.object({ type: z.string().min(1), shift: z.number().int().min(-1).max(0) }),
  ),
});

export async function saveIncomeRules(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Qoidalar noto\'g\'ri' };

  await refs(user.uid)
    .settings.doc('incomeRules')
    .set({ rules: parsed.data.rules }, { merge: true });
  revalidateTag(listTag(user.uid, 'settings'));
  return {
    ok: true,
    message: "✅ Qoida saqlandi — eski yozuvlarni ko'chirish uchun "
      + "'Qayta joylash' tugmasini bosing",
  };
}

async function loadExpense(uid: string, id: string): Promise<Expense | null> {
  const doc = await refs(uid).expenses.doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  const dueDate = data.dueDate?.toDate?.() as Date | undefined;
  return {
    id: doc.id,
    name: String(data.name ?? ''),
    category: String(data.category ?? ''),
    method: data.method === 'card' ? 'card' : 'cash',
    planned: data.planned == null ? null : Number(data.planned),
    actual: data.actual == null ? null : Number(data.actual),
    dueDate: dueDate
      ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`
      : '1970-01-01',
    monthKey: String(data.monthKey ?? ''),
    monthKeySource: data.monthKeySource === 'manual' ? 'manual' : 'auto',
    debtId: data.debtId ?? null,
    autoPay: data.autoPay === true,
    status: data.status ?? 'pending',
  };
}

async function loadIncome(uid: string, id: string): Promise<Income | null> {
  const doc = await refs(uid).incomes.doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  const paidAt = data.paidAt?.toDate?.() as Date | undefined;
  return {
    id: doc.id,
    amount: Number(data.amount ?? 0),
    type: String(data.type ?? ''),
    method: data.method === 'card' ? 'card' : 'cash',
    paidAt: paidAt
      ? `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}-${String(paidAt.getDate()).padStart(2, '0')}`
      : '1970-01-01',
    monthKey: String(data.monthKey ?? ''),
    debtId: data.debtId ?? null,
  };
}
