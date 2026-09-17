/**
 * Sheets → JSON eksport (§11.1).
 *
 * Bu funksiyani mavjud `Code.gs` ga qo'shing va web-app sifatida
 * chiqaring. So'ng:
 *   curl "https://script.google.com/.../exec?action=export&k=KALIT" > export.json
 *
 * Kalit `kirishKalitiniYarat()` bilan yaratiladi — havolani bilgan
 * hamma ma'lumotni ko'rib qolmasligi uchun.
 */
function eksportJson_() {
  var ss = SpreadsheetApp.getActive();
  var zona = ss.getSpreadsheetTimeZone();

  function sana_(qiymat) {
    return sanami_(qiymat)
      ? Utilities.formatDate(qiymat, zona, 'yyyy-MM-dd')
      : '';
  }

  function qatorlar_(sheetNomi, boshQator, ustunSoni) {
    var sh = ss.getSheetByName(sheetNomi);
    if (!sh) return [];
    var oxirgi = sh.getLastRow();
    if (oxirgi < boshQator) return [];
    return sh
      .getRange(boshQator, 1, oxirgi - boshQator + 1, ustunSoni)
      .getValues();
  }

  var daromad = qatorlar_(SH.DAROMAD, 2, 7)
    .filter(function (r) { return String(r[2]).trim() !== ''; })
    .map(function (r) {
      return {
        monthKey: String(r[0]).trim(),
        paidAt: sana_(r[1]),
        type: String(r[2]).trim(),
        method: String(r[3]).trim() === 'Karta' ? 'card' : 'cash',
        amount: Math.round(Number(r[4]) || 0),
        note: String(r[5] || ''),
        debtName: String(r[6] || '').trim()
      };
    });

  var xarajat = qatorlar_(SH.XARAJAT, 2, 12)
    .filter(function (r) { return String(r[2]).trim() !== ''; })
    .map(function (r) {
      return {
        monthKey: String(r[0]).trim(),
        dueDate: sana_(r[1]),
        name: String(r[2]).trim(),
        category: String(r[3] || 'Boshqa').trim(),
        method: String(r[4]).trim() === 'Karta' ? 'card' : 'cash',
        // Bo'sh reja = "summasi o'zgaruvchi" — null bo'lib ketadi.
        planned: bosh_(r[5]) ? null : Math.round(Number(r[5]) || 0),
        actual: bosh_(r[6]) ? null : Math.round(Number(r[6]) || 0),
        note: String(r[7] || ''),
        debtName: String(r[9] || '').trim(),
        manualMonth: String(r[10] || '').trim(),
        autoPay: r[11] === true
      };
    });

  var ozim = qatorlar_(SH.OZIM, FOND_BOSH, 6)
    .filter(function (r) { return Number(r[2]) > 0; })
    .map(function (r) {
      return {
        monthKey: String(r[0]).trim(),
        spentAt: sana_(r[1]),
        amount: Math.round(Number(r[2]) || 0),
        purpose: String(r[3] || '').trim(),
        method: String(r[4]).trim() === 'Karta' ? 'card' : 'cash',
        note: String(r[5] || '')
      };
    });

  var qarz = qatorlar_(SH.QARZ, QARZ_BOSH, 9)
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return {
        name: String(r[0]).trim(),
        direction: String(r[1]).trim() === QARZ_TURLARI[1] ? 'owedToMe' : 'iOwe',
        total: Math.round(Number(r[2]) || 0),
        paidBefore: Math.round(Number(r[3]) || 0),
        monthly: Math.round(Number(r[6]) || 0),
        note: String(r[8] || '')
      };
    });

  var maqsad = qatorlar_(SH.MAQSAD, MAQSAD_BOSH, 8)
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return {
        name: String(r[0]).trim(),
        target: Math.round(Number(r[1]) || 0),
        saved: Math.round(Number(r[2]) || 0),
        monthly: bosh_(r[5]) ? null : Math.round(Number(r[5]) || 0),
        deadline: sana_(r[7])
      };
    });

  var sozlamalar = sozlamalarniOl_(ss);
  var hammasi = hammaXulosalar_();

  // Solishtirish uchun: Sheets O'ZI hisoblagan oylik yakunlar.
  var oylar = hammasi.oylar.map(function (oy) {
    var x = hammasi.oyMap[oy];
    return {
      monthKey: oy,
      income: Math.round(x.daromad),
      expense: Math.round(x.xarajat),
      balance: Math.round(x.qoldiq),
      saved: Math.round(x.orttirgan),
      personalAllocated: Math.round(x.ozim),
      personalSpent: Math.round(x.ozimSarf)
    };
  });

  return {
    version: 1,
    exportedAt: Utilities.formatDate(new Date(), zona, "yyyy-MM-dd'T'HH:mm:ss"),
    settings: {
      personalFund: {
        mode: sozlamalar.ozimUsul === 'Foiz' ? 'percent' : 'fixed',
        value: sozlamalar.ozimQiymat,
        method: sozlamalar.ozimTolovUsuli === 'Karta' ? 'card' : 'cash',
        day: sozlamalar.ozimKun
      },
      incomeRules: Object.keys(daromadQoidalari_(ss)).map(function (kalit) {
        return { type: kalit, shift: daromadQoidalari_(ss)[kalit] };
      }),
      limits: Object.keys(limitlarniOl_(ss)).map(function (nom) {
        return { category: nom, monthlyLimit: limitlarniOl_(ss)[nom] };
      }),
      recurring: doimiyXarajatlarniOl_(ss).map(function (d) {
        return {
          name: d.nomi,
          category: d.kategoriya,
          amount: d.reja === '' ? null : d.reja,
          method: d.usul === 'Karta' ? 'card' : 'cash',
          day: d.kun,
          autoPay: d.avto
        };
      }),
      quickAdd: tezTugmalarniOl_(ss).map(function (t) {
        return {
          name: t.nomi,
          amount: t.summa,
          category: t.kategoriya,
          method: t.usul === 'Karta' ? 'card' : 'cash'
        };
      }),
      reminders: eslatmaSozlamalari_(ss)
    },
    incomes: daromad,
    expenses: xarajat,
    personalSpends: ozim,
    debts: qarz,
    goals: maqsad,
    // Import to'g'riligini tekshirish uchun etalon.
    expectedMonths: oylar
  };
}
