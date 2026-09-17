import { describe, expect, it } from 'vitest';

import {
  addDelta,
  buildMonthSummary,
  compareSummaries,
  debtView,
  deltaDocumentCount,
  deltaForExpense,
  emptySummary,
  expenseMonthKey,
  forecast,
  goalView,
  incomeMonthKey,
  mergeDeltas,
  paymentStatus,
  personalFundPlan,
  reminderBuckets,
  savedOf,
  savingsSeries,
  shouldAutoPay,
  totalsOf,
} from '../src/index.js';
import type { Debt, Expense, IncomeRule } from '../src/index.js';

const rules: IncomeRule[] = [
  { type: 'Avans', shift: 0 },
  { type: 'Oylik', shift: -1 },
  { type: 'KPI', shift: -1 },
  { type: "Qo'shimcha", shift: -1 },
];

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  name: 'Test',
  category: 'Oziq-ovqat',
  method: 'cash',
  planned: 300000,
  actual: null,
  dueDate: '2026-09-15',
  monthKey: '2026-09',
  ...overrides,
});

describe('§2.1 daromadning tegishli oyi', () => {
  it('1-sentabrdagi oylik → avgust', () => {
    expect(incomeMonthKey('2026-09-01', 'Oylik', rules)).toBe('2026-08');
  });

  it('avans joriy oyda qoladi', () => {
    expect(incomeMonthKey('2026-09-16', 'Avans', rules)).toBe('2026-09');
  });

  it("noma'lum tur — joriy oy", () => {
    expect(incomeMonthKey('2026-09-16', 'Sovgʻa', rules)).toBe('2026-09');
  });

  it('yanvardagi oylik → o\'tgan yil dekabri', () => {
    expect(incomeMonthKey('2026-01-02', 'oylik', rules)).toBe('2025-12');
  });
});

describe('§2.2 xarajatning tegishli oyi', () => {
  it('sanadan olinadi', () => {
    expect(expenseMonthKey('2026-10-05')).toBe('2026-10');
  });

  it("qo'lda ko'rsatilgan oy ustun", () => {
    expect(expenseMonthKey('2026-10-05', '2026-09')).toBe('2026-09');
  });
});

describe('§2.6 holat va avto to\'lov', () => {
  const today = new Date(2026, 8, 16);

  it('fakt bor — to\'landi', () => {
    expect(paymentStatus(100, 90, '2026-09-01', today)).toBe('paid');
  });

  it('sana o\'tgan — muddati o\'tdi', () => {
    expect(paymentStatus(100, null, '2026-09-15', today)).toBe('overdue');
  });

  it('bugun — hali kechikmagan', () => {
    expect(paymentStatus(100, null, '2026-09-16', today)).toBe('pending');
  });

  it("summasi noma'lum — baribir kuzatiladi", () => {
    expect(paymentStatus(null, null, '2026-09-20', today)).toBe('pending');
  });

  it('reja aniq nol — kuzatilmaydi', () => {
    expect(paymentStatus(0, null, '2026-09-01', today)).toBe('none');
  });

  it('avto to\'lov sanasi kelganda ishlaydi', () => {
    expect(
      shouldAutoPay(expense({ autoPay: true, dueDate: '2026-09-10' }), today),
    ).toBe(true);
    expect(
      shouldAutoPay(expense({ autoPay: true, dueDate: '2026-09-25' }), today),
    ).toBe(false);
    expect(
      shouldAutoPay(
        expense({ autoPay: true, planned: null, dueDate: '2026-09-10' }),
        today,
      ),
    ).toBe(false);
  });
});

describe('§2.10 "O\'zim uchun" rejasi', () => {
  it('foiz rejimi mingga yaxlitlanadi', () => {
    expect(personalFundPlan(12_345_678, 'percent', 10)).toBe(1_235_000);
  });

  it('yaxlitlash bir marta bajariladi', () => {
    expect(personalFundPlan(1_499_600, 'percent', 10)).toBe(150_000);
  });

  it("qat'iy rejim", () => {
    expect(personalFundPlan(12_000_000, 'fixed', 800_000)).toBe(800_000);
  });
});

describe('§2.7 qarzlar', () => {
  const today = new Date(2026, 8, 16);
  const base: Debt = {
    id: 'd1',
    name: 'Mashina',
    direction: 'iOwe',
    total: 50_000_000,
    paidBefore: 10_000_000,
    monthly: 5_000_000,
    paidFromExpenses: 5_000_000,
    paidFromIncomes: 999,
    pendingFromApp: 0,
  };

  it('men qarzdorman — xarajat kamaytiradi', () => {
    const view = debtView(base, today);
    expect(view.applied).toBe(5_000_000);
    expect(view.remaining).toBe(35_000_000);
    expect(view.monthsLeft).toBe(7);
    expect(view.finishMonth).toBe('2027-04');
  });

  it('menga qarzdor — daromad kamaytiradi', () => {
    const view = debtView(
      { ...base, direction: 'owedToMe', paidFromIncomes: 40_000_000 },
      today,
    );
    expect(view.remaining).toBe(0);
    expect(view.finishMonth).toBeNull();
  });
});

