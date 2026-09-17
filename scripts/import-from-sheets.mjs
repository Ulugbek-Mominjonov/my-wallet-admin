#!/usr/bin/env node
/**
 * Sheets JSON → Firestore (§11.2).
 *
 * Ishlatish:
 *   FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 key.json) \
 *   node scripts/import-from-sheets.mjs export.json --uid=UID [--dry]
 *
 * Muhim qoidalar:
 * 1. `monthKey` QAYTA HISOBLANMAYDI — Sheets allaqachon hisoblab qo'ygan
 *    qiymat saqlanadi, aks holda tarix o'zgarib ketardi (§11.2).
 * 2. Hujjatlar ≤500 talik batchlarda yoziladi.
 * 3. Oxirida `months` va `meta/totals` XOM YOZUVLARDAN noldan quriladi —
 *    delta emas, mutlaq qiymat.
 */
import { readFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import {
  buildMonthSummary,
  normalizeKey,
  totalsOf,
  DEFAULT_PERSONAL_CATEGORY_KEY,
} from '../packages/calc-ts/dist/index.js';

const BATCH_LIMIT = 450;

const args = argv.slice(2);
const file = args.find((value) => !value.startsWith('--'));
const uid = args.find((value) => value.startsWith('--uid='))?.slice(6);
const dryRun = args.includes('--dry');

if (!file || !uid) {
  console.error('Ishlatish: node import-from-sheets.mjs export.json --uid=UID');
  exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8'),
);
initializeApp({
  credential: cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  }),
});

const db = getFirestore();
const user = db.collection('users').doc(uid);
const data = JSON.parse(readFileSync(file, 'utf8'));

const parseDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/** Qarzlar avval yoziladi — bog'lanish uchun nom → id jadvali kerak. */
const debtIdByName = new Map();

const chunks = (items, size = BATCH_LIMIT) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const writeAll = async (label, items, build) => {
  let written = 0;
  for (const group of chunks(items)) {
    const batch = db.batch();
    for (const item of group) {
      const { ref, payload } = build(item);
      batch.set(ref, payload, { merge: true });
      written += 1;
    }
    if (!dryRun) await batch.commit();
  }
  console.log(`  ${label}: ${written} ta`);
  return written;
};

const statusOf = (expense) => {
  if ((expense.actual ?? 0) > 0) return 'paid';
  if (expense.planned !== null && expense.planned <= 0) return 'none';
  const due = parseDate(expense.dueDate);
  return due && due < new Date() ? 'overdue' : 'pending';
};

