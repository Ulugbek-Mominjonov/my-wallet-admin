import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Firestore qoidalari testlari (§10).
 *
 * DoD: «boshqa uid hech narsani o'qiy olmaydi» va «meta/health ga klient
 * yoza olmaydi».
 */
let testEnv: RulesTestEnvironment;

const OWNER = 'owner-uid';
const OTHER = 'other-uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-byudjet',
    firestore: {
      rules: readFileSync(
        fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
const otherDb = () => testEnv.authenticatedContext(OTHER).firestore();
const guestDb = () => testEnv.unauthenticatedContext().firestore();

const validExpense = {
  name: 'Internet',
  category: 'Kommunal',
  method: 'cash',
  planned: 200000,
  actual: null,
  dueDate: new Date(),
  monthKey: '2026-09',
  monthKeySource: 'auto',
  status: 'pending',
  debtId: null,
  recurringId: null,
  autoPay: false,
  note: '',
  source: 'manual',
};

describe('egalik', () => {
  it('egasi o\'z xarajatini yoza va o\'qiy oladi', async () => {
    const ref = doc(ownerDb(), `users/${OWNER}/expenses/e1`);
    await assertSucceeds(setDoc(ref, validExpense));
    await assertSucceeds(getDoc(ref));
  });

  it('BOSHQA uid hech narsani o\'qiy olmaydi', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), `users/${OWNER}/expenses/e1`),
        validExpense,
      );
    });
    await assertFails(
      getDoc(doc(otherDb(), `users/${OWNER}/expenses/e1`)),
    );
    await assertFails(
      getDoc(doc(otherDb(), `users/${OWNER}/meta/totals`)),
    );
  });

  it('boshqa uid yoza olmaydi', async () => {
    await assertFails(
      setDoc(doc(otherDb(), `users/${OWNER}/expenses/e2`), validExpense),
    );
  });

  it('kirmagan foydalanuvchi umuman o\'qiy olmaydi', async () => {
    await assertFails(
      getDoc(doc(guestDb(), `users/${OWNER}/expenses/e1`)),
    );
  });
});

describe('ma\'lumot tekshiruvi', () => {
  it('kasrli summa rad etiladi (pul butun son)', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/expenses/e3`), {
        ...validExpense,
        planned: 200000.5,
      }),
    );
  });

  it('noto\'g\'ri oy kaliti rad etiladi', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/expenses/e4`), {
        ...validExpense,
        monthKey: '2026-13',
      }),
    );
  });

  it('ruxsat etilmagan maydon rad etiladi', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/expenses/e5`), {
        ...validExpense,
        hacked: true,
      }),
    );
  });

  it('manfiy daromad rad etiladi', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/incomes/i1`), {
        amount: -100,
        type: 'Oylik',
        method: 'card',
        paidAt: new Date(),
        monthKey: '2026-09',
        note: '',
        debtId: null,
        source: 'manual',
      }),
    );
  });

  it('to\'g\'ri daromad qabul qilinadi', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), `users/${OWNER}/incomes/i2`), {
        amount: 12000000,
        type: 'Oylik',
        method: 'card',
        paidAt: new Date(),
        monthKey: '2026-08',
        note: '',
        debtId: null,
        source: 'manual',
      }),
    );
  });
});

describe('agregat hujjatlari', () => {
  it('klient oy agregatini yoza oladi (offline uchun ataylab)', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), `users/${OWNER}/months/2026-09`), {
        monthKey: '2026-09',
        income: 1000,
      }),
    );
  });

  it('noto\'g\'ri oy hujjati rad etiladi', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/months/buzuq`), { income: 1 }),
    );
  });

  it('meta/health ga KLIENT yoza olmaydi (faqat server)', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/meta/health`), {
        driftCount: 0,
      }),
    );
  });

  it('meta/health ni egasi o\'qiy oladi', async () => {
    await assertSucceeds(
      getDoc(doc(ownerDb(), `users/${OWNER}/meta/health`)),
    );
  });

  it('audit logga klient yoza olmaydi', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/auditLog/a1`), { action: 'x' }),
    );
  });
});

describe('boshqa yo\'llar', () => {
  it('ildizdagi hujjatlar taqiqlangan', async () => {
    await assertFails(setDoc(doc(ownerDb(), 'random/doc'), { a: 1 }));
  });

  it('boshqa foydalanuvchi hujjati taqiqlangan', async () => {
    await assertFails(getDoc(doc(ownerDb(), `users/${OTHER}/meta/totals`)));
  });
});