describe('§2.8 maqsadlar', () => {
  it('progress va oylar', () => {
    const view = goalView(
      { id: 'g1', name: 'Sayohat', target: 20_000_000, saved: 5_000_000 },
      3_000_000,
    );
    expect(view.remaining).toBe(15_000_000);
    expect(view.progress).toBe(0.25);
    expect(view.perMonth).toBe(3_000_000);
    expect(view.monthsLeft).toBe(5);
  });
});

describe('§2.9 prognoz', () => {
  it('joriy oyda kunlik sur\'atga qarab hisoblanadi', () => {
    const month = {
      ...emptySummary('2026-09'),
      income: 6_000_000,
      expense: 3_000_000,
    };
    const result = forecast(
      month,
      { income: 30_000_000, expense: 20_000_000, personalAllocated: 0, personalSpent: 0 },
      3,
      new Date(2026, 8, 15),
      30,
    );
    expect(result.dailyBurn).toBe(200_000);
    expect(result.monthEndSpend).toBe(6_000_000);
    expect(result.expectedIncome).toBe(12_000_000);
  });
});

describe('§2.5 jamg\'arma', () => {
  it('xronologik prefix-sum', () => {
    const series = savingsSeries([
      { ...emptySummary('2026-09'), income: 300, expense: 100 },
      { ...emptySummary('2026-07'), income: 100, expense: 40 },
      { ...emptySummary('2026-08'), income: 200, expense: 250 },
    ]);
    expect(series.points.map((point) => point.cumulative)).toEqual([60, 10, 210]);
    expect(series.total).toBe(210);
  });
});

describe('eslatma guruhlari', () => {
  it('kechikkan / bugungi / yaqin', () => {
    const buckets = reminderBuckets(
      [
        expense({ id: 'a', dueDate: '2026-09-10' }),
        expense({ id: 'b', dueDate: '2026-09-16' }),
        expense({ id: 'c', dueDate: '2026-09-18' }),
        expense({ id: 'd', dueDate: '2026-09-25' }),
        expense({ id: 'e', dueDate: '2026-09-11', actual: 100 }),
        expense({ id: 'f', dueDate: '2026-09-12', planned: 0 }),
      ],
      new Date(2026, 8, 16),
      3,
    );
    expect(buckets.overdue.map((item) => item.id)).toEqual(['a']);
    expect(buckets.dueToday.map((item) => item.id)).toEqual(['b']);
    expect(buckets.upcoming.map((item) => item.id)).toEqual(['c']);
  });
});

describe('agregat va delta', () => {
  const personal = "o'zim uchun";

  it('40 ta to\'lov bitta agregat deltasiga yig\'iladi', () => {
    const deltas = Array.from({ length: 40 }, (_, index) =>
      deltaForExpense(
        expense({ id: `e${index}`, planned: 1000 }),
        expense({ id: `e${index}`, planned: 1000, actual: 1000 }),
        personal,
      ),
    );
    const merged = mergeDeltas(deltas);
    expect(deltaDocumentCount(merged)).toBe(2);
    expect(merged.months['2026-09']?.expense).toBe(40_000);
  });

  it('qo\'shish + o\'chirish = nol', () => {
    const item = expense({ actual: 500 });
    const sum = addDelta(
      deltaForExpense(null, item, personal),
      deltaForExpense(item, null, personal),
    );
    expect(deltaDocumentCount(sum)).toBe(0);
  });

  it('orttirgan = qoldiq + ajratma − shaxsiy sarf', () => {
    const summary = buildMonthSummary({
      monthKey: '2026-09',
      personalCategoryKey: personal,
      incomes: [
        {
          id: 'i1',
          amount: 10_000_000,
          type: 'Oylik',
          method: 'card',
          paidAt: '2026-09-01',
          monthKey: '2026-09',
        },
      ],
      expenses: [
        expense({
          id: 'x1',
          category: "O'zim uchun",
          planned: 1_000_000,
          actual: 1_000_000,
        }),
      ],
      personalSpends: [
        {
          id: 'p1',
          amount: 400_000,
          purpose: 'Kitob',
          method: 'cash',
          spentAt: '2026-09-20',
          monthKey: '2026-09',
        },
      ],
    });
    expect(savedOf(summary)).toBe(9_600_000);
    expect(totalsOf([summary]).personalAllocated).toBe(1_000_000);
  });

  it('reconciler farqni topadi', () => {
    const stored = { ...emptySummary('2026-09'), income: 999 };
    const computed = { ...emptySummary('2026-09'), income: 1000 };
    const drift = compareSummaries(stored, computed);
    expect(drift.fields).toEqual([
      { field: 'income', stored: 999, computed: 1000 },
    ]);
  });
});