const run = async () => {
  console.log(`📥 Import → users/${uid}${dryRun ? ' (DRY RUN)' : ''}`);

  // 1. Qarzlar va maqsadlar
  await writeAll('Qarzlar', data.debts ?? [], (debt) => {
    const ref = user.collection('debts').doc();
    debtIdByName.set(normalizeKey(debt.name), ref.id);
    return {
      ref,
      payload: {
        name: debt.name,
        direction: debt.direction,
        total: debt.total,
        paidBefore: debt.paidBefore,
        monthly: debt.monthly,
        // Hisoblagichlar xom yozuvlardan qayta hisoblanadi (pastda).
        paidFromExpenses: 0,
        paidFromIncomes: 0,
        pendingFromApp: 0,
        note: debt.note ?? '',
        archived: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    };
  });

  await writeAll('Maqsadlar', data.goals ?? [], (goal, index = 0) => ({
    ref: user.collection('goals').doc(),
    payload: {
      name: goal.name,
      target: goal.target,
      saved: goal.saved,
      monthly: goal.monthly,
      deadline: parseDate(goal.deadline),
      order: index,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }));

  // 2. Yozuvlar
  const incomes = (data.incomes ?? []).map((income) => ({
    ...income,
    id: user.collection('incomes').doc().id,
    debtId: debtIdByName.get(normalizeKey(income.debtName ?? '')) ?? null,
  }));
  await writeAll('Daromadlar', incomes, (income) => ({
    ref: user.collection('incomes').doc(income.id),
    payload: {
      amount: income.amount,
      type: income.type,
      method: income.method,
      paidAt: parseDate(income.paidAt),
      monthKey: income.monthKey,
      note: income.note ?? '',
      debtId: income.debtId,
      source: 'imported',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }));

  const expenses = (data.expenses ?? []).map((expense) => ({
    ...expense,
    id: user.collection('expenses').doc().id,
    debtId: debtIdByName.get(normalizeKey(expense.debtName ?? '')) ?? null,
  }));
  await writeAll('Xarajatlar', expenses, (expense) => ({
    ref: user.collection('expenses').doc(expense.id),
    payload: {
      name: expense.name,
      category: expense.category,
      method: expense.method,
      planned: expense.planned,
      actual: expense.actual,
      dueDate: parseDate(expense.dueDate),
      monthKey: expense.monthKey,
      monthKeySource: expense.manualMonth ? 'manual' : 'auto',
      status: statusOf(expense),
      debtId: expense.debtId,
      autoPay: expense.autoPay === true,
      note: expense.note ?? '',
      source: 'imported',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }));

  const spends = (data.personalSpends ?? []).map((spend) => ({
    ...spend,
    id: user.collection('personalSpends').doc().id,
  }));
  await writeAll('Shaxsiy sarflar', spends, (spend) => ({
    ref: user.collection('personalSpends').doc(spend.id),
    payload: {
      amount: spend.amount,
      purpose: spend.purpose,
      method: spend.method,
      spentAt: parseDate(spend.spentAt),
      monthKey: spend.monthKey,
      note: spend.note ?? '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  }));

  // 3. Sozlamalar
  const settings = data.settings ?? {};
  if (!dryRun) {
    const batch = db.batch();
    batch.set(
      user.collection('settings').doc('personalFund'),
      settings.personalFund ?? {},
      { merge: true },
    );
    batch.set(
      user.collection('settings').doc('incomeRules'),
      { rules: settings.incomeRules ?? [] },
      { merge: true },
    );
    batch.set(
      user.collection('settings').doc('reminders'),
      settings.reminders ?? {},
      { merge: true },
    );
    for (const limit of settings.limits ?? []) {
      batch.set(user.collection('limits').doc(), limit);
    }
    for (const [index, item] of (settings.recurring ?? []).entries()) {
      batch.set(user.collection('recurring').doc(), {
        ...item,
        active: true,
        order: index,
      });
    }
    for (const [index, item] of (settings.quickAdd ?? []).entries()) {
      batch.set(user.collection('quickAdd').doc(), { ...item, order: index });
    }
    await batch.commit();
  }
  console.log('  Sozlamalar: yozildi');

  // 4. Agregatlarni NOLDAN qurish
  const personalCategoryKey = DEFAULT_PERSONAL_CATEGORY_KEY;
  const months = [
    ...new Set([
      ...incomes.map((item) => item.monthKey),
      ...expenses.map((item) => item.monthKey),
      ...spends.map((item) => item.monthKey),
    ]),
  ]
    .filter(Boolean)
    .sort();

  const summaries = months.map((monthKey) =>
    buildMonthSummary({
      monthKey,
      personalCategoryKey,
      incomes,
      expenses,
      personalSpends: spends,
    }),
  );

  if (!dryRun) {
    for (const group of chunks(summaries, 200)) {
      const batch = db.batch();
      for (const summary of group) {
        batch.set(user.collection('months').doc(summary.monthKey), {
          ...summary,
          version: 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Qarz hisoblagichlari — xom yozuvlardan.
    const debtBatch = db.batch();
    for (const [, debtId] of debtIdByName) {
      const fromExpenses = expenses
        .filter((item) => item.debtId === debtId && (item.actual ?? 0) > 0)
        .reduce((sum, item) => sum + (item.actual ?? 0), 0);
      const pending = expenses
        .filter((item) => item.debtId === debtId && (item.actual ?? 0) <= 0)
        .reduce((sum, item) => sum + (item.planned ?? 0), 0);
      const fromIncomes = incomes
        .filter((item) => item.debtId === debtId)
        .reduce((sum, item) => sum + item.amount, 0);
      debtBatch.set(
        user.collection('debts').doc(debtId),
        { paidFromExpenses: fromExpenses, paidFromIncomes: fromIncomes, pendingFromApp: pending },
        { merge: true },
      );
    }
    await debtBatch.commit();

    await user.collection('meta').doc('totals').set({
      ...totalsOf(summaries),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(`  Agregatlar: ${summaries.length} oy`);

  // 5. Sheets bilan solishtirish
  const expected = data.expectedMonths ?? [];
  let mismatches = 0;
  for (const month of expected) {
    const actual = summaries.find((item) => item.monthKey === month.monthKey);
    if (!actual) {
      console.error(`  ❌ ${month.monthKey}: Firestore'da yo'q`);
      mismatches += 1;
      continue;
    }
    const balance = actual.income - actual.expense;
    const saved = balance + actual.personalAllocated - actual.personalSpent;
    if (balance !== month.balance || saved !== month.saved) {
      console.error(
        `  ❌ ${month.monthKey}: qoldiq ${balance} (Sheets ${month.balance}), ` +
          `orttirgan ${saved} (Sheets ${month.saved})`,
      );
      mismatches += 1;
    }
  }

  if (mismatches === 0) {
    console.log(`✅ Solishtirish: ${expected.length} oy — hammasi mos`);
  } else {
    console.error(`❌ ${mismatches} oyda farq bor`);
    exit(2);
  }
};

run().catch((error) => {
  console.error(error);
  exit(1);
});
