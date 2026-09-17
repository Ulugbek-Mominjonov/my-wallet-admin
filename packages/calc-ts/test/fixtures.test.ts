import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  buildMonthSummary,
  deltaForExpense,
  deltaForIncome,
  deltaForPersonalSpend,
  deltaToWire,
  summaryToWire,
} from '../src/index.js';
import type { Expense, Income, PersonalSpend } from '../src/index.js';

/**
 * ★ DoD: "packages/domain (Dart) va packages/calc-ts (TS) bir xil
 * fixture'larda bir xil natija beradi".
 *
 * Fayl Dart tomonidan yaratiladi:
 *   cd packages/domain && dart run tool/generate_fixtures.dart
 *
 * Shu sababli bu test ikki platforma o'rtasidagi driftni DARHOL ushlaydi:
 * agar Dart mantiqi o'zgarsa-yu TS porti o'zgarmasa, test qulaydi.
 */
const fixturePath = fileURLToPath(
  new URL('../../../testdata/aggregate-cases.json', import.meta.url),
);

interface DeltaCase {
  name: string;
  kind: 'expense' | 'income' | 'personalSpend';
  before: unknown;
  after: unknown;
  expected: unknown;
}

interface AggregateCase {
  name: string;
  monthKey: string;
  incomes: Income[];
  expenses: Expense[];
  personalSpends: PersonalSpend[];
  expected: unknown;
}

interface Fixtures {
  version: number;
  personalCategoryKey: string;
  deltaCases: DeltaCase[];
  aggregateCases: AggregateCase[];
}

const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixtures;

describe('umumiy fixture: delta holatlari', () => {
  it('fixture fayli topildi', () => {
    expect(fixtures.deltaCases.length).toBeGreaterThan(0);
  });

  for (const item of fixtures.deltaCases) {
    it(`${item.kind}: ${item.name}`, () => {
      const delta =
        item.kind === 'expense'
          ? deltaForExpense(
              item.before as Expense | null,
              item.after as Expense | null,
              fixtures.personalCategoryKey,
            )
          : item.kind === 'income'
            ? deltaForIncome(
                item.before as Income | null,
                item.after as Income | null,
              )
            : deltaForPersonalSpend(
                item.before as PersonalSpend | null,
                item.after as PersonalSpend | null,
              );
      expect(deltaToWire(delta)).toEqual(item.expected);
    });
  }
});

describe('umumiy fixture: agregat holatlari', () => {
  it('kamida 40 ta tasodifiy holat', () => {
    expect(fixtures.aggregateCases.length).toBeGreaterThanOrEqual(40);
  });

  for (const item of fixtures.aggregateCases) {
    it(`agregat: ${item.name}`, () => {
      const summary = buildMonthSummary({
        monthKey: item.monthKey,
        personalCategoryKey: fixtures.personalCategoryKey,
        incomes: item.incomes,
        expenses: item.expenses,
        personalSpends: item.personalSpends,
      });
      expect(summaryToWire(summary)).toEqual(item.expected);
    });
  }
});
