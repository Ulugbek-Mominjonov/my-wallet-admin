/**
 * 💰 OYLIK BYUDJET — Google Sheets app
 *
 * Sheetlar:
 *   Sozlamalar — doimiy (har oylik) xarajatlar ro'yxati va "o'zim uchun" qoidasi
 *   Daromad    — har bir tushum: avans / oylik / KPI / qo'shimcha × karta / naqd
 *   Xarajat    — har bir to'lov: reja (kutilayotgan) va fakt (to'langan)
 *   Hisobot    — tanlangan oy bo'yicha total, qoldiq, karta/naqd kesimi
 *   Yillik     — oylar kesimidagi umumiy ko'rinish + diagramma
 *   Ro'yxat    — dropdown ro'yxatlari (turlar, usullar, kategoriyalar, oylar)
 *
 * Ma'lumot bitta tekis jadvalda (Daromad / Xarajat) saqlanadi, hisobotlar
 * SUMIFS/QUERY orqali hisoblanadi — har oyga alohida sheet ochilmaydi.
 */

/** ===================== Konstantalar ===================== */

var SH = {
  SOZLAMALAR: 'Sozlamalar',
  DAROMAD: 'Daromad',
  XARAJAT: 'Xarajat',
  HISOBOT: 'Hisobot',
  YILLIK: 'Yillik',
  OZIM: "O'zim uchun",
  JAMGARMA: "Jamg'arma",
  QARZ: 'Qarzlar',
  MAQSAD: 'Maqsadlar',
  ROYXAT: "Ro'yxat"
};

var Q_US = { NOMI: 1, TURI: 2, UMUMIY: 3, OLDIN: 4, ILOVADAN: 5, QOLGAN: 6, OYLIK: 7, TUGASH: 8, IZOH: 9 };
var M_US = { NOMI: 1, KERAK: 2, YIGILGAN: 3, QOLGAN: 4, FOIZ: 5, OYIGA: 6, PROGNOZ: 7, MUDDAT: 8 };
var QARZ_BOSH = 9;
var MAQSAD_BOSH = 5;    // sarlavha 4-qatorda
var QARZ_TURLARI = ['Men qarzdorman', 'Menga qarzdor'];

// Sozlamalar sheetidagi qo'shimcha bloklar
var SOZ_ESLATMA = { TELEGRAM: 'I3', EMAIL: 'I4', KUN: 'I5', SOAT: 'I6', OYLIK: 'I7', HISOBOT_KUNI: 'I8' };
var SOZ_LIMIT_BOSH = 12;   // H ustuni: kategoriya, I: oylik limit
var SOZ_TEZ_BOSH = 12;     // K ustuni: nomi, L: summa, M: kategoriya, N: usul
var SOZ_TEGISHLI_BOSH = 12; // P ustuni: daromad turi, Q: tegishli oy
var TEGISHLI_JORIY = 'Joriy oy';
var TEGISHLI_OLDINGI = 'Oldingi oy';

// Ustun raqamlari (1 dan boshlanadi)
var D_US = { OY: 1, SANA: 2, TUR: 3, USUL: 4, SUMMA: 5, IZOH: 6, QARZ: 7 };
// O'zim uchun (shaxsiy fond) va Jamg'arma (umumiy fond) daftarlari
var O_US = { OY: 1, SANA: 2, SUMMA: 3, MAQSAD: 4, USUL: 5, IZOH: 6 };
var JG_US = { OY: 1, DAROMAD: 2, XARAJAT: 3, QOLDIQ: 4, TOPLANGAN: 5 };
var FOND_BOSH = 9;        // O'zim uchun daftarining birinchi qatori
var JAMGARMA_BOSH = 8;    // Jamg'arma jadvalining birinchi qatori (avtomatik to'ladi)
var X_US = {
  OY: 1, SANA: 2, JOY: 3, KATEGORIYA: 4, USUL: 5, REJA: 6, FAKT: 7, IZOH: 8, HOLAT: 9,
  QARZ: 10, TEGISHLI: 11, AVTO: 12
};

// Sozlamalar sheetidagi joylashuvlar
var SOZ = { OZIM_USUL: 'B4', OZIM_QIYMAT: 'B5', OZIM_TOLOV: 'B6', OZIM_KUN: 'B7', DOIMIY_BOSH: 11 };

var OZIM_KATEGORIYA = "O'zim uchun";
// Sheet sarlavhalari — YAGONA MANBA: quruvchilar ham, tekshiruv ham shundan oladi
var SARLAVHALAR = {
  DAROMAD: { qator: 1, diapazon: 'A1:G1', ustunlar: [
    'Tegishli oy (avto)', 'Olingan sana', 'Tur', "To'lov usuli", 'Summa', 'Izoh', 'Haq / qarz (ixtiyoriy)'] },
  XARAJAT: { qator: 1, diapazon: 'A1:L1', ustunlar: [
    'Tegishli oy (avto)', "To'lov sanasi", 'Joy / nomi', 'Kategoriya', "To'lov usuli", 'Reja', 'Fakt',
    'Izoh', 'Holat (avto)', 'Qarz / haq (ixtiyoriy)', "Tegishli oy (qo'lda)", "Avto to'lov"] },
  OZIM: { qator: 8, diapazon: 'A8:F8', ustunlar: [
    'Oy (avto)', 'Sana', 'Summa', 'Nima uchun', "To'lov usuli", 'Izoh'] },
  JAMGARMA: { qator: 7, diapazon: 'A7:E7', ustunlar: [
    'Oy', 'Daromad', 'Xarajat (fakt)', 'Shu oy qolgan', "To'plangan (jami)"] },
  QARZ: { qator: 8, diapazon: 'A8:I8', ustunlar: [
    'Nomi', 'Turi', 'Umumiy summa', "Oldin to'langan", "Ilovadan to'langan (avto)",
    'Qolgan (avto)', "Oylik to'lov", 'Tugash (avto)', 'Izoh'] },
  MAQSAD: { qator: 4, diapazon: 'A4:H4', ustunlar: [
    'Maqsad', 'Kerakli summa', "Yig'ilgan", 'Qolgan (avto)', 'Progress (avto)',
    'Oyiga ajratma', 'Prognoz (avto)', 'Muddat'] }
};

var HISOBOT_TURLARI = ['Avans', 'Oylik', 'KPI', "Qo'shimcha"];
var OZIM_NOMI = "O'zim uchun (ajratma)";
var PUL = '#,##0';
var PUL_UZUN = '#,##0" so\'m"';
var SANA_FORMAT = 'dd.MM.yyyy';
var TUZILMA_VERSIYASI = '18';   // sheet maketi o'zgarganda oshiriladi
var SKRIPT_VERSIYASI = "v28 (sarlavha tekshiruvi, 2026-09-16)";
var OY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

var RANG = {
  BOLIM_FON: '#E8EAF6',
  BOLIM_MATN: '#1A237E',
  SARLAVHA_FON: '#37474F',
  DAROMAD: '#E8F5E9',
  XARAJAT: '#FFEBEE',
  TANLOV: '#FFF9C4'
};

/** ===================== Menyu ===================== */

/**
 * Qator o'chirish/qo'shish kabi tuzilma o'zgarishlari uchun (onEdit bularni ushlamaydi).
 * Faqat foydalanuvchi qilgan tuzilma o'zgarishlariga javob beradi — skript yozuvlari
 * EDIT/OTHER turida keladi, shuning uchun takroriy chaqiruv bo'lmaydi.
 */
function tuzilmaOzgardi(e) {
  var turlar = ['REMOVE_ROW', 'INSERT_ROW', 'REMOVE_COLUMN', 'INSERT_COLUMN'];
  if (!e || turlar.indexOf(e.changeType) === -1) return;
  hisobotniYangilash();
}

function triggerlarniOrnat_() {
  var ss = SpreadsheetApp.getActive();
  var soz = eslatmaSozlamalari_(ss);
  var props = PropertiesService.getDocumentProperties();
  var triggerlar = ScriptApp.getProjectTriggers();
  var bor = function (nom) {
    return triggerlar.some(function (t) { return t.getHandlerFunction() === nom; });
  };

  if (!bor('tuzilmaOzgardi')) {
    ScriptApp.newTrigger('tuzilmaOzgardi').forSpreadsheet(ss).onChange().create();
  }

  // Eslatma soati o'zgargan bo'lsa triggerni qayta yaratamiz
  var kalit = soz.soat + ':' + soz.hisobotKuni;
  var soatOzgardi = props.getProperty('eslatmaSoati') !== kalit;
  if (soatOzgardi) {
    triggerlar.forEach(function (t) {
      var nom = t.getHandlerFunction();
      if (nom === 'kunlikEslatma' || nom === 'oylikHisobotYubor') ScriptApp.deleteTrigger(t);
    });
  }
  if (soatOzgardi || !bor('kunlikEslatma')) {
    ScriptApp.newTrigger('kunlikEslatma').timeBased().everyDays(1).atHour(soz.soat).create();
  }
  if (soatOzgardi || !bor('oylikHisobotYubor')) {
    ScriptApp.newTrigger('oylikHisobotYubor').timeBased()
      .onMonthDay(soz.hisobotKuni).atHour(soz.soat).create();
  }
  props.setProperty('eslatmaSoati', kalit);
}

/** Jadvalda qo'lda yozuv qo'shilganda hisobot o'zi yangilanadi. */
/** Jadvalda qo'lda yozuv qo'shilganda hisobot o'zi yangilanadi. */
function onEdit(e) {
  if (!e || !e.range) return;
  var nom = e.range.getSheet().getName();
  var muhim = nom === SH.DAROMAD || nom === SH.XARAJAT || nom === SH.OZIM || nom === SH.JAMGARMA ||
    nom === SH.QARZ || nom === SH.MAQSAD ||
    (nom === SH.HISOBOT && e.range.getA1Notation() === 'B2');
  if (!muhim) return;

  yopilganOgohlantir_(e, nom);
  hisobotniYangilash();
}

/** Yopilgan oydagi qator o'zgartirilsa ogohlantiradi (bloklamaydi). */
function yopilganOgohlantir_(e, sheetNomi) {
  if (sheetNomi !== SH.DAROMAD && sheetNomi !== SH.XARAJAT) return;
  var qator = e.range.getRow();
  if (qator < 2) return;
  var oy = String(e.range.getSheet().getRange(qator, 1).getValue()).trim();
  if (!yopilganOylar_()[oy]) return;
  SpreadsheetApp.getActive().toast(
    oy + " oyi yopilgan deb belgilangan, lekin o'zgartirish kiritildi — hisobot qayta hisoblandi.",
    '🔒 Diqqat', 8);
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('💰 Byudjet')
    .addItem('🚀 Dastlabki sozlash', 'dastlabkiSozlash')
    .addSeparator()
    .addItem('📅 Yangi oy ochish', 'yangiOyOchish')
    .addItem("➕ Yozuv qo'shish (daromad / xarajat)", 'formaOch')
    .addItem('🔄 Hisobotni yangilash', 'hisobotniYangilash')
    .addSeparator()
    .addItem('🔒 Oyni yopish', 'oyniYopish')
    .addItem('🔓 Oyni qayta ochish', 'oyniQaytaOchish')
    .addSubMenu(ui.createMenu('⚙️ Sozlash')
      .addItem('🤖 Telegram sozlash', 'telegramSozlash')
      .addItem('📨 Test xabar yuborish', 'testXabar')
      .addItem('🔔 Eslatmani hozir tekshirish', 'eslatmaniHozirTekshir')
      .addItem('📊 Oylik hisobotni hozir yuborish', 'oylikHisobotniHozirYubor')
      .addItem("🔄 Ro'yxatlarni yangilash", 'royxatlarniYangilash')
      .addItem('📱 Telefon uchun havola', 'telefonHavolasi')
      .addItem('🔗 Havolani saqlash / yangilash', 'havolaniSaqla')
      .addItem('📲 Havolani Telegramga yuborish', 'havolaniYubor')
      .addItem('🔑 Kirish kaliti yaratish (mobil uchun)', 'kirishKalitiniYarat')
      .addItem("🔓 Kirish kalitini o'chirish", 'kirishKalitiniOchir'))
    .addSeparator()
    .addItem('🩺 Tekshirish va tuzatish', 'tashxis')
    .addItem('ℹ️ Yordam', 'yordam')
    .addToUi();

  // Mobil Sheets ilovasida qo'shilgan qatorlar uchun: ochilganda bir marta yangilaymiz.
  try {
    hisobotniYangilash();
  } catch (e) {
    Logger.log('Ochilishda yangilash xatosi: ' + e.message);
  }
}

/** Web app havolasini ko'rsatadi — telefonning bosh ekraniga qo'shish uchun. */
/** Web app havolasini ko'rsatadi — telefonning bosh ekraniga qo'shish uchun. */
/** Web app havolasini ko'rsatadi — telefonning bosh ekraniga qo'shish uchun. */
function telefonHavolasi() {
  var ui = SpreadsheetApp.getUi();
  var holat = webAppHolati_();

  // Havola yo'q yoki ishlamayapti — qo'lda kiritishni so'raymiz
  if (!holat.ishlaydi) {
    var xabar = holat.saqlangan || holat.url
      ? '⚠️ Saqlangan havola ochilmadi (' + holat.sabab + ').'
      : 'ℹ️ Ilova havolasi hali kiritilmagan.';
    ui.alert('📱 Telefon uchun havola',
      xabar + "\n\nEndi havolani qo'lda kiritamiz — keyingi oynaga joylashtiring.\n\n" +
      DEPLOY_YORIQNOMA, ui.ButtonSet.OK);
    if (!havolaniSaqla()) return;
    holat = webAppHolati_();
    if (!holat.ishlaydi) return;
  }

  var url = toliqHavola_(holat.url);
  var himoyalangan = url.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  var html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.6 -apple-system,system-ui,sans-serif;padding:12px">' +
    "<p style=\"margin:0 0 8px\">✅ Havola ishlayapti. Nusxalang (Ctrl+A → Ctrl+C):</p>" +
    '<textarea readonly style="width:100%;height:90px;font:12px/1.5 monospace;box-sizing:border-box">' +
    himoyalangan + '</textarea>' +
    '<p style="color:#78909C;margin:10px 0 0">Telefonda <b>Chrome</b> da oching (Telegram brauzerida emas) → ' +
    '⋮ → «Добавить на главный экран».</p>' +
    '<p style="color:#78909C;margin:6px 0 0">Havola o\'zgarsa: menyu → ⚙️ Sozlash → 🔗 Havolani saqlash.</p></div>'
  ).setWidth(640).setHeight(300);
  ui.showModalDialog(html, '📱 Telefon uchun havola');
}

function yordam() {
  var matn =
    "1) 🚀 Dastlabki sozlash — barcha sheetlarni yaratadi (bir marta).\n\n" +
    "2) Sozlamalar sheetida doimiy xarajatlaringizni yozing (ijara, internet, kredit...)\n" +
    "   va \"o'zim uchun\" qoidasini tanlang: Foiz (daromaddan %) yoki Summa.\n\n" +
    "3) 📅 Yangi oy ochish — doimiy xarajatlar + \"o'zim uchun\" qatori o'sha oy uchun\n" +
    "   Xarajat sheetiga reja sifatida ko'chiriladi.\n\n" +
    "4) Pul tushganda ➕ Yozuv qo'shish → Daromad (avans/oylik/KPI/qo'shimcha,\n" +
    "   karta/naqd). To'lov qilganingizda Xarajat qatoridagi \"Fakt\" ni to'ldiring.\n\n" +
    "5) Hisobot sheetida oyni tanlang — total, qoldiq, karta/naqd kesimi avtomatik.\n\n" +
    "📱 TELEFON: menyu mobil Sheets ilovasida ko'rinmaydi. Buning o'rniga web-ilovadan\n" +
    "foydalaning: menyu → '📱 Telefon uchun havola'. Havolani telefon brauzerida ochib,\n" +
    "bosh ekranga qo'shsangiz — alohida ilovadek ishlaydi (qoldiq, daromad/xarajat\n" +
    "qo'shish, to'lovni belgilash, yangi oy ochish).\n\n" +
    "Eslatma: Oy (A) va Holat ustunlari formula bilan to'ladi — ularga qo'lda yozmang.";
  SpreadsheetApp.getUi().alert('ℹ️ Qanday ishlaydi', matn, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** ===================== Dastlabki sozlash ===================== */

function dastlabkiSozlash() {
  var xatolar = tamirla_();
  SpreadsheetApp.getUi().alert(
    xatolar.length ? '⚠️ Qisman bajarildi' : '✅ Tayyor',
    xatolar.length
      ? "Quyidagi bosqichlar xato berdi:\n\n" + xatolar.join('\n')
      : "Sheetlar tayyor.\n\nKeyingi qadam: 'Sozlamalar' sheetida doimiy xarajatlaringizni va " +
        "\"o'zim uchun\" qoidasini to'ldiring, so'ng '📅 Yangi oy ochish' ni bosing.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Barcha sheetlarni qayta quradi. Har bosqich alohida himoyalangan —
 * bittasi xato bersa ham qolganlari bajariladi, xatolar ro'yxat bo'lib qaytadi.
 */
function tamirla_() {
  var ss = SpreadsheetApp.getActive();
  var xatolar = [];
  var qadamlar = [
    ['Sozlamalar', function () { qurSozlamalar_(ss); }],
    ['Daromad', function () { qurDaromad_(ss); }],
    ['Xarajat', function () { qurXarajat_(ss); }],
    ["O'zim uchun fondi", function () { eskiFondniKochir_(ss); qurOzim_(ss); }],
    ["Jamg'arma", function () { qurJamgarma_(ss); }],
    ["Ro'yxat", function () { qurRoyxat_(ss); }],
    ['Hisobot', function () { qurHisobot_(ss); }],
    ['Yillik', function () { qurYillik_(ss); }],
    ['Qarzlar', function () { qurQarz_(ss); }],
    ['Maqsadlar', function () { qurMaqsad_(ss); }],
    ["Dropdown ro'yxatlari", royxatlarniYangilash],
    ['Hisobotni hisoblash', hisobotniYangilash],
    ['Sheetlarni tartiblash', function () { tartibla_(ss); }],
    ['Avtomatik yangilash triggeri', triggerlarniOrnat_]
  ];

  qadamlar.forEach(function (qadam) {
    try {
      qadam[1]();
    } catch (e) {
      xatolar.push('❌ "' + qadam[0] + '" bosqichi: ' + e.message);
    }
  });
  SpreadsheetApp.flush();
  if (!xatolar.length) {
    PropertiesService.getDocumentProperties().setProperty('tuzilma', TUZILMA_VERSIYASI);
  }
  return xatolar;
}

function qurSozlamalar_(ss) {
  var sh = sheetOl_(ss, SH.SOZLAMALAR);
  // Eski maketdan qolgan tekshirish qoidalari yangi sarlavhalarni rad etmasligi uchun.
  // Ma'lumot saqlanadi — faqat validatsiya olib tashlanadi, royxatlarniYangilash_ qayta qo'yadi.
  sh.getRange(1, 1, Math.min(sh.getMaxRows(), 250), Math.max(sh.getLastColumn(), 17))
    .clearDataValidations();

  sh.getRange('A1').setValue('⚙️ SOZLAMALAR').setFontSize(14).setFontWeight('bold');
  sh.getRange('A3').setValue("👤 O'ZIM UCHUN AJRATMA").setFontWeight('bold').setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  sh.getRange('A4:A7').setValues([
    ['Hisoblash usuli'],
    ["Qiymat (foiz bo'lsa % , summa bo'lsa so'm)"],
    ["To'lov usuli"],
    ['Oyning qaysi kuni ajratiladi']
  ]);
  sh.getRange('C4:C7').setValues([
    ['Foiz = daromadning %-i, Summa = qat\'iy miqdor'],
    ['Masalan: 10 (foiz) yoki 1500000 (summa)'],
    ['Karta yoki Naqd'],
    ['1–31']
  ]).setFontColor('#78909C').setFontStyle('italic');

  if (sh.getRange(SOZ.OZIM_USUL).isBlank()) {
    sh.getRange('B4:B7').setValues([['Foiz'], [10], ['Naqd'], [5]]);
  }
  sh.getRange(SOZ.OZIM_USUL).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Foiz', 'Summa'], true).setAllowInvalid(false).build()
  );
  sh.getRange('B4:B7').setBackground(RANG.TANLOV).setFontWeight('bold');

  sh.getRange('A9').setValue("📌 DOIMIY (HAR OYLIK) XARAJATLAR").setFontWeight('bold').setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  sh.getRange('C9').setValue(
    "'Yangi oy ochish' shu ro'yxatni oyga ko'chiradi  ·  'Oylik reja' bo'sh bo'lsa — summasi o'zgaruvchi  ·  " +
    "'Avto to'lov' ✅ bo'lsa — to'lov sanasi kelganda Fakt avtomatik to'ldiriladi (bankdan o'zi yechiladiganlar uchun)"
  )
    .setFontColor('#78909C').setFontStyle('italic');
  jadvalSarlavhasi_(sh, 'A10:G10', [
    'Nomi / joy', 'Kategoriya', 'Oylik reja', "To'lov usuli", "To'lov kuni", 'Aktiv', "Avto to'lov"
  ]);

  if (sh.getRange(SOZ.DOIMIY_BOSH, 1).isBlank()) {
    var namuna = [
      ['Ijara', 'Ijara', 2000000, 'Naqd', 5, true, false],
      ['Kommunal (svet/gaz/suv)', 'Kommunal', 300000, 'Karta', 10, true, false],
      ['Internet', 'Internet/Aloqa', 100000, 'Karta', 10, true, true],
      ['Telefon aloqa', 'Internet/Aloqa', 50000, 'Karta', 10, true, true],
      ['Transport / yo\'lkira', 'Transport', 400000, 'Naqd', 1, true, false],
      ['Oziq-ovqat', 'Oziq-ovqat', 1500000, 'Naqd', 1, true, false]
    ];
    sh.getRange(SOZ.DOIMIY_BOSH, 1, namuna.length, 7).setValues(namuna);
  }
  sh.getRange(SOZ.DOIMIY_BOSH, 6, 200, 2).insertCheckboxes();
  sh.getRange(SOZ.DOIMIY_BOSH, 3, 200, 1).setNumberFormat(PUL);
  // 🔔 Eslatma va hisobot sozlamalari
  sh.getRange('H2').setValue('🔔 ESLATMA VA HISOBOT').setFontWeight('bold')
    .setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  sh.getRange('H3:H8').setValues([
    ['Telegram xabarlari'], ['Email manzil'], ["Necha kun oldin eslatilsin"],
    ['Kunlik eslatma soati'], ['Oylik hisobot yuborilsinmi'],
    ["Oylik hisobot qaysi kuni (1–28)"]
  ]);
  if (sh.getRange(SOZ_ESLATMA.TELEGRAM).isBlank()) {
    sh.getRange('I3:I8').setValues([['Ha'], [''], [1], [9], ['Ha'], [21]]);
  }
  // Oldingi versiyalarda bu katak yo'q edi — bo'sh bo'lsa standart qiymatni qo'yamiz
  if (sh.getRange(SOZ_ESLATMA.HISOBOT_KUNI).isBlank()) {
    sh.getRange(SOZ_ESLATMA.HISOBOT_KUNI).setValue(21);
  }
  sh.getRange('I3:I8').setBackground(RANG.TANLOV);
  sh.getRange('J8').setValue("← oyning oxirgi yozuvlarini kiritishga ulgurishingiz uchun")
    .setFontColor('#78909C').setFontStyle('italic');
  [SOZ_ESLATMA.TELEGRAM, SOZ_ESLATMA.OYLIK].forEach(function (katak) {
    sh.getRange(katak).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Ha', "Yo'q"], true).setAllowInvalid(false).build()
    );
  });

  // 📊 Kategoriya limitlari
  sh.getRange('H10').setValue('📊 KATEGORIYA LIMITLARI (oylik)').setFontWeight('bold')
    .setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  jadvalSarlavhasi_(sh, 'H11:I11', ['Kategoriya', 'Oylik limit']);
  sh.getRange(SOZ_LIMIT_BOSH, 9, 100, 1).setNumberFormat(PUL);

  // ⚡ Telefon ilovasidagi tez qo'shish tugmalari
  sh.getRange('K10').setValue('⚡ TEZ QO\'SHISH TUGMALARI (telefon)').setFontWeight('bold')
    .setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  jadvalSarlavhasi_(sh, 'K11:N11', ['Tugma nomi', 'Summa', 'Kategoriya', "To'lov usuli"]);
  sh.getRange(SOZ_TEZ_BOSH, 12, 50, 1).setNumberFormat(PUL);
  if (sh.getRange(SOZ_TEZ_BOSH, 11).isBlank()) {
    sh.getRange(SOZ_TEZ_BOSH, 11, 3, 4).setValues([
      ['Taksi', 20000, 'Transport', 'Naqd'],
      ['Tushlik', 35000, 'Oziq-ovqat', 'Naqd'],
      ['Nonushta', 15000, 'Oziq-ovqat', 'Naqd']
    ]);
  }

  // 📅 Daromad qaysi oyga tegishli (1-3 da kelgan oylik — oldingi oyniki)
  sh.getRange('P10').setValue('📅 DAROMAD QAYSI OYGA TEGISHLI').setFontWeight('bold')
    .setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
  jadvalSarlavhasi_(sh, 'P11:Q11', ['Daromad turi', 'Tegishli oy']);
  if (sh.getRange(SOZ_TEGISHLI_BOSH, 16).isBlank()) {
    sh.getRange(SOZ_TEGISHLI_BOSH, 16, 4, 2).setValues([
      ['Avans', TEGISHLI_JORIY],
      ['Oylik', TEGISHLI_OLDINGI],
      ['KPI', TEGISHLI_OLDINGI],
      ["Qo'shimcha", TEGISHLI_OLDINGI]
    ]);
  }
  sh.getRange(SOZ_TEGISHLI_BOSH, 17, 50, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList([TEGISHLI_JORIY, TEGISHLI_OLDINGI], true).setAllowInvalid(false).build()
  );
  sh.getRange('R11').setValue("← masalan oktabr 1-3 da kelgan oylik sentabrga yoziladi")
    .setFontColor('#78909C').setFontStyle('italic');

  sh.setColumnWidth(1, 220).setColumnWidth(2, 150).setColumnWidth(3, 130).setColumnWidth(4, 110)
    .setColumnWidth(5, 100).setColumnWidth(6, 70).setColumnWidth(7, 100)
    .setColumnWidth(8, 200).setColumnWidth(9, 140).setColumnWidth(10, 30)
    .setColumnWidth(11, 140).setColumnWidth(12, 120).setColumnWidth(13, 140).setColumnWidth(14, 110)
    .setColumnWidth(15, 30).setColumnWidth(16, 140).setColumnWidth(17, 130);
  sh.setFrozenRows(10);
}

/** 💳 Qarz va kreditlar daftari. */
function qurQarz_(ss) {
  var sh = sheetOl_(ss, SH.QARZ);
  sh.getRange(1, 1, QARZ_BOSH - 1, 9).breakApart().clearContent();

  sh.getRange('A1').setValue('💳 QARZLAR VA KREDITLAR').setFontSize(14).setFontWeight('bold');
  sh.getRange('A3:A5').setValues([
    ['Men qarzdorman (qolgan)'], ['Menga qarzdorlar (qolgan)'], ['⚖️ SOF HOLAT']
  ]).setFontWeight('bold');
  sh.getRange('B3:B5').setNumberFormat(PUL_UZUN).setFontWeight('bold');
  sh.getRange('A5:B5').setFontSize(12).setBackground('#FFF9C4');
  sh.getRange('C3').setValue(
    "\"Ilovadan to'langan\" avtomatik: Xarajat sheetida 'Joy / nomi' ustuni qarz nomi bilan " +
    'bir xil bo\'lgan to\'lovlar shu yerga yig\'iladi.'
  ).setFontColor('#78909C').setFontStyle('italic');

  bolim_(sh, 'A7:I7', 'QARZLAR RO\'YXATI');
  sarlavhaYoz_(sh, SARLAVHALAR.QARZ);

  var qatorlar = sh.getMaxRows() - 8;
  sh.getRange(QARZ_BOSH, Q_US.UMUMIY, qatorlar, 4).setNumberFormat(PUL);
  sh.getRange(QARZ_BOSH, Q_US.OYLIK, qatorlar, 1).setNumberFormat(PUL);
  sh.getRange(QARZ_BOSH, Q_US.TURI, qatorlar, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(QARZ_TURLARI, true).setAllowInvalid(false).build()
  );
  sh.getRange(QARZ_BOSH, Q_US.ILOVADAN, qatorlar, 2).setBackground('#F5F5F5');
  sh.getRange(QARZ_BOSH, Q_US.TUGASH, qatorlar, 1).setBackground('#F5F5F5');
  sh.setColumnWidth(1, 180).setColumnWidth(2, 150).setColumnWidth(3, 140).setColumnWidth(4, 140)
    .setColumnWidth(5, 160).setColumnWidth(6, 140).setColumnWidth(7, 130).setColumnWidth(8, 150).setColumnWidth(9, 200);
  sh.setFrozenRows(8);
}

/** 🎯 Jamg'arish maqsadlari. */
function qurMaqsad_(ss) {
  var sh = sheetOl_(ss, SH.MAQSAD);
  sh.getRange(1, 1, MAQSAD_BOSH - 1, 8).breakApart().clearContent();

  sh.getRange('A1').setValue('🎯 MAQSADLAR').setFontSize(14).setFontWeight('bold');
  sh.getRange('C1').setValue(
    "Yig'ilgan summani o'zingiz yozasiz. 'Oyiga ajratma' bo'sh bo'lsa — oxirgi oylardagi " +
    "o'rtacha orttirishingizga qarab prognoz qilinadi."
  ).setFontColor('#78909C').setFontStyle('italic');

  bolim_(sh, 'A3:H3', 'MAQSADLAR RO\'YXATI');
  sarlavhaYoz_(sh, SARLAVHALAR.MAQSAD);

  var qatorlar = sh.getMaxRows() - 4;
  sh.getRange(MAQSAD_BOSH, M_US.KERAK, qatorlar, 3).setNumberFormat(PUL);
  sh.getRange(MAQSAD_BOSH, M_US.FOIZ, qatorlar, 1).setNumberFormat('0%');
  sh.getRange(MAQSAD_BOSH, M_US.OYIGA, qatorlar, 1).setNumberFormat(PUL);
  sh.getRange(MAQSAD_BOSH, M_US.QOLGAN, qatorlar, 2).setBackground('#F5F5F5');
  sh.getRange(MAQSAD_BOSH, M_US.PROGNOZ, qatorlar, 1).setBackground('#F5F5F5');
  sh.getRange(MAQSAD_BOSH, M_US.MUDDAT, qatorlar, 1).setNumberFormat(SANA_FORMAT);
  sh.setColumnWidth(1, 200).setColumnWidth(2, 150).setColumnWidth(3, 150).setColumnWidth(4, 140)
    .setColumnWidth(5, 110).setColumnWidth(6, 140).setColumnWidth(7, 180).setColumnWidth(8, 120);
  sh.setFrozenRows(4);
}

function qurDaromad_(ss) {
  var sh = sheetOl_(ss, SH.DAROMAD);
  sarlavhaYoz_(sh, SARLAVHALAR.DAROMAD);
  sh.getRange('H1').setValue(
    "'Tegishli oy' — pul qaysi oyning daromadi ekani. Sozlamalardagi qoidaga qarab hisoblanadi " +
    "(masalan 1-3 da olingan oylik oldingi oyga yoziladi)."
  ).setFontColor('#78909C').setFontStyle('italic');
  // 'Oy' ustunini skript Sana'dan hisoblab to'ldiradi — jadvalda formula ishlatilmaydi.
  // Eski versiyadan qolgan formulani tozalaymiz (qiymatlarni ustunlarniToldir_ qayta yozadi).
  sh.getRange(2, D_US.OY, sh.getMaxRows() - 1, 1).clearContent();
  sh.getRange('A1').setBackground('#2E7D32');

  var qatorlar = sh.getMaxRows() - 1;
  sh.getRange(2, D_US.SANA, qatorlar, 1).setNumberFormat(SANA_FORMAT);
  sh.getRange(2, D_US.SUMMA, qatorlar, 1).setNumberFormat(PUL);
  sh.getRange(2, D_US.OY, qatorlar, 1).setNumberFormat('@').setBackground('#F1F8E9').setHorizontalAlignment('center');
  sh.setColumnWidth(1, 100).setColumnWidth(2, 110).setColumnWidth(3, 130).setColumnWidth(4, 120)
    .setColumnWidth(5, 140).setColumnWidth(6, 220).setColumnWidth(7, 180);
  sh.setFrozenRows(1);
  bandlash_(sh, sh.getRange(1, 1, sh.getMaxRows(), 7), SpreadsheetApp.BandingTheme.GREEN);
}

function qurXarajat_(ss) {
  var sh = sheetOl_(ss, SH.XARAJAT);
  sarlavhaYoz_(sh, SARLAVHALAR.XARAJAT);
  sh.getRange('M1').setValue(
    "'Tegishli oy (qo'lda)' — to'lov keyingi oyda qilinsa-yu, oldingi oyning byudjetiga tegishli bo'lsa " +
    "(masalan 5-oktabrda to'lanadigan kredit sentabrniki), shu ustunga 2026-09 deb yozing. " +
    "Bo'sh bo'lsa — sanadan hisoblanadi."
  ).setFontColor('#78909C').setFontStyle('italic');
  // 'Oy' va 'Holat' ustunlarini skript to'ldiradi — jadvalda formula ishlatilmaydi.
  sh.getRange(2, X_US.OY, sh.getMaxRows() - 1, 1).clearContent();
  sh.getRange(2, X_US.HOLAT, sh.getMaxRows() - 1, 1).clearContent();
  sh.getRange('A1').setBackground('#C62828');
  sh.getRange('I1').setBackground('#C62828');

  var qatorlar = sh.getMaxRows() - 1;
  sh.getRange(2, X_US.SANA, qatorlar, 1).setNumberFormat(SANA_FORMAT);
  sh.getRange(2, X_US.REJA, qatorlar, 2).setNumberFormat(PUL);
  sh.getRange(2, X_US.OY, qatorlar, 1).setNumberFormat('@').setBackground('#FFF3F3').setHorizontalAlignment('center');
  sh.getRange(2, X_US.TEGISHLI, qatorlar, 1).setNumberFormat('@').setBackground('#FFF9C4').setHorizontalAlignment('center');
  sh.getRange(2, X_US.AVTO, qatorlar, 1).insertCheckboxes();
  sh.getRange(2, X_US.HOLAT, qatorlar, 1).setBackground('#FFF3F3');
  sh.setColumnWidth(1, 90).setColumnWidth(2, 110).setColumnWidth(3, 220).setColumnWidth(4, 150)
    .setColumnWidth(5, 110).setColumnWidth(6, 130).setColumnWidth(7, 130).setColumnWidth(8, 200)
    .setColumnWidth(9, 120).setColumnWidth(10, 180).setColumnWidth(11, 140).setColumnWidth(12, 100);
  sh.setFrozenRows(1);
  bandlash_(sh, sh.getRange(1, 1, sh.getMaxRows(), 12), SpreadsheetApp.BandingTheme.LIGHT_GREY);
}

/** Eski "Jamg'arma" sheeti aslida shaxsiy fond edi — nomini o'zgartirib saqlab qolamiz. */
function eskiFondniKochir_(ss) {
  var eski = ss.getSheetByName(SH.JAMGARMA);
  if (!eski || ss.getSheetByName(SH.OZIM)) return;
  var sarlavha = String(eski.getRange('A1').getValue());
  if (sarlavha.indexOf("o'zim uchun") !== -1 || sarlavha.indexOf('SARFLAR') !== -1 ||
      String(eski.getRange('C8').getValue()) === 'Summa') {
    eski.setName(SH.OZIM);
  }
}

/** 👤 Shaxsiy fond: kirimi Xarajatdagi ajratmalardan avtomatik keladi. */
function qurOzim_(ss) {
  var sh = sheetOl_(ss, SH.OZIM);
  sh.getRange(1, 1, FOND_BOSH - 1, Math.max(sh.getLastColumn(), 6)).breakApart().clearContent();

  sh.getRange('A1').setValue("👤 O'ZIM UCHUN — shaxsiy pul hisobi").setFontSize(14).setFontWeight('bold');
  sh.getRange('A3:A5').setValues([
    ['Jami ajratilgan (avtomatik)'],
    ['Jami sarflangan'],
    ["👤 QOLDIQ"]
  ]).setFontWeight('bold');
  sh.getRange('B3:B5').setNumberFormat(PUL_UZUN).setFontWeight('bold');
  sh.getRange('A5:B5').setFontSize(12).setBackground('#E3F2FD');
  sh.getRange('C3').setValue("Kirim avtomatik: Xarajatdagi \"" + OZIM_KATEGORIYA +
    "\" qatorining Fakt ustuni to'ldirilganda shu yerga tushadi. Umumiy jamg'arma bilan aralashmaydi.")
    .setFontColor('#78909C').setFontStyle('italic');

  bolim_(sh, 'A7:F7', 'SARFLAR — shaxsiy puldan nimaga ishlatdingiz');
  sarlavhaYoz_(sh, SARLAVHALAR.OZIM);

  var qatorlar = sh.getMaxRows() - 8;
  sh.getRange(FOND_BOSH, O_US.SANA, qatorlar, 1).setNumberFormat(SANA_FORMAT);
  sh.getRange(FOND_BOSH, O_US.SUMMA, qatorlar, 1).setNumberFormat(PUL);
  sh.getRange(FOND_BOSH, O_US.OY, qatorlar, 1).setNumberFormat('@').setBackground('#E3F2FD').setHorizontalAlignment('center');
  sh.setColumnWidth(1, 90).setColumnWidth(2, 110).setColumnWidth(3, 140).setColumnWidth(4, 240)
    .setColumnWidth(5, 110).setColumnWidth(6, 220);
  sh.setFrozenRows(8);
}

/** 🏦 Umumiy jamg'arma: kirim ham, chiqim ham qo'lda yoziladi. */
/** 🏦 Umumiy jamg'arma: qo'lda yozilmaydi — har oyning qoldig'idan o'zi to'planadi. */
function qurJamgarma_(ss) {
  var sh = sheetOl_(ss, SH.JAMGARMA);
  // Bu sheet to'liq avtomatik — eski maketdan qolgan sarlavha, dropdown va qiymatlarni tozalaymiz.
  sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getLastColumn(), 8))
    .breakApart().clearContent().clearDataValidations();

  sh.getRange('A1').setValue("🏦 JAMG'ARMA — avtomatik hisoblanadi").setFontSize(14).setFontWeight('bold');
  sh.getRange('A3:A4').setValues([["🏦 JAMI TO'PLANGAN QOLDIQ"], ['Qamrab olingan oylar']]).setFontWeight('bold');
  sh.getRange('B3').setNumberFormat(PUL_UZUN).setFontWeight('bold').setFontSize(12);
  sh.getRange('A3:B3').setBackground('#E8F5E9');
  sh.getRange('C3').setValue(
    "Bu sheet to'liq avtomatik: har oy uchun daromad − xarajat hisoblanadi va to'planib boradi. " +
    "Xarajat qo'shsangiz, o'zgartirsangiz yoki o'chirsangiz — shu zahoti yangilanadi. Qo'lda yozmang. " +
    "⏳ belgisi — oy hali tugamagan, raqami oy davomida o'zgarib turadi."
  ).setFontColor('#78909C').setFontStyle('italic');

  bolim_(sh, 'A6:E6', "OYLAR BO'YICHA TO'PLANISH");
  sarlavhaYoz_(sh, SARLAVHALAR.JAMGARMA);

  sh.getRange('B8:E400').setNumberFormat(PUL);
  sh.getRange('A8:A400').setNumberFormat('@').setHorizontalAlignment('center');
  sh.setColumnWidth(1, 110).setColumnWidth(2, 150).setColumnWidth(3, 150)
    .setColumnWidth(4, 150).setColumnWidth(5, 170);
  sh.setFrozenRows(7);
}

function qurRoyxat_(ss) {
  var sh = sheetOl_(ss, SH.ROYXAT);
  jadvalSarlavhasi_(sh, 'A1:E1', ['Daromad turi', "To'lov usuli", 'Kategoriya', '', 'Oylar (avto)']);

  if (sh.getRange('A2').isBlank()) {
    sh.getRange(2, 1, 4, 1).setValues([['Avans'], ['Oylik'], ['KPI'], ["Qo'shimcha"]]);
  }
  if (sh.getRange('B2').isBlank()) {
    sh.getRange(2, 2, 2, 1).setValues([['Karta'], ['Naqd']]);
  }
  if (sh.getRange('C2').isBlank()) {
    var kategoriyalar = [
      'Ijara', 'Kommunal', 'Internet/Aloqa', 'Oziq-ovqat', 'Transport', 'Kredit/Qarz',
      "Sog'liq", "Ta'lim", 'Kiyim', "Ko'ngilochar", "Sovg'a", "Uy-ro'zg'or", OZIM_KATEGORIYA, 'Boshqa'
    ];
    sh.getRange(2, 3, kategoriyalar.length, 1).setValues(kategoriyalar.map(function (k) { return [k]; }));
  }

  sh.getRange('E2:E200').setNumberFormat('@');
  sh.getRange('G1').setValue(
    "Bu sheet dropdown ro'yxatlarini boshqaradi. Yangi tur/usul/kategoriya kerak bo'lsa " +
    "shu ustunlarga qo'shing va menyudan \"Ro'yxatlarni yangilash\" ni bosing. " +
    "E ustuni (oylar) avtomatik to'ladi — unga qo'lda yozmang."
  ).setFontColor('#78909C').setFontStyle('italic');
  sh.setColumnWidth(1, 130).setColumnWidth(2, 120).setColumnWidth(3, 160).setColumnWidth(4, 180).setColumnWidth(5, 120);
  sh.setFrozenRows(1);
}

function qurHisobot_(ss) {
  var sh = sheetOl_(ss, SH.HISOBOT);

  sh.getRange('A1').setValue('📊 OYLIK HISOBOT').setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('Oy:').setFontWeight('bold');
  var oyKatak = sh.getRange('B2').setNumberFormat('@');
  var joriyOy = oyKatak.getValue();
  if (!OY_REGEX.test(String(joriyOy))) {
    oyKatak.setValue(sanami_(joriyOy) ? oyMatni_(joriyOy) : oyMatni_(new Date()));
  }
  oyKatak.setBackground(RANG.TANLOV).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('C2').setValue("← oyni tanlang (YYYY-MM), raqamlar o'zi yangilanadi")
    .setFontColor('#78909C').setFontStyle('italic');

  // Eski maketdan qolgan birlashtirilgan kataklar yangi bloklar bilan kesishmasligi uchun
  sh.getRange('A4:I400').breakApart().clearContent();

  bolim_(sh, 'A4:D4', '1️⃣ DAROMAD');
  jadvalSarlavhasi_(sh, 'A5:D5', ['Tur', '💳 Karta', '💵 Naqd', 'Jami']);
  sh.getRange(6, 1, HISOBOT_TURLARI.length, 1).setValues(HISOBOT_TURLARI.map(function (t) { return [t]; }));
  sh.getRange('A10').setValue('JAMI');
  sh.getRange('A10:D10').setFontWeight('bold').setBackground(RANG.DAROMAD);

  bolim_(sh, 'A13:D13', '2️⃣ YAKUN');
  sh.getRange('A14:A23').setValues([
    ['Jami daromad'],
    ["Jami xarajat (fakt to'langan)"],
    ["   ↳ shundan o'zim uchun ajratilgan"],
    ["Rejadagi to'lovlar (jami)"],
    ["To'lanmagan reja qoldig'i"],
    ['💰 QOLDIQ (daromad − fakt)'],
    ["🔮 Prognoz qoldiq (to'lanmaganlardan keyin)"],
    ['💳 Karta qoldiq'],
    ['💵 Naqd qoldiq'],
    ['Sarflandi (%)']
  ]).setFontWeight('bold');
  sh.getRange('A19:B20').setFontSize(12);

  bolim_(sh, 'A25:D25', '3️⃣ ORTTIRISH');
  sh.getRange('A26:A30').setValues([
    ['📈 SHU OY ORTTIRGAN PUL'],
    ['   daromadning necha %-i'],
    ["Umumiy byudjet qoldig'i (barcha oylar)"],
    ["Oyiga o'rtacha orttirish"],
    ['Qamrab olingan oylar']
  ]).setFontWeight('bold');
  sh.getRange('A26:B26').setBackground('#C8E6C9').setFontSize(12);

  bolim_(sh, 'A32:D32', '4️⃣ PROGNOZ');
  sh.getRange('A33:A38').setValues([
    ["Oyning o'tgan qismi"],
    ["Kunlik o'rtacha sarf"],
    ["Shu sur'atda oy oxirigacha sarf"],
    ['Kutilayotgan daromad (oy oxirigacha)'],
    ['📉 Taxminiy oy oxiri qoldig\'i'],
    ["O'rtacha oylik xarajat (barcha oylar)"]
  ]).setFontWeight('bold');
  sh.getRange('A37:B37').setBackground('#FFF3E0');

  bolim_(sh, 'A40:E40', "5️⃣ XARAJAT — KATEGORIYA VA LIMITLAR");
  jadvalSarlavhasi_(sh, 'A41:E41', ['Kategoriya', 'Reja', 'Fakt', 'Limit', 'Limitdan']);

  bolim_(sh, 'F4:I4', "👤 O'ZIM UCHUN — shaxsiy pul");
  sh.getRange('F5:F7').setValues([['Shu oy ajratilgan'], ['Shu oy sarflangan'], ["👤 Fond qoldig'i"]]).setFontWeight('bold');
  sh.getRange('F7:G7').setBackground('#E3F2FD').setFontSize(12);

  bolim_(sh, 'F9:I9', "🏦 JAMG'ARMA — avtomatik to'planadi");
  sh.getRange('F10:F12').setValues([
    ["Oldingi oylardan to'plangan"], ["Shu oy qo'shilgan (qoldiq)"], ["🏦 Shu oygacha to'plangan"]
  ]).setFontWeight('bold');
  sh.getRange('F12:G12').setBackground('#E8F5E9').setFontSize(12);

  bolim_(sh, 'F14:I14', '💳 QARZLAR');
  sh.getRange('F15:F19').setValues([
    ['Men qarzdorman (qolgan)'], ['Menga qarzdorlar (qolgan)'],
    ["Oylik to'lov majburiyati"], ["Shu oyda qarzga to'langan"], ['⚖️ Sof holat']
  ]).setFontWeight('bold');
  sh.getRange('F19:G19').setBackground('#FFF9C4');

  bolim_(sh, 'F21:I21', '🎯 MAQSADLAR');
  jadvalSarlavhasi_(sh, 'F22:I22', ['Maqsad', 'Kerak', "Yig'ilgan", 'Progress']);

  bolim_(sh, 'F31:I31', "⏳ TO'LANMAGAN TO'LOVLAR");
  jadvalSarlavhasi_(sh, 'F32:I32', ['Sana', 'Joy', 'Kategoriya', 'Reja']);

  sh.getRange('B6:D10').setNumberFormat(PUL_UZUN);
  sh.getRange('B14:B22').setNumberFormat(PUL_UZUN);
  sh.getRange('B23').setNumberFormat('0.0%');
  sh.getRange('B26').setNumberFormat(PUL_UZUN);
  sh.getRange('B27').setNumberFormat('0.0%');
  sh.getRange('B28:B29').setNumberFormat(PUL_UZUN);
  sh.getRange('B34:B38').setNumberFormat(PUL_UZUN);
  sh.getRange('B42:D400').setNumberFormat(PUL);
  sh.getRange('E42:E400').setNumberFormat('0%');
  sh.getRange('G5:G7').setNumberFormat(PUL_UZUN);
  sh.getRange('G10:G12').setNumberFormat(PUL_UZUN);
  sh.getRange('G15:G19').setNumberFormat(PUL_UZUN);
  sh.getRange('G23:H29').setNumberFormat(PUL);
  sh.getRange('I23:I29').setNumberFormat('0%');
  sh.getRange('F33:F400').setNumberFormat('@');
  sh.getRange('I33:I400').setNumberFormat(PUL);
  sh.setColumnWidth(1, 270).setColumnWidth(2, 150).setColumnWidth(3, 140).setColumnWidth(4, 140)
    .setColumnWidth(5, 110).setColumnWidth(6, 210).setColumnWidth(7, 150).setColumnWidth(8, 140).setColumnWidth(9, 110);
  sh.setFrozenRows(2);
  sh.setHiddenGridlines(true);

  qoldiqRangi_(sh);
}

function qurYillik_(ss) {
  var sh = sheetOl_(ss, SH.YILLIK);

  sh.getRange('A1').setValue("📈 YILLIK KO'RINISH").setFontSize(14).setFontWeight('bold');
  sh.getRange('A3:H400').breakApart().clearContent();
  jadvalSarlavhasi_(sh, 'A3:H3', [
    'Oy', 'Daromad', 'Xarajat (fakt)', "O'zim uchun", 'Byudjet qoldig\'i',
    "Shaxsiy fonddan sarf", '📈 Orttirgan', 'Orttirish %'
  ]);

  sh.getRange('B4:G400').setNumberFormat(PUL);
  sh.getRange('H4:H400').setNumberFormat('0.0%');
  sh.getRange('A4:A400').setNumberFormat('@').setHorizontalAlignment('center');
  sh.setColumnWidth(1, 100).setColumnWidth(2, 140).setColumnWidth(3, 140).setColumnWidth(4, 130)
    .setColumnWidth(5, 140).setColumnWidth(6, 140).setColumnWidth(7, 150).setColumnWidth(8, 110);
  sh.setFrozenRows(3);

  var mavjudDiagrammalar = sh.getCharts();
  if (mavjudDiagrammalar.length > 0) {
    sh.updateChart(mavjudDiagrammalar[0].modify().setPosition(4, 10, 0, 0).build());
  } else {
    var diagramma = sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange('A3:C50'))
      .setPosition(4, 10, 0, 0)
      .setOption('title', "Daromad va xarajat (oylar bo'yicha)")
      .setOption('legend', { position: 'bottom' })
      .setOption('colors', ['#2E7D32', '#C62828'])
      .build();
    sh.insertChart(diagramma);
  }
}

/** ===================== Ro'yxatlar / validatsiya ===================== */

function royxatlarniYangilash() {
  var ss = SpreadsheetApp.getActive();
  var rsh = talabSheet_(ss, SH.ROYXAT);
  var dsh = talabSheet_(ss, SH.DAROMAD);
  var xsh = talabSheet_(ss, SH.XARAJAT);
  var hsh = talabSheet_(ss, SH.HISOBOT);

  var turlar = rsh.getRange('A2:A100');
  var usullar = rsh.getRange('B2:B20');
  var kategoriyalar = rsh.getRange('C2:C100');
  var oylar = rsh.getRange('E2:E200');

  // Tur va usul — qat'iy (hisobot shularga tayanadi), kategoriya — erkin.
  dsh.getRange(2, D_US.TUR, dsh.getMaxRows() - 1, 1).setDataValidation(qoida_(turlar, false));
  dsh.getRange(2, D_US.USUL, dsh.getMaxRows() - 1, 1).setDataValidation(qoida_(usullar, false));
  xsh.getRange(2, X_US.KATEGORIYA, xsh.getMaxRows() - 1, 1).setDataValidation(qoida_(kategoriyalar, true));
  xsh.getRange(2, X_US.USUL, xsh.getMaxRows() - 1, 1).setDataValidation(qoida_(usullar, false));
  hsh.getRange('B2').setDataValidation(qoida_(oylar, true));

  // Qarz/haq nomlari — Xarajat va Daromad sheetlaridagi bog'lanish ustuni uchun
  var qsh = talabSheet_(ss, SH.QARZ);
  var qOxirgi = oxirgiQator_(qsh, Q_US.NOMI);
  var qarzNomlari = qOxirgi >= QARZ_BOSH
    ? qsh.getRange(QARZ_BOSH, Q_US.NOMI, qOxirgi - QARZ_BOSH + 1, 1).getValues()
        .map(function (r) { return [String(r[0]).trim()]; }).filter(function (r) { return r[0]; })
    : [];
  rsh.getRange('D1').setValue('Qarz / haq (avto)').setFontWeight('bold')
    .setBackground(RANG.SARLAVHA_FON).setFontColor('#FFFFFF').setHorizontalAlignment('center');
  jadvalYoz_(rsh, 2, 4, 1, qarzNomlari, [''], 100);
  var qarzRange = rsh.getRange('D2:D100');
  xsh.getRange(2, X_US.QARZ, xsh.getMaxRows() - 1, 1).setDataValidation(qoida_(qarzRange, true));
  dsh.getRange(2, D_US.QARZ, dsh.getMaxRows() - 1, 1).setDataValidation(qoida_(qarzRange, true));

  var sozSh = talabSheet_(ss, SH.SOZLAMALAR);
  sozSh.getRange(SOZ.DOIMIY_BOSH, 2, 200, 1).setDataValidation(qoida_(kategoriyalar, true));
  sozSh.getRange(SOZ.DOIMIY_BOSH, 4, 200, 1).setDataValidation(qoida_(usullar, false));
  sozSh.getRange(SOZ.OZIM_TOLOV).setDataValidation(qoida_(usullar, false));

  // Sozlamalardagi jadvallar ham ro'yxatdan tanlanadi
  var qatorSoni = sozSh.getMaxRows() - SOZ_LIMIT_BOSH + 1;
  sozSh.getRange(SOZ_LIMIT_BOSH, 8, qatorSoni, 1).setDataValidation(qoida_(kategoriyalar, true));   // limit kategoriyasi
  sozSh.getRange(SOZ_TEZ_BOSH, 13, qatorSoni, 1).setDataValidation(qoida_(kategoriyalar, true));    // tez tugma kategoriyasi
  sozSh.getRange(SOZ_TEZ_BOSH, 14, qatorSoni, 1).setDataValidation(qoida_(usullar, false));         // tez tugma usuli
  sozSh.getRange(SOZ_TEGISHLI_BOSH, 16, qatorSoni, 1).setDataValidation(qoida_(turlar, true));      // daromad turi

  var osh = talabSheet_(ss, SH.OZIM);
  osh.getRange(FOND_BOSH, O_US.USUL, osh.getMaxRows() - 8, 1).setDataValidation(qoida_(usullar, false));

}

function qoida_(manbaRange, erkin) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(manbaRange, true)
    .setAllowInvalid(erkin)
    .build();
}

/** ===================== Yangi oy ochish ===================== */

function yangiOyOchish() {
  var ui = SpreadsheetApp.getUi();
  var joriy = oyMatni_(new Date());
  var javob = ui.prompt(
    '📅 Yangi oy ochish',
    "Oyni YYYY-MM ko'rinishida kiriting (bo'sh qoldirsangiz: " + joriy + ")",
    ui.ButtonSet.OK_CANCEL
  );
  if (javob.getSelectedButton() !== ui.Button.OK) return;

  var oy = (javob.getResponseText() || joriy).trim();
  if (!OY_REGEX.test(oy)) {
    ui.alert("❌ Noto'g'ri format", "Oy YYYY-MM ko'rinishida bo'lishi kerak. Masalan: " + joriy, ui.ButtonSet.OK);
    return;
  }

  var natija = oyniTayyorla_(oy);
  SpreadsheetApp.getActive().getSheetByName(SH.HISOBOT).getRange('B2').setNumberFormat('@').setValue(oy);
  hisobotniYangilash();

  ui.alert(
    '✅ ' + oy + ' oyi tayyor',
    natija.qoshildi + " ta reja qatori qo'shildi." +
      (natija.otkazildi > 0 ? '\n' + natija.otkazildi + " ta qator allaqachon mavjud edi (o'tkazib yuborildi)." : '') +
      "\n\nEndi 'Xarajat' sheetida to'lov qilganingizda 'Fakt' ustunini to'ldiring.",
    ui.ButtonSet.OK
  );
}

/**
 * Doimiy xarajatlar + "o'zim uchun" qatorini berilgan oy uchun Xarajat sheetiga yozadi.
 * Takroran ishga tushirilsa mavjud qatorlarni takrorlamaydi.
 */
function oyniTayyorla_(oy) {
  var ss = SpreadsheetApp.getActive();
  var sozlamalar = sozlamalarniOl_(ss);
  var doimiy = doimiyXarajatlarniOl_(ss);
  var xsh = talabSheet_(ss, SH.XARAJAT);
  var holat = oyHolati_(xsh, oy);

  var boshQator = oxirgiQator_(xsh, X_US.JOY) + 1;
  var qatorlar = [];
  var avtoBelgilar = [];
  var otkazildi = 0;

  doimiy.forEach(function (d) {
    if (holat.nomlar[kalit_(d.nomi)]) {
      otkazildi++;
      return;
    }
    qatorlar.push([sanaYasa_(oy, d.kun), d.nomi, d.kategoriya, d.usul, d.reja, '', 'Doimiy']);
    avtoBelgilar.push([d.avto === true]);
  });

  if (holat.ozimBor) {
    otkazildi++;
  } else {
    qatorlar.push([
      sanaYasa_(oy, sozlamalar.ozimKun),
      OZIM_NOMI,
      OZIM_KATEGORIYA,
      sozlamalar.ozimTolovUsuli,
      ozimRejasi_(sozlamalar, oy),
      '',
      sozlamalar.ozimUsul === 'Foiz' ? 'Daromadning ' + sozlamalar.ozimQiymat + '%' : "Qat'iy summa"
    ]);
    avtoBelgilar.push([false]);
  }

  if (qatorlar.length > 0) {
    qulfBilan_(function () {
      xsh.getRange(boshQator, X_US.SANA, qatorlar.length, 7).setValues(qatorlar);
      // To'lov sanasi keyingi oyga tushsa ham, qator ochilgan oyga tegishli bo'lib qoladi
      xsh.getRange(boshQator, X_US.TEGISHLI, qatorlar.length, 1)
        .setNumberFormat('@')
        .setValues(qatorlar.map(function () { return [oy]; }));
      xsh.getRange(boshQator, X_US.AVTO, avtoBelgilar.length, 1).setValues(avtoBelgilar);
    });
  }
  return { oy: oy, qoshildi: qatorlar.length, otkazildi: otkazildi };
}

/** Foiz tanlangan bo'lsa — oy daromadiga bog'langan formula, aks holda qat'iy summa. */
function ozimRejasi_(sozlamalar, oy) {
  if (sozlamalar.ozimUsul !== 'Foiz') return sozlamalar.ozimQiymat;
  return ozimSummasi_(oyXulosasi_(oy).daromad, sozlamalar);
}

function sozlamalarniOl_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var q = sh.getRange('B4:B7').getValues();
  var qiymat = Number(q[1][0]);
  if (!(qiymat >= 0)) {
    throw new Error("Sozlamalar!" + SOZ.OZIM_QIYMAT + " — \"o'zim uchun\" qiymati son bo'lishi kerak.");
  }
  return {
    ozimUsul: String(q[0][0] || 'Foiz').trim(),
    ozimQiymat: qiymat,
    ozimTolovUsuli: String(q[2][0] || 'Naqd').trim(),
    ozimKun: Number(q[3][0]) || 1
  };
}

function doimiyXarajatlarniOl_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var oxirgi = sh.getLastRow();
  if (oxirgi < SOZ.DOIMIY_BOSH) return [];

  var qatorlar = sh.getRange(SOZ.DOIMIY_BOSH, 1, oxirgi - SOZ.DOIMIY_BOSH + 1, 7).getValues();
  return qatorlar
    .filter(function (r) { return String(r[0]).trim() !== '' && r[5] === true; })
    .map(function (r) {
      return {
        nomi: String(r[0]).trim(),
        kategoriya: String(r[1] || 'Boshqa').trim(),
        reja: bosh_(r[2]) ? '' : Number(r[2]) || 0,  // bo'sh = summasi har oy o'zgaradi
        usul: String(r[3] || 'Naqd').trim(),
        kun: Number(r[4]) || 1,
        avto: r[6] === true
      };
    });
}

/** Tanlangan oyda qaysi nomlar allaqachon bor va "o'zim uchun" qatori yozilganmi. */
function oyHolati_(xsh, oy) {
  var natija = { nomlar: {}, ozimBor: false };
  var oxirgi = oxirgiQator_(xsh, X_US.JOY);
  if (oxirgi < 2) return natija;

  var qiymatlar = xsh.getRange(2, X_US.OY, oxirgi - 1, 3).getValues(); // A:C — oy, sana, joy
  var kategoriyalar = xsh.getRange(2, X_US.KATEGORIYA, oxirgi - 1, 1).getValues();
  for (var i = 0; i < qiymatlar.length; i++) {
    if (String(qiymatlar[i][0]) !== oy) continue;
    natija.nomlar[kalit_(qiymatlar[i][2])] = true;
    if (String(kategoriyalar[i][0]).trim() === OZIM_KATEGORIYA) natija.ozimBor = true;
  }
  return natija;
}

/** ===================== Ilova: telefon (Web App) + desktop (dialog) ===================== */

/**
 * Telefon uchun web-ilova. Deploy > New deployment > Web app orqali chiqariladi,
 * havolani telefonning bosh ekraniga qo'shsa — alohida ilovadek ishlaydi.
 */
/**
 * Telefon uchun web-ilova. Deploy > New deployment > Web app orqali chiqariladi,
 * havolani telefonning bosh ekraniga qo'shsa — alohida ilovadek ishlaydi.
 */
/**
 * Telefon uchun web-ilova.
 * Agar kirish kaliti o'rnatilgan bo'lsa, havola ?k=... bilan bo'lishi shart —
 * shunda deploymentni "Hamma havola orqali" qilib qo'yish xavfsizroq bo'ladi
 * (mobil brauzerda Google akkauntga kirish talab qilinmaydi).
 */
function doGet(e) {
  var kalit = PropertiesService.getScriptProperties().getProperty('kirishKaliti');
  if (kalit) {
    var berilgan = e && e.parameter ? e.parameter.k : '';
    if (berilgan !== kalit) {
      return HtmlService.createHtmlOutput(
        '<div style="font:16px/1.6 system-ui;padding:32px;text-align:center">' +
        "<h2>🔒 Ruxsat yo'q</h2><p>Havola to'liq emas — kirish kaliti ko'rsatilmagan.</p>" +
        "<p style=\"color:#78909C;font-size:14px\">Jadvalda: menyu → ⚙️ Sozlash → 📱 Telefon uchun havola</p></div>"
      );
    }
  }

  try {
    return HtmlService.createHtmlOutputFromFile('Ilova')
      .setTitle('Oylik byudjet')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font:15px/1.6 system-ui;padding:24px;max-width:520px">' +
      "<h2>⚠️ Ilova ochilmadi</h2><p>Sabab: " + String(err.message).replace(/</g, '&lt;') + '</p>' +
      "<p>Apps Script muharririda <b>+ → HTML</b> orqali <b>Ilova</b> faylini yarating.</p></div>"
    );
  }
}

/** Kirish kaliti bilan to'liq havola. */
function toliqHavola_(url) {
  var kalit = PropertiesService.getScriptProperties().getProperty('kirishKaliti');
  return kalit ? url + '?k=' + kalit : url;
}

/**
 * Menyu: kirish kalitini yaratadi/yangilaydi.
 * Shundan keyin deploymentni "У кого есть доступ: Все, у кого есть ссылка" qilib qo'ysa —
 * telefonda Google akkauntsiz ham ochiladi, lekin faqat kalit bilan.
 */
function kirishKalitiniYarat() {
  var ui = SpreadsheetApp.getUi();
  var javob = ui.alert('🔑 Kirish kaliti',
    "Kalit yaratilsa, ilova havolasi ?k=... bilan ishlaydi.\n\n" +
    "Shundan keyin deploymentni «Все, у кого есть ссылка» qilib qo'ysangiz — telefonda " +
    "Google akkauntga kirish shart bo'lmaydi, lekin kalitsiz hech kim ocholmaydi.\n\n" +
    "Yangi kalit yaratilsinmi? (eski havola ishlamay qoladi)", ui.ButtonSet.YES_NO);
  if (javob !== ui.Button.YES) return;

  var kalit = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('kirishKaliti', kalit);
  telefonHavolasi();
}

/** Menyu: kalitni o'chiradi (havola yana Google akkaunt orqali himoyalanadi). */
function kirishKalitiniOchir() {
  PropertiesService.getScriptProperties().deleteProperty('kirishKaliti');
  SpreadsheetApp.getUi().alert('🔑 Kalit o\'chirildi',
    "Endi havola kalitsiz ochiladi. Deployment «Только я» rejimida bo'lishi kerak.",
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Kompyuterda xuddi shu ilova dialog oynasida ochiladi. */
function formaOch() {
  var html = HtmlService.createHtmlOutputFromFile('Ilova').setWidth(470).setHeight(660);
  SpreadsheetApp.getUi().showModalDialog(html, 'Oylik byudjet');
}

/** Ilova ochilganda kerak bo'ladigan hamma narsa — bitta so'rovda. */
function ilovaMalumotlari(oy) {
  var ss = SpreadsheetApp.getActive();
  var rsh = talabSheet_(ss, SH.ROYXAT);
  var tanlangan = OY_REGEX.test(String(oy || '')) ? String(oy) : oyMatni_(new Date());
  return {
    turlar: ustunRoyxati_(rsh, 1),
    usullar: ustunRoyxati_(rsh, 2),
    kategoriyalar: ustunRoyxati_(rsh, 3),
    bugun: Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
    tezTugmalar: tezTugmalarniOl_(ss),
    daromadQoidalari: daromadQoidalari_(ss),
    qarzNomlari: qarzNomlariniOl_(ss),
    xulosa: oyXulosasi_(tanlangan)
  };
}

function oyXulosasiniOl(oy) {
  if (!OY_REGEX.test(String(oy || ''))) throw new Error("Oy YYYY-MM ko'rinishida bo'lishi kerak.");
  return oyXulosasi_(String(oy));
}

function daromadQosh(forma) {
  var summa = musbatSon_(forma.summa, 'Summa');
  var sana = sanaOqi_(forma.sana);
  var tur = matnTalab_(forma.tur, 'Tur');
  var usul = matnTalab_(forma.usul, "To'lov usuli");

  qulfBilan_(function () {
    var sh = talabSheet_(SpreadsheetApp.getActive(), SH.DAROMAD);
    var qator = oxirgiQator_(sh, D_US.TUR) + 1;
    sh.getRange(qator, D_US.SANA, 1, 6)
      .setValues([[sana, tur, usul, summa, String(forma.izoh || ''), String(forma.qarz || '')]]);
  });

  return javob_("✅ Daromad qo'shildi: " + tur + ' / ' + usul, oyMatni_(sana));
}

function xarajatQosh(forma) {
  var sana = sanaOqi_(forma.sana);
  var joy = matnTalab_(forma.joy, 'Joy / nomi');
  var kategoriya = matnTalab_(forma.kategoriya, 'Kategoriya');
  var usul = matnTalab_(forma.usul, "To'lov usuli");
  var reja = bosh_(forma.reja) ? '' : musbatSon_(forma.reja, 'Reja');
  var fakt = bosh_(forma.fakt) ? '' : musbatSon_(forma.fakt, 'Fakt');
  if (reja === '' && fakt === '') throw new Error("Reja yoki Fakt summasidan kamida bittasi to'ldirilsin.");

  qulfBilan_(function () {
    var sh = talabSheet_(SpreadsheetApp.getActive(), SH.XARAJAT);
    var qator = oxirgiQator_(sh, X_US.JOY) + 1;
    sh.getRange(qator, X_US.SANA, 1, 7)
      .setValues([[sana, joy, kategoriya, usul, reja, fakt, String(forma.izoh || '')]]);
    if (forma.qarz) sh.getRange(qator, X_US.QARZ).setValue(String(forma.qarz));
    if (OY_REGEX.test(String(forma.tegishli || ''))) {
      sh.getRange(qator, X_US.TEGISHLI).setNumberFormat('@').setValue(String(forma.tegishli));
    }
  });

  var tegishliOy = OY_REGEX.test(String(forma.tegishli || '')) ? String(forma.tegishli) : oyMatni_(sana);
  return javob_("✅ Xarajat qo'shildi: " + joy, tegishliOy);
}

/** 👤 Shaxsiy fonddan sarf qo'shadi. */
function ozimSarfQosh(forma) {
  var sana = sanaOqi_(forma.sana);
  var summa = musbatSon_(forma.summa, 'Summa');
  var maqsad = matnTalab_(forma.maqsad, 'Nima uchun');
  var usul = matnTalab_(forma.usul, "To'lov usuli");

  qulfBilan_(function () {
    var sh = talabSheet_(SpreadsheetApp.getActive(), SH.OZIM);
    var qator = Math.max(oxirgiQator_(sh, O_US.MAQSAD), FOND_BOSH - 1) + 1;
    sh.getRange(qator, O_US.SANA, 1, 5)
      .setValues([[sana, summa, maqsad, usul, String(forma.izoh || '')]]);
  });

  return javob_("✅ Shaxsiy fonddan sarf yozildi: " + maqsad, oyMatni_(sana));
}

/** Rejadagi to'lovni "to'landi" deb belgilaydi (Fakt ustunini to'ldiradi). */
function tolovniBelgila(sorov) {
  var qator = Number(sorov.qator);
  if (!(qator >= 2)) throw new Error("Qator raqami noto'g'ri.");

  var joy = qulfBilan_(function () {
    var xsh = talabSheet_(SpreadsheetApp.getActive(), SH.XARAJAT);
    // Jadval boshqa joydan o'zgartirilgan bo'lishi mumkin — qatorni yozishdan oldin tasdiqlaymiz.
    var mavjud = xsh.getRange(qator, X_US.OY, 1, 7).getValues()[0];
    if (String(mavjud[0]) !== String(sorov.oy) || kalit_(mavjud[2]) !== kalit_(sorov.joy)) {
      throw new Error("Bu qator jadvalda o'zgargan. Ro'yxat yangilandi — qaytadan urinib ko'ring.");
    }
    if (Number(mavjud[6]) > 0) throw new Error("Bu to'lov allaqachon to'langan deb belgilangan.");

    var summa = bosh_(sorov.summa) ? Number(mavjud[5]) || 0 : musbatSon_(sorov.summa, 'Summa');
    if (summa <= 0) throw new Error("Bu to'lovning summasi belgilanmagan — qancha to'laganingizni kiriting.");

    xsh.getRange(qator, X_US.FAKT).setValue(summa);
    return String(mavjud[2]);
  });

  return javob_("✅ To'landi: " + joy, String(sorov.oy));
}

/** Telefondan ham yangi oy ocha olish uchun (menyu mobil ilovada ko'rinmaydi). */
function oyniOch(oy) {
  if (!OY_REGEX.test(String(oy || ''))) throw new Error("Oy YYYY-MM ko'rinishida bo'lishi kerak.");
  var natija = oyniTayyorla_(String(oy));
  return javob_('✅ ' + oy + ": " + natija.qoshildi + " ta reja qatori qo'shildi", String(oy));
}

function javob_(xabar, oy) {
  ustunlarniToldir_();
  var hammasi = hammaXulosalar_();
  ozimRejalariniYangila_(hammasi);
  hisobotlarniChiz_(hammasi);
  return { xabar: xabar, xulosa: oyniAjrat_(hammasi, oy) };
}

/**
 * Bir oyning to'liq kesimi — ikkita o'qish bilan (sheet formulalariga bog'liq emas,
 * shuning uchun Hisobotda qaysi oy tanlanganidan qat'i nazar ishlaydi).
 */
/** Bitta oyning kesimi (telefon ilovasi shuni ishlatadi). */
function oyXulosasi_(oy) {
  return oyniAjrat_(hammaXulosalar_(), oy);
}

/** Tanlangan oy kesimi + barcha oylarga tegishli umumiy ko'rsatkichlar. */
function oyniAjrat_(hammasi, oy) {
  var x = hammasi.oyMap[oy];
  if (!x) {
    x = bosXulosa_(oy);
    x.ozimFond = hammasi.ozimFond;
    x.jamgarma = hammasi.jamgarma;
    x.umumiy = hammasi.umumiy;
  }
  var ss = SpreadsheetApp.getActive();
  x.limitlar = hammasi.limitlar;
  x.yopilganmi = !!hammasi.yopilgan[oy];
  x.prognoz2 = prognozHisobla_(x, hammasi.umumiy);
  x.qarz = hammasi.qarz || qarzlarniHisobla_(ss, hammasi.bogJami, false);
  x.qarzTolovi = qarzTolovi_(x, x.qarz);
  x.maqsadlar = hammasi.maqsadlar || maqsadlarniHisobla_(ss, hammasi.umumiy.ortacha, false);
  return x;
}

/**
 * Daromad va Xarajat sheetlarini BIR MARTA o'qib, barcha oylar kesimini qaytaradi.
 * Hisobot ham, telefon ilovasi ham shu bitta manbadan foydalanadi.
 */
function hammaXulosalar_() {
  var ss = SpreadsheetApp.getActive();
  var dsh = talabSheet_(ss, SH.DAROMAD);
  var xsh = talabSheet_(ss, SH.XARAJAT);
  var oyMap = {};
  var joyJami = {};   // xarajat 'Joy / nomi' bo'yicha jami fakt (avtomatik bog'lash uchun)
  var bogJami = {};   // qarz nomi → {xarajat, daromad} — aniq bog'langan summalar

  function oyniOl_(oy) {
    if (!oyMap[oy]) oyMap[oy] = bosXulosa_(oy);
    return oyMap[oy];
  }

  var dOxirgi = oxirgiQator_(dsh, D_US.TUR);
  if (dOxirgi >= 2) {
    var qoidalar = daromadQoidalari_(ss);
    dsh.getRange(2, 1, dOxirgi - 1, 7).getValues().forEach(function (r) {
      var oy = daromadOyi_(r, qoidalar);
      if (!oy) return;
      var x = oyniOl_(oy);
      var summa = Number(r[4]) || 0;
      var tur = String(r[2]).trim() || 'Boshqa';
      var usul = String(r[3]).trim() === 'Karta' ? 'Karta' : 'Naqd';

      x.daromad += summa;
      if (usul === 'Karta') x.daromadKarta += summa; else x.daromadNaqd += summa;
      if (!x.matritsa[tur]) x.matritsa[tur] = { Karta: 0, Naqd: 0 };
      x.matritsa[tur][usul] += summa;
      x.turMap[tur] = (x.turMap[tur] || 0) + summa;

      var bog = kalit_(r[6]);
      if (bog) {
        if (!bogJami[bog]) bogJami[bog] = { xarajat: 0, daromad: 0, kutilmoqda: 0 };
        bogJami[bog].daromad += summa;
        x.bog[bog] = (x.bog[bog] || 0) + summa;
      }
    });
  }

  var xOxirgi = oxirgiQator_(xsh, X_US.JOY);
  if (xOxirgi >= 2) {
    var qatorlar = xsh.getRange(2, 1, xOxirgi - 1, 11).getValues();
    for (var i = 0; i < qatorlar.length; i++) {
      var r = qatorlar[i];
      var oy = xarajatOyi_(r);
      if (!oy) continue;
      var x = oyniOl_(oy);
      var reja = Number(r[5]) || 0;
      var fakt = Number(r[6]) || 0;
      var kategoriya = String(r[3]).trim() || 'Boshqa';
      var usul = String(r[4]).trim() === 'Karta' ? 'Karta' : 'Naqd';

      x.reja += reja;
      x.xarajat += fakt;
      if (usul === 'Karta') x.xarajatKarta += fakt; else x.xarajatNaqd += fakt;
      if (kategoriya === OZIM_KATEGORIYA) {
        x.ozim += fakt;
        x.ozimQatori = i + 2;
      }

      var xBog = kalit_(r[9]);
      if (xBog && !bogJami[xBog]) bogJami[xBog] = { xarajat: 0, daromad: 0, kutilmoqda: 0 };
      if (fakt > 0) {
        var joyKaliti = kalit_(r[2]);
        joyJami[joyKaliti] = (joyJami[joyKaliti] || 0) + fakt;
        x.joylar[joyKaliti] = (x.joylar[joyKaliti] || 0) + fakt;
        if (xBog) {
          bogJami[xBog].xarajat += fakt;
          x.bog[xBog] = (x.bog[xBog] || 0) + fakt;
        }
      } else if (xBog) {
        // Bog'langan, lekin Fakt bo'sh — to'lov hali qilinmagan, qarzdan ayirilmaydi
        bogJami[xBog].kutilmoqda += reja;
      }
      if (!x.katMap[kategoriya]) x.katMap[kategoriya] = { reja: 0, fakt: 0 };
      x.katMap[kategoriya].reja += reja;
      x.katMap[kategoriya].fakt += fakt;

      if (fakt === 0) {
        x.tolanmaganJami += reja;
        if (reja === 0) x.nomalumTolovlar++;
        x.tolanmagan.push({
          qator: i + 2,
          joy: String(r[2]),
          kategoriya: kategoriya,
          usul: String(r[4]),
          reja: reja,
          nomalum: reja === 0,
          kechikkan: sanami_(r[1]) &&
            Utilities.formatDate(r[1], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') <
            Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
          sana: sanaMatni_(r[1]),
          sanaTolik: sanami_(r[1])
            ? Utilities.formatDate(r[1], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : ''
        });
      }
    }
  }

  // 👤 Shaxsiy fond sarflari
  var ozimFond = { ajratilgan: 0, sarflangan: 0, qoldiq: 0, sarflar: [] };
  var osh = talabSheet_(ss, SH.OZIM);
  var oOxirgi = oxirgiQator_(osh, O_US.MAQSAD);
  if (oOxirgi >= FOND_BOSH) {
    osh.getRange(FOND_BOSH, 1, oOxirgi - FOND_BOSH + 1, 6).getValues().forEach(function (r) {
      var summa = Number(r[2]) || 0;
      if (summa <= 0) return;
      var oy = qatorOyi_(r);
      if (oy) oyniOl_(oy).ozimSarf += summa;
      ozimFond.sarflangan += summa;
      ozimFond.sarflar.push({
        sana: sanaMatni_(r[1]), summa: summa, maqsad: String(r[3]), usul: String(r[4]), oy: oy
      });
    });
  }

  var oylar = Object.keys(oyMap).sort();
  var umumiy = { daromad: 0, xarajat: 0, ozim: 0, qoldiq: 0, orttirgan: 0, oylarSoni: oylar.length, ortacha: 0 };
  oylar.forEach(function (oy) {
    var x = yakunla_(oyMap[oy]);
    ozimFond.ajratilgan += x.ozim;
    umumiy.daromad += x.daromad;
    umumiy.xarajat += x.xarajat;
    umumiy.ozim += x.ozim;
    umumiy.qoldiq += x.qoldiq;
    umumiy.orttirgan += x.orttirgan;
  });
  ozimFond.qoldiq = ozimFond.ajratilgan - ozimFond.sarflangan;
  ozimFond.sarflar.reverse();

  // 🏦 Jamg'arma: oylarning qoldig'i xronologik to'planadi
  var jamgarma = { qoldiq: umumiy.qoldiq, oylarSoni: oylar.length, oylar: [] };
  var toplangan = 0;
  oylar.forEach(function (oy) {
    var x = oyMap[oy];
    x.oldingiToplangan = toplangan;
    toplangan += x.qoldiq;
    x.toplangan = toplangan;
    jamgarma.oylar.push({ oy: oy, daromad: x.daromad, xarajat: x.xarajat, qoldiq: x.qoldiq, toplangan: toplangan });
  });

  umumiy.ortacha = umumiy.oylarSoni ? Math.round(umumiy.orttirgan / umumiy.oylarSoni) : 0;
  oylar.forEach(function (oy) {
    oyMap[oy].ozimFond = ozimFond;
    oyMap[oy].jamgarma = jamgarma;
    oyMap[oy].umumiy = umumiy;
  });

  return {
    oylar: oylar, oyMap: oyMap, ozimFond: ozimFond, jamgarma: jamgarma,
    umumiy: umumiy, joyJami: joyJami, bogJami: bogJami,
    limitlar: limitlarniOl_(ss), yopilgan: yopilganOylar_()
  };
}

function bosXulosa_(oy) {
  return {
    oy: oy,
    daromad: 0, daromadKarta: 0, daromadNaqd: 0,
    xarajat: 0, xarajatKarta: 0, xarajatNaqd: 0,
    reja: 0, tolanmaganJami: 0, nomalumTolovlar: 0, ozim: 0, ozimQatori: 0,
    ozimSarf: 0, orttirgan: 0, orttirganFoiz: 0,
    ozimFond: { ajratilgan: 0, sarflangan: 0, qoldiq: 0, sarflar: [] },
    jamgarma: { qoldiq: 0, oylarSoni: 0, oylar: [] },
    oldingiToplangan: 0, toplangan: 0,
    umumiy: { daromad: 0, xarajat: 0, ozim: 0, qoldiq: 0, orttirgan: 0, oylarSoni: 0, ortacha: 0 },
    qoldiq: 0, prognoz: 0, karta: 0, naqd: 0,
    turMap: {}, katMap: {}, matritsa: {}, joylar: {}, bog: {},
    turlar: [], kategoriyalar: [], tolanmagan: []
  };
}

function yakunla_(x) {
  x.turlar = Object.keys(x.turMap).map(function (nom) {
    return { nom: nom, summa: x.turMap[nom] };
  }).sort(kamayishBoyicha_);
  x.kategoriyalar = Object.keys(x.katMap).map(function (nom) {
    return { nom: nom, summa: x.katMap[nom].fakt, reja: x.katMap[nom].reja };
  }).sort(kamayishBoyicha_);

  x.qoldiq = x.daromad - x.xarajat;
  x.prognoz = x.qoldiq - x.tolanmaganJami;
  x.karta = x.daromadKarta - x.xarajatKarta;
  x.naqd = x.daromadNaqd - x.xarajatNaqd;

  // Shu oyda qancha pul orttirdim: "o'zim uchun" ajratmasi sarf emas (boshqa cho'ntakka
  // o'tdi), jamg'armadan sarflangani esa haqiqiy sarf.
  x.orttirgan = x.qoldiq + x.ozim - x.ozimSarf;
  x.orttirganFoiz = x.daromad > 0 ? x.orttirgan / x.daromad : 0;
  return x;
}

/** Qator qaysi oyga tegishli: avval Sana ustuni, bo'lmasa Oy ustunidagi matn. */
/** Xarajat qatori qaysi oyga tegishli: qo'lda ko'rsatilgan oy bo'lsa — o'sha, aks holda sanadan. */
function xarajatOyi_(r) {
  var qolda = String(r[10] || '').trim();
  if (OY_REGEX.test(qolda)) return qolda;
  return qatorOyi_(r);
}

function qatorOyi_(r) {
  if (sanami_(r[1])) return oyMatni_(r[1]);
  var matn = String(r[0]).trim();
  return OY_REGEX.test(matn) ? matn : '';
}

/** 'Oy' va 'Holat' ustunlarini qayta hisoblab yozadi (faqat o'zgargan bo'lsa). */
function ustunlarniToldir_() {
  var ss = SpreadsheetApp.getActive();

  var dsh = talabSheet_(ss, SH.DAROMAD);
  var dOxirgi = oxirgiQator_(dsh, D_US.TUR);
  if (dOxirgi >= 2) {
    var qoidalar = daromadQoidalari_(ss);
    var dSoni = dOxirgi - 1;
    var dQatorlar = dsh.getRange(2, 1, dSoni, 3).getValues();
    var dOylar = [];
    var dOzgardi = false;
    for (var i = 0; i < dSoni; i++) {
      var oy = sanami_(dQatorlar[i][1]) ? daromadOyi_(dQatorlar[i], qoidalar) : '';
      dOylar.push([oy]);
      if (String(dQatorlar[i][0]) !== oy) dOzgardi = true;
    }
    if (dOzgardi) dsh.getRange(2, D_US.OY, dSoni, 1).setNumberFormat('@').setValues(dOylar);
  }

  var xsh = talabSheet_(ss, SH.XARAJAT);
  var xOxirgi = oxirgiQator_(xsh, X_US.JOY);
  if (xOxirgi < 2) return;
  var xSoni = xOxirgi - 1;
  var xQatorlar = xsh.getRange(2, 1, xSoni, 12).getValues();
  var bugunMatn = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var xOylar = [];
  var holatlar = [];
  var faktlar = [];
  var oyOzgardi = false;
  var holatOzgardi = false;
  var faktOzgardi = false;

  for (var j = 0; j < xSoni; j++) {
    var q = xQatorlar[j];
    var xOy = xarajatOyi_(q);
    xOylar.push([xOy]);
    if (String(q[0]) !== xOy) oyOzgardi = true;

    var fakt = Number(q[6]) || 0;
    var reja = Number(q[5]) || 0;
    var sanaMatn = sanami_(q[1])
      ? Utilities.formatDate(q[1], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '';
    var kechikkan = sanaMatn && sanaMatn < bugunMatn;

    // Avto to'lov: sana kelgan bo'lsa Fakt o'zi to'ldiriladi
    if (!fakt && q[11] === true && reja > 0 && sanaMatn && sanaMatn <= bugunMatn) {
      fakt = reja;
      faktOzgardi = true;
    }
    faktlar.push([fakt > 0 ? fakt : (q[6] === '' ? '' : q[6])]);

    var holat = '';
    if (String(q[2]).trim()) {
      if (fakt > 0) holat = "✅ To'landi";
      else if (reja > 0 || q[5] === '') holat = kechikkan ? "⚠️ Muddati o'tdi" : '⏳ Kutilmoqda';
      else holat = '—';
    }
    holatlar.push([holat]);
    if (String(q[8]) !== holat) holatOzgardi = true;
  }

  if (faktOzgardi) xsh.getRange(2, X_US.FAKT, xSoni, 1).setValues(faktlar);
  if (oyOzgardi) xsh.getRange(2, X_US.OY, xSoni, 1).setNumberFormat('@').setValues(xOylar);
  if (holatOzgardi) xsh.getRange(2, X_US.HOLAT, xSoni, 1).setValues(holatlar);

  bogliqlikniToldir_(ss);
  fondOyiniToldir_(talabSheet_(ss, SH.OZIM), O_US.MAQSAD);
}

/** Fond daftarlarida 'Oy' ustunini Sana'dan hisoblab yozadi. */
/**
 * Bog'lanish ustuni bo'sh bo'lgan qatorlarda nomi qarz nomi bilan aynan mos kelsa —
 * bog'lanishni avtomatik qo'yadi (eski yozuvlar ham ishlab ketishi uchun).
 */
function bogliqlikniToldir_(ss) {
  var qsh = talabSheet_(ss, SH.QARZ);
  var qOxirgi = oxirgiQator_(qsh, Q_US.NOMI);
  if (qOxirgi < QARZ_BOSH) return;

  var nomlar = {};
  qsh.getRange(QARZ_BOSH, Q_US.NOMI, qOxirgi - QARZ_BOSH + 1, 1).getValues().forEach(function (r) {
    var nom = String(r[0]).trim();
    if (nom) nomlar[kalit_(nom)] = nom;
  });

  var xsh = talabSheet_(ss, SH.XARAJAT);
  var xOxirgi = oxirgiQator_(xsh, X_US.JOY);
  if (xOxirgi < 2) return;
  var soni = xOxirgi - 1;
  var joylar = xsh.getRange(2, X_US.JOY, soni, 1).getValues();
  var boglar = xsh.getRange(2, X_US.QARZ, soni, 1).getValues();
  var ozgardi = false;
  for (var i = 0; i < soni; i++) {
    if (String(boglar[i][0]).trim()) continue;
    var mos = nomlar[kalit_(joylar[i][0])];
    if (mos) { boglar[i][0] = mos; ozgardi = true; }
  }
  if (ozgardi) xsh.getRange(2, X_US.QARZ, soni, 1).setValues(boglar);
}

function fondOyiniToldir_(sh, toliqUstun) {
  var oxirgi = oxirgiQator_(sh, toliqUstun);
  if (oxirgi < FOND_BOSH) return;
  var soni = oxirgi - FOND_BOSH + 1;
  var qatorlar = sh.getRange(FOND_BOSH, 1, soni, 2).getValues();
  var oylar = [];
  var ozgardi = false;
  for (var i = 0; i < soni; i++) {
    var oy = sanami_(qatorlar[i][1]) ? oyMatni_(qatorlar[i][1]) : '';
    oylar.push([oy]);
    if (String(qatorlar[i][0]) !== oy) ozgardi = true;
  }
  if (ozgardi) sh.getRange(FOND_BOSH, 1, soni, 1).setNumberFormat('@').setValues(oylar);
}

/** Foiz rejimida "o'zim uchun" rejasi oy daromadiga qarab qayta hisoblanadi. */
function ozimRejalariniYangila_(hammasi) {
  var ss = SpreadsheetApp.getActive();
  var sozlamalar = sozlamalarniOl_(ss);
  if (sozlamalar.ozimUsul !== 'Foiz') return;

  var xsh = talabSheet_(ss, SH.XARAJAT);
  hammasi.oylar.forEach(function (oy) {
    var x = hammasi.oyMap[oy];
    if (!x.ozimQatori) return;
    var katak = xsh.getRange(x.ozimQatori, X_US.REJA);
    var kerakli = ozimSummasi_(x.daromad, sozlamalar);
    if (Number(katak.getValue()) !== kerakli) katak.setValue(kerakli);
  });
}

function ozimSummasi_(daromad, sozlamalar) {
  return Math.round(daromad * sozlamalar.ozimQiymat / 100 / 1000) * 1000;
}

/** Sozlamalardagi kategoriya limitlari: {kategoriya: summa} */
/** Daromad turi → oy siljishi ({Oylik: -1, Avans: 0}). */
function daromadQoidalari_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var oxirgi = oxirgiQator_(sh, 16);
  var natija = {};
  if (oxirgi < SOZ_TEGISHLI_BOSH) return natija;
  sh.getRange(SOZ_TEGISHLI_BOSH, 16, oxirgi - SOZ_TEGISHLI_BOSH + 1, 2).getValues().forEach(function (r) {
    var tur = String(r[0]).trim();
    if (!tur) return;
    natija[kalit_(tur)] = kalit_(r[1]) === kalit_(TEGISHLI_OLDINGI) ? -1 : 0;
  });
  return natija;
}

/** Daromad qatori qaysi oyga tegishli: sana + tur qoidasi. */
function daromadOyi_(r, qoidalar) {
  if (!sanami_(r[1])) {
    var matn = String(r[0]).trim();
    return OY_REGEX.test(matn) ? matn : '';
  }
  var siljish = qoidalar[kalit_(r[2])] || 0;
  return oySurish_(oyMatni_(r[1]), siljish);
}

function oySurish_(oy, qadam) {
  if (!qadam) return oy;
  var q = String(oy).split('-');
  return oyMatni_(new Date(Number(q[0]), Number(q[1]) - 1 + qadam, 1));
}

function limitlarniOl_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var oxirgi = oxirgiQator_(sh, 8);
  var natija = {};
  if (oxirgi < SOZ_LIMIT_BOSH) return natija;
  sh.getRange(SOZ_LIMIT_BOSH, 8, oxirgi - SOZ_LIMIT_BOSH + 1, 2).getValues().forEach(function (r) {
    var nom = String(r[0]).trim();
    var limit = Number(r[1]) || 0;
    if (nom && limit > 0) natija[nom] = limit;
  });
  return natija;
}

/** Telefondagi tez qo'shish tugmalari. */
/** Qarz va haqlar ro'yxati (telefondagi bog'lanish uchun). */
function qarzNomlariniOl_(ss) {
  var sh = talabSheet_(ss, SH.QARZ);
  var oxirgi = oxirgiQator_(sh, Q_US.NOMI);
  if (oxirgi < QARZ_BOSH) return [];
  return sh.getRange(QARZ_BOSH, 1, oxirgi - QARZ_BOSH + 1, 2).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) {
      return { nomi: String(r[0]).trim(), mengami: String(r[1]).trim() === QARZ_TURLARI[1] };
    });
}

function tezTugmalarniOl_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var oxirgi = oxirgiQator_(sh, 11);
  if (oxirgi < SOZ_TEZ_BOSH) return [];
  return sh.getRange(SOZ_TEZ_BOSH, 11, oxirgi - SOZ_TEZ_BOSH + 1, 4).getValues()
    .filter(function (r) { return String(r[0]).trim() && Number(r[1]) > 0; })
    .map(function (r) {
      return {
        nomi: String(r[0]).trim(), summa: Number(r[1]),
        kategoriya: String(r[2] || 'Boshqa').trim(), usul: String(r[3] || 'Naqd').trim()
      };
    });
}

function eslatmaSozlamalari_(ss) {
  var sh = talabSheet_(ss, SH.SOZLAMALAR);
  var q = sh.getRange('I3:I8').getValues();
  return {
    telegram: String(q[0][0]).trim().toLowerCase() === 'ha',
    email: String(q[1][0]).trim(),
    kun: Math.max(0, Number(q[2][0]) || 0),
    soat: Math.min(23, Math.max(0, Number(q[3][0]) || 9)),
    oylik: String(q[4][0]).trim().toLowerCase() === 'ha',
    hisobotKuni: Math.min(28, Math.max(1, Number(q[5][0]) || 21))
  };
}

/** 💳 Qarzlarni hisoblaydi va avtomatik ustunlarni sheetga yozadi. */
/**
 * 💳 Qarzlarni hisoblaydi.
 * "Men qarzdorman" — bog'langan XARAJATLAR qarzni kamaytiradi.
 * "Menga qarzdor" — bog'langan DAROMADLAR (qaytarib berilgan pul) haqni kamaytiradi.
 */
function qarzlarniHisobla_(ss, bogJami, yozilsin) {
  var sh = talabSheet_(ss, SH.QARZ);
  var natija = { royxat: [], menQarzdor: 0, mengaQarzdor: 0, sof: 0, oylikJami: 0 };
  var oxirgi = oxirgiQator_(sh, Q_US.NOMI);
  if (oxirgi < QARZ_BOSH) {
    if (yozilsin) sh.getRange('B3:B5').setValues([[0], [0], [0]]);
    return natija;
  }

  var soni = oxirgi - QARZ_BOSH + 1;
  var qatorlar = sh.getRange(QARZ_BOSH, 1, soni, 9).getValues();
  var avto = [];
  qatorlar.forEach(function (r) {
    var nomi = String(r[0]).trim();
    var mengami = String(r[1]).trim() === QARZ_TURLARI[1];
    var umumiy = Number(r[2]) || 0;
    var oldin = Number(r[3]) || 0;
    var bog = bogJami[kalit_(nomi)] || { xarajat: 0, daromad: 0, kutilmoqda: 0 };
    // Qarzimni to'lasam — xarajat; haqimni qaytarib berishsa — daromad
    var ilovadan = mengami ? bog.daromad : bog.xarajat;
    var qolgan = Math.max(0, umumiy - oldin - ilovadan);
    var oylik = Number(r[6]) || 0;
    var qolganOy = oylik > 0 ? Math.ceil(qolgan / oylik) : 0;
    var tugash = qolgan === 0 ? '✅ Yopildi'
      : (qolganOy ? qolganOy + ' oy (' + oyQoshish_(qolganOy) + ')' : '—');

    avto.push([ilovadan, qolgan, oylik, tugash]);
    if (!nomi) return;
    if (mengami) natija.mengaQarzdor += qolgan;
    else { natija.menQarzdor += qolgan; natija.oylikJami += qolgan > 0 ? oylik : 0; }
    natija.royxat.push({
      nomi: nomi, turi: mengami ? QARZ_TURLARI[1] : QARZ_TURLARI[0], umumiy: umumiy,
      tolangan: oldin + ilovadan, qolgan: qolgan, oylik: oylik, qolganOy: qolganOy
    });
  });

  natija.sof = natija.mengaQarzdor - natija.menQarzdor;
  if (yozilsin) {
    sh.getRange(QARZ_BOSH, Q_US.ILOVADAN, soni, 4).setValues(avto);
    sh.getRange('B3:B5').setValues([[natija.menQarzdor], [natija.mengaQarzdor], [natija.sof]]);
  }
  return natija;
}

/** Tanlangan oyda qarz nomlariga mos tushgan to'lovlar yig'indisi. */
/** Tanlangan oyda qarz/haq bo'yicha harakat qilingan summa. */
function qarzTolovi_(x, qarz) {
  var jami = 0;
  qarz.royxat.forEach(function (d) {
    jami += x.bog[kalit_(d.nomi)] || 0;
  });
  return jami;
}

function oyQoshish_(oylar) {
  var sana = new Date();
  sana.setMonth(sana.getMonth() + oylar);
  return oyMatni_(sana);
}

/** 🎯 Maqsadlar: progress va prognozni hisoblab sheetga yozadi. */
function maqsadlarniHisobla_(ss, ortachaOrttirish, yozilsin) {
  var sh = talabSheet_(ss, SH.MAQSAD);
  var royxat = [];
  var oxirgi = oxirgiQator_(sh, M_US.NOMI);
  if (oxirgi < MAQSAD_BOSH) return royxat;

  var soni = oxirgi - MAQSAD_BOSH + 1;
  var qatorlar = sh.getRange(MAQSAD_BOSH, 1, soni, 8).getValues();
  var avto = [];
  qatorlar.forEach(function (r) {
    var nomi = String(r[0]).trim();
    var kerak = Number(r[1]) || 0;
    var yigilgan = Number(r[2]) || 0;
    var qolgan = Math.max(0, kerak - yigilgan);
    var foiz = kerak > 0 ? Math.min(1, yigilgan / kerak) : 0;
    var oyiga = Number(r[5]) || ortachaOrttirish || 0;
    var oylar = qolgan > 0 && oyiga > 0 ? Math.ceil(qolgan / oyiga) : 0;
    var prognoz = qolgan === 0 && kerak > 0 ? '✅ Yig\'ildi'
      : (oylar ? oylar + ' oy (' + oyQoshish_(oylar) + ')' : "— oyiga ajratma yo'q");

    avto.push([qolgan, foiz, prognoz]);
    if (!nomi || kerak <= 0) return;
    royxat.push({ nomi: nomi, kerak: kerak, yigilgan: yigilgan, qolgan: qolgan,
                  foiz: foiz, oyiga: oyiga, oylar: oylar, muddat: sanaMatni_(r[7]) });
  });

  if (yozilsin) {
    avto.forEach(function (q, i) {
      sh.getRange(MAQSAD_BOSH + i, M_US.QOLGAN, 1, 2).setValues([[q[0], q[1]]]);
      sh.getRange(MAQSAD_BOSH + i, M_US.PROGNOZ).setValue(q[2]);
    });
  }
  return royxat;
}

/** 📉 Oy oxirigacha prognoz (joriy oy uchun kunlik sur'atga qarab). */
/**
 * 📉 Oy oxirigacha prognoz. Daromad oy davomida bo'lib tushgani uchun (oylik 1–3,
 * kpi 5–8, avans 15–17...) joriy oyda hali kelmagan qismi o'rtachaga qarab kutiladi.
 */
function prognozHisobla_(x, umumiy) {
  var bugun = new Date();
  var joriyOy = oyMatni_(bugun);
  var qism = String(x.oy).split('-');
  var kunJami = new Date(Number(qism[0]), Number(qism[1]), 0).getDate();
  var joriymi = x.oy === joriyOy;
  var kunOtgan = joriymi ? Math.min(bugun.getDate(), kunJami) : kunJami;
  var kunlik = kunOtgan > 0 ? x.xarajat / kunOtgan : 0;
  var oyOxiriSarf = joriymi ? Math.round(kunlik * kunJami) : x.xarajat;

  // O'tgan oylarning o'rtacha daromadi (shu oyning o'zi hisobga olinmaydi)
  var boshqaOylar = Math.max(0, umumiy.oylarSoni - (joriymi ? 1 : 0));
  var ortachaDaromad = boshqaOylar > 0
    ? Math.round((umumiy.daromad - (joriymi ? x.daromad : 0)) / boshqaOylar) : 0;
  var kutilayotgan = joriymi ? Math.max(x.daromad, ortachaDaromad) : x.daromad;

  return {
    joriymi: joriymi, kunOtgan: kunOtgan, kunJami: kunJami,
    kunlik: Math.round(kunlik),
    oyOxiriSarf: oyOxiriSarf,
    kutilayotganDaromad: kutilayotgan,
    daromadKutilmoqda: joriymi && kutilayotgan > x.daromad,
    oyOxiriQoldiq: kutilayotgan - oyOxiriSarf,
    ortachaXarajat: umumiy.oylarSoni ? Math.round(umumiy.xarajat / umumiy.oylarSoni) : 0
  };
}

/** 🔒 Yopilgan oylar ro'yxati. */
function yopilganOylar_() {
  var matn = PropertiesService.getDocumentProperties().getProperty('yopilganOylar') || '';
  var natija = {};
  matn.split(',').forEach(function (oy) {
    if (OY_REGEX.test(oy.trim())) natija[oy.trim()] = true;
  });
  return natija;
}

function yopilganOylarniYoz_(map) {
  PropertiesService.getDocumentProperties()
    .setProperty('yopilganOylar', Object.keys(map).sort().join(','));
}

function kamayishBoyicha_(a, b) {
  return b.summa - a.summa;
}

/** Hisobot va Yillik sheetlarini qayta chizadi (menyu va onEdit shuni chaqiradi). */
function hisobotniYangilash() {
  ustunlarniToldir_();
  var hammasi = hammaXulosalar_();
  ozimRejalariniYangila_(hammasi);
  hisobotlarniChiz_(hammasi);
}

function hisobotlarniChiz_(hammasi) {
  var ss = SpreadsheetApp.getActive();
  hammasi.qarz = qarzlarniHisobla_(ss, hammasi.bogJami, true);
  hammasi.maqsadlar = maqsadlarniHisobla_(ss, hammasi.umumiy.ortacha, true);
  var oy = joriyHisobotOyi_();
  hisobotniChiz_(oyniAjrat_(hammasi, oy), hammasi);
  yillikniChiz_(hammasi);
  fondlarniChiz_(hammasi);
  oylarRoyxatiniYoz_(hammasi.oylar);
}

/** Hisobot!B2 dagi oy. Sanaga aylanib ketgan bo'lsa matnga qaytaradi. */
function joriyHisobotOyi_() {
  var katak = talabSheet_(SpreadsheetApp.getActive(), SH.HISOBOT).getRange('B2');
  var qiymat = katak.getValue();
  if (OY_REGEX.test(String(qiymat))) return String(qiymat);

  var oy = sanami_(qiymat) ? oyMatni_(qiymat) : oyMatni_(new Date());
  katak.setNumberFormat('@').setValue(oy);
  return oy;
}

function hisobotniChiz_(x, hammasi) {
  var ss = SpreadsheetApp.getActive();
  var sh = talabSheet_(ss, SH.HISOBOT);
  var umumiy = hammasi.umumiy;

  var matritsa = HISOBOT_TURLARI.map(function (tur) {
    var q = x.matritsa[tur] || { Karta: 0, Naqd: 0 };
    return [q.Karta, q.Naqd, q.Karta + q.Naqd];
  });
  sh.getRange(6, 2, matritsa.length, 3).setValues(matritsa);
  sh.getRange('B10:D10').setValues([[x.daromadKarta, x.daromadNaqd, x.daromad]]);

  var royxatdanTashqari = x.daromad - matritsa.reduce(function (s, q) { return s + q[2]; }, 0);
  var yopilganmi = hammasi.yopilgan[x.oy];
  sh.getRange('A11')
    .setValue((yopilganmi ? "🔒 Bu oy yopilgan. " : '') +
      (royxatdanTashqari > 0 ? "⚠ Ro'yxatdan tashqari daromad turlari: " + royxatdanTashqari : ''))
    .setFontColor(yopilganmi ? '#6A1B9A' : '#EF6C00');

  sh.getRange('B14:B23').setValues([
    [x.daromad], [x.xarajat], [x.ozim], [x.reja], [x.tolanmaganJami],
    [x.qoldiq], [x.prognoz], [x.karta], [x.naqd],
    [x.daromad > 0 ? x.xarajat / x.daromad : 0]
  ]);

  sh.getRange('B26:B30').setValues([
    [x.orttirgan], [x.orttirganFoiz], [umumiy.qoldiq], [umumiy.ortacha], [umumiy.oylarSoni + ' oy']
  ]);

  var p = prognozHisobla_(x, umumiy);
  sh.getRange('B33:B38').setValues([
    [p.kunOtgan + ' / ' + p.kunJami + ' kun' + (p.joriymi ? '' : ' (tugagan)')],
    [p.kunlik], [p.oyOxiriSarf],
    [p.kutilayotganDaromad], [p.oyOxiriQoldiq], [p.ortachaXarajat]
  ]);
  sh.getRange('C36').setValue(p.daromadKutilmoqda
    ? "⬆ hozircha kelgani " + son_(x.daromad) + ", qolgani o'rtachaga qarab kutilmoqda"
    : '').setFontColor('#78909C').setFontStyle('italic');

  sh.getRange('G5:G7').setValues([[x.ozim], [x.ozimSarf], [hammasi.ozimFond.qoldiq]]);
  sh.getRange('G10:G12').setValues([[x.oldingiToplangan], [x.qoldiq], [x.toplangan]]);

  var qarz = hammasi.qarz;
  var shuOyda = qarzTolovi_(x, qarz);
  sh.getRange('G15:G19').setValues([
    [qarz.menQarzdor], [qarz.mengaQarzdor], [qarz.oylikJami], [shuOyda], [qarz.sof]
  ]);
  x.qarzTolovi = shuOyda;

  jadvalYoz_(sh, 23, 6, 4,
    hammasi.maqsadlar.slice(0, 7).map(function (m) { return [m.nomi, m.kerak, m.yigilgan, m.foiz]; }),
    ["Maqsad qo'shilmagan", '', '', ''], 7);

  jadvalYoz_(sh, 42, 1, 5, x.kategoriyalar.map(function (k) {
    var limit = hammasi.limitlar[k.nom] || 0;
    return [k.nom, k.reja, k.summa, limit || '', limit ? k.summa / limit : ''];
  }), ["Bu oyda xarajat yozuvi yo'q", '', '', '', '']);

  jadvalYoz_(sh, 33, 6, 4,
    x.tolanmagan.map(function (t) { return [t.sana, t.joy, t.kategoriya, t.reja || '?']; }),
    ["Barchasi to'langan ✅", '', '', '']);

  limitRanglari_(sh, x.kategoriyalar.length);
}

/** Limitdan oshgan kategoriyalarni qizil, yaqinlashganini sariq qiladi. */
function limitRanglari_(sh, soni) {
  var range = sh.getRange(42, 5, Math.max(soni, 1), 1);
  var qoidalar = sh.getConditionalFormatRules().filter(function (q) {
    return q.getRanges().every(function (r) { return r.getColumn() !== 5 || r.getRow() !== 42; });
  });
  qoidalar.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(1)
    .setBackground('#FFCDD2').setFontColor('#B71C1C').setRanges([range]).build());
  qoidalar.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.8, 1)
    .setBackground('#FFE0B2').setFontColor('#E65100').setRanges([range]).build());
  sh.setConditionalFormatRules(qoidalar);
}

function fondlarniChiz_(hammasi) {
  var ss = SpreadsheetApp.getActive();
  var o = hammasi.ozimFond;
  talabSheet_(ss, SH.OZIM).getRange('B3:B5')
    .setValues([[o.ajratilgan], [o.sarflangan], [o.qoldiq]]);

  var jsh = talabSheet_(ss, SH.JAMGARMA);
  var j = hammasi.jamgarma;
  jsh.getRange('B3:B4').setValues([[j.qoldiq], [j.oylarSoni + ' oy']]);
  var joriyOy = oyMatni_(new Date());
  jadvalYoz_(jsh, JAMGARMA_BOSH, 1, 5,
    j.oylar.map(function (q) {
      return [q.oy + (q.oy === joriyOy ? ' ⏳' : ''), q.daromad, q.xarajat, q.qoldiq, q.toplangan];
    }),
    ["Hali yozuv yo'q", '', '', '', '']);
}

function yillikniChiz_(hammasi) {
  var sh = talabSheet_(SpreadsheetApp.getActive(), SH.YILLIK);
  var qatorlar = hammasi.oylar.map(function (oy) {
    var x = hammasi.oyMap[oy];
    return [oy + (hammasi.yopilgan[oy] ? ' 🔒' : ''), x.daromad, x.xarajat, x.ozim,
            x.qoldiq, x.ozimSarf, x.orttirgan, x.orttirganFoiz];
  });

  var u = hammasi.umumiy;
  if (qatorlar.length) {
    qatorlar.push([
      'JAMI', u.daromad, u.xarajat, u.ozim, u.qoldiq,
      hammasi.ozimFond.sarflangan, u.orttirgan, u.daromad > 0 ? u.orttirgan / u.daromad : 0
    ]);
  }

  // Avvalgi chizishdan qolgan "JAMI" bezagini tozalaymiz
  sh.getRange(4, 1, 400, 8).setFontWeight('normal').setBackground(null);
  jadvalYoz_(sh, 4, 1, 8, qatorlar, ["Hali yozuv yo'q", '', '', '', '', '', '', '']);
  if (qatorlar.length) {
    sh.getRange(3 + qatorlar.length, 1, 1, 8).setFontWeight('bold').setBackground('#FFF9C4');
  }
}

function oylarRoyxatiniYoz_(oylar) {
  var sh = talabSheet_(SpreadsheetApp.getActive(), SH.ROYXAT);
  var kamayish = oylar.slice().reverse();
  jadvalYoz_(sh, 2, 5, 1, kamayish.map(function (oy) { return [oy]; }), ['']);
}

/** Jadval maydonini tozalab, yangi qatorlarni bitta yozuvda joylashtiradi. */
/** Jadval maydonini tozalab, yangi qatorlarni bitta yozuvda joylashtiradi. */
function jadvalYoz_(sh, qator, ustun, kenglik, qatorlar, boshMatn, maksimal) {
  var tozalanadi = maksimal || 400;
  sh.getRange(qator, ustun, tozalanadi, kenglik).clearContent();
  var yoziladi = qatorlar.length ? qatorlar.slice(0, tozalanadi) : [boshMatn];
  sh.getRange(qator, ustun, yoziladi.length, kenglik).setValues(yoziladi);
}


/** ===================== Telegram va email ===================== */

function telegramSozlash() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var javob = ui.prompt('🤖 Telegram sozlash',
    "1) Telegramda @BotFather ga /newbot yozib bot yarating.\n" +
    "2) U bergan tokenni shu yerga joylashtiring:",
    ui.ButtonSet.OK_CANCEL);
  if (javob.getSelectedButton() !== ui.Button.OK) return;

  var token = javob.getResponseText().trim();
  if (!/^\d+:[\w-]{20,}$/.test(token)) {
    ui.alert("❌ Token formati noto'g'ri", "Token 123456789:AAxx... ko'rinishida bo'ladi.", ui.ButtonSet.OK);
    return;
  }
  props.setProperty('telegramToken', token);

  ui.alert('🤖 Keyingi qadam',
    "Telegramda o'z botingizni oching va unga /start yoki istalgan xabar yozing.\n\n" +
    "So'ng shu oynadagi OK ni bosing — chat avtomatik aniqlanadi.", ui.ButtonSet.OK);

  var chatId = telegramChatIdAniqla_(token);
  if (!chatId) {
    ui.alert('❌ Chat topilmadi',
      "Botga xabar yozganingizga ishonch hosil qilib, '🤖 Telegram sozlash' ni qayta bosing.",
      ui.ButtonSet.OK);
    return;
  }
  props.setProperty('telegramChatId', chatId);
  telegramYubor_("✅ <b>Oylik byudjet</b> ulandi. Eslatmalar shu yerga keladi.");
  ui.alert('✅ Tayyor', 'Telegram ulandi. Test xabari yuborildi.', ui.ButtonSet.OK);
}

function telegramChatIdAniqla_(token) {
  var javob = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates',
    { muteHttpExceptions: true });
  var natija = JSON.parse(javob.getContentText());
  if (!natija.ok || !natija.result.length) return '';
  var oxirgi = natija.result[natija.result.length - 1];
  var xabar = oxirgi.message || oxirgi.edited_message || {};
  return xabar.chat ? String(xabar.chat.id) : '';
}

/** Telegramga xabar yuboradi. Sozlanmagan bo'lsa jimgina o'tkazib yuboradi. */
/** Telegramga xabar yuboradi. {ok, sabab} qaytaradi. */
function telegramYubor_(matn) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('telegramToken');
  var chatId = props.getProperty('telegramChatId');
  if (!token || !chatId) {
    return { ok: false, sabab: "Telegram sozlanmagan (menyu → ⚙️ Sozlash → 🤖 Telegram sozlash)" };
  }

  var javob = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: chatId, text: matn, parse_mode: 'HTML' })
  });
  if (javob.getResponseCode() !== 200) {
    Logger.log('Telegram xatosi: ' + javob.getContentText());
    return { ok: false, sabab: 'Telegram javobi: ' + javob.getContentText().slice(0, 200) };
  }
  return { ok: true, sabab: '' };
}

function emailYubor_(mavzu, matn) {
  var email = eslatmaSozlamalari_(SpreadsheetApp.getActive()).email;
  if (!email) return { ok: false, sabab: "Email manzil kiritilmagan (Sozlamalar → I4)" };
  MailApp.sendEmail(email, mavzu, matn.replace(/<[^>]+>/g, ''));
  return { ok: true, sabab: '' };
}

/** Telegram va emailga yuboradi, natijani hisobot qilib qaytaradi. */
function xabarYubor_(mavzu, matn) {
  var soz = eslatmaSozlamalari_(SpreadsheetApp.getActive());
  var natija = { yuborildi: [], xatolar: [] };

  if (soz.telegram) {
    var t = telegramYubor_(matn);
    if (t.ok) natija.yuborildi.push('Telegram'); else natija.xatolar.push('Telegram: ' + t.sabab);
  }
  if (soz.email) {
    var e = emailYubor_(mavzu, matn);
    if (e.ok) natija.yuborildi.push('Email'); else natija.xatolar.push('Email: ' + e.sabab);
  }
  if (!soz.telegram && !soz.email) {
    natija.xatolar.push("Sozlamalarda Telegram ham, email ham yoqilmagan (I3 / I4)");
  }
  return natija;
}

function testXabar() {
  var natija = xabarYubor_('Oylik byudjet — test',
    "🔔 <b>Test xabar</b>\nEslatmalar shu ko'rinishda keladi.");
  natijaniKorsat_('📨 Test xabar', natija, 'Test xabari yuborildi');
}

/** Yuborish natijasini foydalanuvchiga ko'rsatadi. */
function natijaniKorsat_(sarlavha, natija, muvaffaqiyatMatni) {
  var ui = SpreadsheetApp.getUi();
  var qatorlar = [];
  if (natija.yuborildi.length) qatorlar.push('✅ ' + muvaffaqiyatMatni + ': ' + natija.yuborildi.join(', '));
  if (natija.xatolar.length) qatorlar.push('⚠️ Yuborilmadi:\n  • ' + natija.xatolar.join('\n  • '));
  if (natija.izoh) qatorlar.push(natija.izoh);
  ui.alert(sarlavha, qatorlar.join('\n\n'), ui.ButtonSet.OK);
}

/** ===================== Eslatma va hisobot ===================== */

/** Har kuni ishlaydi: yaqinlashgan va kechikkan to'lovlarni xabar qiladi. */
function kunlikEslatma() {
  var ss = SpreadsheetApp.getActive();
  var soz = eslatmaSozlamalari_(ss);
  if (!soz.telegram && !soz.email) {
    return { yuborildi: [], xatolar: ["Sozlamalarda Telegram ham, email ham yoqilmagan"] };
  }

  // Avto to'lovlar shu yerda ham bajariladi — jadvalni ochmasangiz ham ishlaydi
  ustunlarniToldir_();

  var hammasi = hammaXulosalar_();
  var bugun = new Date();
  var bugunMatn = Utilities.formatDate(bugun, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var chegara = new Date(bugun.getTime() + soz.kun * 86400000);
  var chegaraMatn = Utilities.formatDate(chegara, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');

  var kechikkan = [], bugungi = [], yaqin = [];
  hammasi.oylar.forEach(function (oy) {
    hammasi.oyMap[oy].tolanmagan.forEach(function (t) {
      if (!t.sanaTolik) return;
      if (t.sanaTolik < bugunMatn) kechikkan.push(t);
      else if (t.sanaTolik === bugunMatn) bugungi.push(t);
      else if (t.sanaTolik <= chegaraMatn) yaqin.push(t);
    });
  });
  if (!kechikkan.length && !bugungi.length && !yaqin.length) {
    return { yuborildi: [], xatolar: [], izoh: "Eslatadigan to'lov yo'q — hammasi to'langan yoki muddati yaqin emas." };
  }

  var qator = function (t) {
    return '  • ' + t.joy + ' — ' + (t.nomalum ? "summa o'zgaruvchi" : son_(t.reja)) + ' (' + t.sana + ')';
  };
  var matn = ['🔔 <b>To\'lov eslatmasi</b> — ' + sanaMatni_(bugun)];
  if (kechikkan.length) matn.push('', '⚠️ <b>Muddati o\'tgan:</b>', kechikkan.map(qator).join('\n'));
  if (bugungi.length) matn.push('', '📌 <b>Bugun to\'lanadi:</b>', bugungi.map(qator).join('\n'));
  if (yaqin.length) matn.push('', '🗓 <b>Yaqin kunlarda:</b>', yaqin.map(qator).join('\n'));

  var joriy = hammasi.oyMap[oyMatni_(bugun)];
  if (joriy) {
    matn.push('', "💰 Byudjet qoldig'i: <b>" + son_(joriy.qoldiq) + "</b> so'm");
  }
  return xabarYubor_("To'lov eslatmasi", matn.join('\n'));
}

/** Har oyning 1-sanasida: o'tgan oy yakunini yuboradi. */
function oylikHisobotYubor(tanlanganOy) {
  var ss = SpreadsheetApp.getActive();
  if (!tanlanganOy && !eslatmaSozlamalari_(ss).oylik) {
    return { yuborildi: [], xatolar: ["Sozlamalarda 'Oylik hisobot' o'chirilgan (I7)"] };
  }

  var otgan = new Date();
  otgan.setMonth(otgan.getMonth() - 1);
  var oy = OY_REGEX.test(String(tanlanganOy || '')) ? String(tanlanganOy) : oyMatni_(otgan);
  var hammasi = hammaXulosalar_();
  var x = hammasi.oyMap[oy];
  if (!x) {
    return { yuborildi: [], xatolar: [],
      izoh: oy + " oyi uchun yozuv yo'q — hisobot yuborilmadi.\nMavjud oylar: " +
        (hammasi.oylar.length ? hammasi.oylar.join(', ') : "yo'q") };
  }

  hammasi.qarz = qarzlarniHisobla_(ss, hammasi.bogJami, false);
  // Daromad odatdagidan ancha kam bo'lsa — yozuvlar to'liq kiritilmagan bo'lishi mumkin
  var boshqaOylar = hammasi.umumiy.oylarSoni - 1;
  var ortachaDaromad = boshqaOylar > 0
    ? (hammasi.umumiy.daromad - x.daromad) / boshqaOylar : 0;
  var shubhali = ortachaDaromad > 0 && x.daromad < ortachaDaromad * 0.6;

  var matn = [
    '📊 <b>' + oy + ' yakuni</b>',
    '',
    'Daromad: <b>' + son_(x.daromad) + "</b> so'm",
    'Xarajat: <b>' + son_(x.xarajat) + "</b> so'm",
    "💰 Qoldiq: <b>" + son_(x.qoldiq) + "</b> so'm",
    '📈 Orttirgan: <b>' + son_(x.orttirgan) + "</b> so'm (" + Math.round(x.orttirganFoiz * 100) + '%)',
    '',
    "👤 O'zim uchun fondi: " + son_(hammasi.ozimFond.qoldiq) + " so'm",
    "🏦 Jamg'arma: " + son_(hammasi.jamgarma.qoldiq) + " so'm"
  ];

  if (hammasi.qarz.menQarzdor > 0) {
    matn.push('💳 Qolgan qarz: ' + son_(hammasi.qarz.menQarzdor) + " so'm");
  }
  if (x.kategoriyalar.length) {
    matn.push('', '<b>Eng ko\'p sarflangan:</b>');
    x.kategoriyalar.slice(0, 5).forEach(function (k) {
      matn.push('  • ' + k.nom + ' — ' + son_(k.summa));
    });
  }
  var oshgan = x.kategoriyalar.filter(function (k) {
    var limit = hammasi.limitlar[k.nom];
    return limit && k.summa > limit;
  });
  if (oshgan.length) {
    matn.push('', '⚠️ <b>Limitdan oshgan:</b>');
    oshgan.forEach(function (k) {
      matn.push('  • ' + k.nom + ' — ' + son_(k.summa) + ' / ' + son_(hammasi.limitlar[k.nom]));
    });
  }
  if (shubhali) {
    matn.push('', "⚠️ <b>Diqqat:</b> bu oy daromadi odatdagidan ancha kam (o'rtacha " +
      son_(ortachaDaromad) + "). Barcha yozuvlar kiritilganini tekshiring.");
  }
  return xabarYubor_(oy + ' oylik hisobot', matn.join('\n'));
}

/**
 * Web app havolasi haqiqatan ishlayaptimi? 404 bo'lsa deployment yo'q degani.
 * {url, ishlaydi, sabab} qaytaradi.
 */
/**
 * Web app havolasi. Avval qo'lda saqlangani olinadi — ScriptApp.getService().getUrl()
 * ba'zan eski (o'chirilgan) deployment manzilini qaytaradi, shuning uchun unga tayanmaymiz.
 */
function webAppUrl_() {
  var saqlangan = PropertiesService.getScriptProperties().getProperty('webAppUrl');
  if (saqlangan) return saqlangan;
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

/** Havola haqiqatan ochiladimi? {url, ishlaydi, sabab, saqlangan} */
function webAppHolati_() {
  var saqlangan = !!PropertiesService.getScriptProperties().getProperty('webAppUrl');
  var url = webAppUrl_();
  if (!url) return { url: '', ishlaydi: false, saqlangan: false, sabab: 'Havola hali kiritilmagan' };

  try {
    var javob = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: false });
    var status = javob.getResponseCode();
    // 200 — ochildi, 302 — Google loginiga yo'naltirdi (mavjud), 404 — yo'q
    if (status === 404) {
      return { url: url, ishlaydi: false, saqlangan: saqlangan,
        sabab: 'Havolada deployment topilmadi (404)' };
    }
    return { url: url, ishlaydi: true, saqlangan: saqlangan, sabab: '' };
  } catch (e) {
    return { url: url, ishlaydi: true, saqlangan: saqlangan, sabab: '' };
  }
}

/** Havolani qo'lda kiritish/yangilash. */
function havolaniSaqla() {
  var ui = SpreadsheetApp.getUi();
  var javob = ui.prompt('🔗 Ilova havolasini saqlash',
    "Apps Script → Начать развертывание → Управление развертываниями →\n" +
    "faol deployment yonidagi «URL веб-приложения» ni «Копировать» bilan oling\n" +
    "va shu yerga joylashtiring (oxiri /exec):",
    ui.ButtonSet.OK_CANCEL);
  if (javob.getSelectedButton() !== ui.Button.OK) return '';

  var url = javob.getResponseText().trim().split('?')[0];
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/(exec|dev)$/.test(url)) {
    ui.alert("❌ Havola noto'g'ri",
      "Havola shunday ko'rinishda bo'lishi kerak:\n" +
      'https://script.google.com/macros/s/AKfycb.../exec', ui.ButtonSet.OK);
    return '';
  }

  PropertiesService.getScriptProperties().setProperty('webAppUrl', url);
  var holat = webAppHolati_();
  if (!holat.ishlaydi) {
    ui.alert('⚠️ Havola saqlandi, lekin ochilmadi',
      holat.sabab + ".\n\nDeployment o'chirilgan bo'lishi mumkin — yangisini yarating va " +
      'havolani qayta saqlang.', ui.ButtonSet.OK);
    return url;
  }
  return url;
}

var DEPLOY_YORIQNOMA =
  "Apps Script muharririda:\n" +
  "1) Начать развертывание → Новое развертывание\n" +
  "2) Chapdagi ⚙️ (Выберите тип) → Веб-приложение\n" +
  "3) Запуск от имени: Я · У кого есть доступ: Только я\n" +
  "4) Ko'k «РАЗВЕРНУТЬ» tugmasini bosing (shu qadam ko'pincha o'tkazib yuboriladi)\n" +
  "5) Chiqqan «URL веб-приложения» (oxiri /exec) ni «Копировать» bilan oling\n\n" +
  "Tekshirish: Начать развертывание → Управление развертываниями — faol deployment ro'yxatda bo'lishi kerak.";

/** Menyu: web app havolasini Telegram/emailga yuboradi — telefonda ochish oson bo'lsin. */
/** Menyu: web app havolasini Telegram/emailga yuboradi — telefonda ochish oson bo'lsin. */
function havolaniYubor() {
  var ui = SpreadsheetApp.getUi();
  var holat = webAppHolati_();
  if (!holat.ishlaydi) {
    ui.alert('📲 Havola yuborish',
      '⚠️ ' + holat.sabab + ".\n\nMenyu → ⚙️ Sozlash → 🔗 Havolani saqlash orqali to'g'ri havolani kiriting.",
      ui.ButtonSet.OK);
    return;
  }

  var url = toliqHavola_(holat.url);
  var natija = xabarYubor_('Oylik byudjet — ilova havolasi',
    "📱 <b>Oylik byudjet ilovasi</b>\n\n" + url +
    "\n\nTelefonda Chrome'da oching va bosh ekranga qo'shing.");
  natija.izoh = 'Havola: ' + url;
  natijaniKorsat_('📲 Havola', natija, 'Havola yuborildi');
}

/** Menyu: eslatmani hozir tekshirish. */
function eslatmaniHozirTekshir() {
  natijaniKorsat_('🔔 Eslatma', kunlikEslatma(), 'Eslatma yuborildi');
}

/** Menyu: oylik hisobotni hozir yuborish (oyni so'raydi). */
function oylikHisobotniHozirYubor() {
  var ui = SpreadsheetApp.getUi();
  var otgan = new Date();
  otgan.setMonth(otgan.getMonth() - 1);
  var standart = oyMatni_(otgan);

  var javob = ui.prompt('📊 Oylik hisobot',
    "Qaysi oy uchun yuboramiz? (bo'sh qoldirsangiz: " + standart + ')', ui.ButtonSet.OK_CANCEL);
  if (javob.getSelectedButton() !== ui.Button.OK) return;

  var oy = (javob.getResponseText() || standart).trim();
  if (!OY_REGEX.test(oy)) { ui.alert("❌ Oy YYYY-MM ko'rinishida bo'lishi kerak."); return; }
  natijaniKorsat_('📊 ' + oy + ' hisoboti', oylikHisobotYubor(oy), 'Hisobot yuborildi');
}

function son_(qiymat) {
  return Math.round(Number(qiymat) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** ===================== Oyni yopish ===================== */

function oyniYopish() {
  var ui = SpreadsheetApp.getUi();
  var joriy = joriyHisobotOyi_();
  var javob = ui.prompt('🔒 Oyni yopish',
    "Qaysi oyni yopamiz? (bo'sh qoldirsangiz: " + joriy + ")\n" +
    "Yopilgan oydagi qatorni o'zgartirsangiz ogohlantirish chiqadi.", ui.ButtonSet.OK_CANCEL);
  if (javob.getSelectedButton() !== ui.Button.OK) return;

  var oy = (javob.getResponseText() || joriy).trim();
  if (!OY_REGEX.test(oy)) { ui.alert("❌ Oy YYYY-MM ko'rinishida bo'lishi kerak."); return; }

  var yopilgan = yopilganOylar_();
  yopilgan[oy] = true;
  yopilganOylarniYoz_(yopilgan);
  hisobotniYangilash();
  ui.alert('🔒 ' + oy + ' yopildi', "Yillik sheetida 🔒 belgisi paydo bo'ladi.", ui.ButtonSet.OK);
}

function oyniQaytaOchish() {
  var ui = SpreadsheetApp.getUi();
  var yopilgan = yopilganOylar_();
  var royxat = Object.keys(yopilgan).sort();
  if (!royxat.length) { ui.alert("Yopilgan oy yo'q."); return; }

  var javob = ui.prompt('🔓 Oyni qayta ochish',
    'Yopilganlar: ' + royxat.join(', ') + "\n\nQaysi oyni ochamiz?", ui.ButtonSet.OK_CANCEL);
  if (javob.getSelectedButton() !== ui.Button.OK) return;

  var oy = javob.getResponseText().trim();
  if (!yopilgan[oy]) { ui.alert('❌ Bu oy yopilganlar ro\'yxatida yo\'q.'); return; }
  delete yopilgan[oy];
  yopilganOylarniYoz_(yopilgan);
  hisobotniYangilash();
  ui.alert('🔓 ' + oy + ' qayta ochildi.');
}

/** ===================== Tashxis ===================== */

/**
 * Jadvalni to'liq tekshiradi va topilgan muammolarni nusxalash mumkin bo'lgan
 * ro'yxat ko'rinishida chiqaradi.
 */
/**
 * Jadvalni tekshiradi. Muammo topilsa avtomatik tuzatib, qaytadan tekshiradi
 * va natijani nusxalanadigan ro'yxat ko'rinishida chiqaradi.
 */
function tashxis() {
  // Trigger o'rnatish ma'lumotga tegmaydi — tuzatish bosqichini kutmasdan darhol bajaramiz.
  var triggerXatosi = '';
  try {
    triggerlarniOrnat_();
  } catch (e) {
    triggerXatosi = e.message;
  }

  var oldin = tashxisSkan_();
  if (triggerXatosi) {
    oldin.xato.push("❌ Avtomatik yangilash triggeri o'rnatilmadi: " + triggerXatosi +
      "\n     Apps Script muharririda istalgan funksiyani bir marta ishga tushirib, " +
      "Google so'ragan ruxsatni bering.");
  }
  var qatorlar = ['=== TASHXIS: ' + hozir_() + ' ==='];

  qatorlar.push('');
  qatorlar.push('--- TOPILGAN MUAMMOLAR (' + muammoSoni_(oldin.xato) + ') ---');
  qatorlar = qatorlar.concat(oldin.xato.length ? oldin.xato : ['✅ Muammo topilmadi.']);

  if (oldin.xato.length) {
    var tamirXatolari = tamirla_();
    var keyin = tashxisSkan_();

    qatorlar.push('');
    qatorlar.push('--- AVTOMATIK TUZATISH ---');
    if (tamirXatolari.length) {
      qatorlar = qatorlar.concat(tamirXatolari);
    } else {
      qatorlar.push("✅ Barcha sheetlar qayta qurildi, hisobot qaytadan hisoblandi.");
    }
    qatorlar.push('');
    qatorlar.push('--- TUZATISHDAN KEYIN (' + muammoSoni_(keyin.xato) + ') ---');
    qatorlar = qatorlar.concat(keyin.xato.length ? keyin.xato : ['✅ Muammo qolmadi.']);
    oldin = keyin;
  }

  qatorlar.push('');
  qatorlar.push('--- OGOHLANTIRISHLAR (' + oldin.ogoh.length + ') ---');
  qatorlar = qatorlar.concat(oldin.ogoh.length ? oldin.ogoh : ["✅ Yo'q."]);
  qatorlar.push('');
  qatorlar.push('--- HOLAT ---');
  qatorlar = qatorlar.concat(oldin.malumot);

  return hisobotniKorsat_(qatorlar);
}

/** Ro'yxatdagi haqiqiy muammolar soni (bo'sh joy bilan boshlangan tafsilot qatorlarisiz). */
function muammoSoni_(royxat) {
  return royxat.filter(function (q) { return q.charAt(0) !== ' '; }).length;
}

function hozir_() {
  return Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
}

/** Jadvalni tekshiradi, hech narsani o'zgartirmaydi. */
function tashxisSkan_() {
  var ss = SpreadsheetApp.getActive();
  var xato = [];
  var ogoh = [];
  var malumot = [];

  malumot.push('Skript versiyasi: ' + SKRIPT_VERSIYASI);
  malumot.push('Jadval nomi: ' + ss.getName());
  malumot.push('Vaqt zonasi: ' + ss.getSpreadsheetTimeZone());
  malumot.push('Lokal: ' + ss.getSpreadsheetLocale());

  // Sarlavhalar to'liqmi — ustun qo'shilmay qolgan bo'lsa shu yerda ko'rinadi
  Object.keys(SARLAVHALAR).forEach(function (kalit) {
    var kutilgan = SARLAVHALAR[kalit];
    var sh = ss.getSheetByName(SH[kalit]);
    if (!sh) return;
    var bor = sh.getRange(kutilgan.qator, 1, 1, kutilgan.ustunlar.length).getValues()[0];
    var yetishmagan = [];
    kutilgan.ustunlar.forEach(function (nom, i) {
      if (String(bor[i]).trim() !== nom) {
        yetishmagan.push(ustunHarfi_(i + 1) + kutilgan.qator + " ('" + (bor[i] || "bo'sh") + "' → '" + nom + "')");
      }
    });
    if (yetishmagan.length) {
      xato.push('❌ ' + SH[kalit] + ' sarlavhalari mos emas: ' + yetishmagan.join(', '));
    }
  });

  var joriyTuzilma = PropertiesService.getDocumentProperties().getProperty('tuzilma');
  if (joriyTuzilma !== TUZILMA_VERSIYASI) {
    xato.push("❌ Sheet maketi eskirgan (" + (joriyTuzilma || 'belgilanmagan') + ' → ' +
      TUZILMA_VERSIYASI + ") — sheetlar qayta qurilishi kerak.");
  }
  malumot.push('Sheet maketi: ' + (joriyTuzilma || 'belgilanmagan') + ' (kerakli: ' + TUZILMA_VERSIYASI + ')');

  var kerakli = [SH.HISOBOT, SH.DAROMAD, SH.XARAJAT, SH.OZIM, SH.JAMGARMA, SH.QARZ, SH.MAQSAD, SH.SOZLAMALAR, SH.YILLIK, SH.ROYXAT];
  var mavjudNomlar = ss.getSheets().map(function (sh) { return sh.getName(); });
  kerakli.forEach(function (nom) {
    if (mavjudNomlar.indexOf(nom) === -1) xato.push("❌ '" + nom + "' sheeti yo'q.");
  });
  malumot.push('Sheetlar: ' + mavjudNomlar.join(', '));
  if (xato.length) return { xato: xato, ogoh: ogoh, malumot: malumot };

  try {
    HtmlService.createHtmlOutputFromFile('Ilova');
  } catch (e) {
    ogoh.push("⚠ 'Ilova' nomli HTML fayl yo'q — telefon ilovasi va '➕ Yozuv qo'shish' ishlamaydi.");
  }

  kerakli.forEach(function (nom) {
    var sh = ss.getSheetByName(nom);
    var oxirgiQ = Math.min(sh.getLastRow(), 200);
    var oxirgiU = sh.getLastColumn();
    if (oxirgiQ < 1 || oxirgiU < 1) return;
    var qiymatlar = sh.getRange(1, 1, oxirgiQ, oxirgiU).getDisplayValues();
    var topildi = [];
    for (var q = 0; q < qiymatlar.length; q++) {
      for (var u = 0; u < qiymatlar[q].length; u++) {
        if (/^#(REF|VALUE|NAME|DIV|N\/A|NUM|ERROR|NULL)/.test(String(qiymatlar[q][u]))) {
          var katak = sh.getRange(q + 1, u + 1);
          topildi.push(katak.getA1Notation() + ' = ' + qiymatlar[q][u] + '   ⇦ ' + (katak.getFormula() || '(formula emas)'));
        }
      }
    }
    if (topildi.length) {
      xato.push('❌ ' + nom + ' — ' + topildi.length + ' ta xato katak:');
      topildi.slice(0, 12).forEach(function (t) { xato.push('     ' + t); });
    }
  });

  var usullar = ustunRoyxati_(ss.getSheetByName(SH.ROYXAT), 2);
  var dsh = ss.getSheetByName(SH.DAROMAD);
  var dOxirgi = oxirgiQator_(dsh, D_US.TUR);
  if (dOxirgi >= 2) {
    var sanasiz = [], oysiz = [], notoriUsul = [], summasiz = [];
    dsh.getRange(2, 1, dOxirgi - 1, 5).getValues().forEach(function (r, i) {
      var q = i + 2;
      if (!r[1]) sanasiz.push(q);
      else if (!OY_REGEX.test(String(r[0]))) oysiz.push(q);
      if (r[3] && usullar.indexOf(String(r[3]).trim()) === -1) notoriUsul.push(q);
      if (!(Number(r[4]) > 0)) summasiz.push(q);
    });
    if (sanasiz.length) xato.push("❌ Daromad — sanasi bo'sh qatorlar: " + qisqaRoyxat_(sanasiz) + ' (hisobotga tushmaydi).');
    if (oysiz.length) xato.push('❌ Daromad — Oy ustuni hisoblanmagan: ' + qisqaRoyxat_(oysiz) + '.');
    if (notoriUsul.length) ogoh.push("⚠ Daromad — to'lov usuli ro'yxatdan emas: " + qisqaRoyxat_(notoriUsul) + '.');
    if (summasiz.length) ogoh.push("⚠ Daromad — summasi bo'sh qatorlar: " + qisqaRoyxat_(summasiz) + '.');
    malumot.push('Daromad qatorlari: ' + (dOxirgi - 1));
  } else {
    malumot.push("Daromad: yozuv yo'q");
  }

  var xsh = ss.getSheetByName(SH.XARAJAT);
  var xOxirgi = oxirgiQator_(xsh, X_US.JOY);
  if (xOxirgi >= 2) {
    var xSanasiz = [], xOysiz = [], xUsul = [], xKategoriyasiz = [];
    xsh.getRange(2, 1, xOxirgi - 1, 7).getValues().forEach(function (r, i) {
      var q = i + 2;
      if (!r[1]) xSanasiz.push(q);
      else if (!OY_REGEX.test(String(r[0]))) xOysiz.push(q);
      if (r[4] && usullar.indexOf(String(r[4]).trim()) === -1) xUsul.push(q);
      if (!String(r[3]).trim()) xKategoriyasiz.push(q);
    });
    if (xSanasiz.length) xato.push("❌ Xarajat — sanasi bo'sh qatorlar: " + qisqaRoyxat_(xSanasiz) + ' (hisobotga tushmaydi).');
    if (xOysiz.length) xato.push('❌ Xarajat — Oy ustuni hisoblanmagan: ' + qisqaRoyxat_(xOysiz) + '.');
    if (xUsul.length) ogoh.push("⚠ Xarajat — to'lov usuli ro'yxatdan emas: " + qisqaRoyxat_(xUsul) + '.');
    if (xKategoriyasiz.length) ogoh.push("⚠ Xarajat — kategoriyasi bo'sh qatorlar: " + qisqaRoyxat_(xKategoriyasiz) + '.');
    malumot.push('Xarajat qatorlari: ' + (xOxirgi - 1));
  } else {
    malumot.push("Xarajat: yozuv yo'q");
  }

  try {
    var soz = sozlamalarniOl_(ss);
    malumot.push("Ajratma qoidasi: " + soz.ozimUsul + ' / ' + soz.ozimQiymat + ' / ' +
      soz.ozimTolovUsuli + ' / oyning ' + soz.ozimKun + '-kuni');
    if (['Foiz', 'Summa'].indexOf(soz.ozimUsul) === -1) {
      xato.push('❌ Sozlamalar!' + SOZ.OZIM_USUL + " — 'Foiz' yoki 'Summa' bo'lishi kerak, hozir: '" + soz.ozimUsul + "'.");
    }
    var doimiy = doimiyXarajatlarniOl_(ss);
    malumot.push('Aktiv doimiy xarajatlar: ' + doimiy.length + ' ta');

    // Sozlamalarga yangi doimiy xarajat qo'shilgan, lekin oyga ko'chirilmagan bo'lishi mumkin
    var tanlanganOy = String(ss.getSheetByName(SH.HISOBOT).getRange('B2').getValue());
    if (OY_REGEX.test(tanlanganOy) && doimiy.length) {
      var holat = oyHolati_(ss.getSheetByName(SH.XARAJAT), tanlanganOy);
      var yoq = doimiy.filter(function (d) { return !holat.nomlar[kalit_(d.nomi)]; });
      if (yoq.length) {
        ogoh.push('⚠ ' + tanlanganOy + " oyiga ko'chirilmagan doimiy xarajatlar: " +
          yoq.map(function (d) { return d.nomi; }).join(', ') +
          " — menyu → '📅 Yangi oy ochish' ni bosing.");
      }
    }
    if (!doimiy.length) ogoh.push("⚠ Sozlamalar — aktiv doimiy xarajat yo'q ('Aktiv' ustunini tekshiring).");
  } catch (e) {
    xato.push("❌ Sozlamalar o'qilmadi: " + e.message);
  }

  fondniTekshir_(ss.getSheetByName(SH.OZIM), O_US.MAQSAD, O_US.SUMMA, "O'zim uchun", xato, ogoh, malumot);

  var triggerNomlari = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['tuzilmaOzgardi', 'kunlikEslatma', 'oylikHisobotYubor'].forEach(function (nom) {
    if (triggerNomlari.indexOf(nom) === -1) {
      ogoh.push("⚠ '" + nom + "' triggeri o'rnatilmagan — tekshiruvni qayta ishga tushiring.");
    }
  });
  malumot.push('Triggerlar: ' + (triggerNomlari.length ? triggerNomlari.join(', ') : "yo'q"));

  var webHolat = webAppHolati_();
  malumot.push('Web app havolasi: ' + (webHolat.url || 'chiqarilmagan') +
    (webHolat.ishlaydi ? ' ✅' : ' ❌'));
  if (!webHolat.ishlaydi) {
    ogoh.push('⚠ Telefon ilovasi havolasi ishlamaydi: ' + webHolat.sabab +
      ". Menyu → ⚙️ Sozlash → 🔗 Havolani saqlash orqali to'g'ri havolani kiriting.");
  }

  var soz = eslatmaSozlamalari_(ss);
  var props = PropertiesService.getScriptProperties();
  malumot.push('Telegram: ' + (props.getProperty('telegramChatId')
    ? (soz.telegram ? 'ulangan ✅' : "ulangan, lekin Sozlamalarda o'chirilgan") : 'sozlanmagan'));
  malumot.push('Email: ' + (soz.email || 'kiritilmagan'));
  malumot.push('Kunlik eslatma: soat ' + soz.soat + ', ' + soz.kun + ' kun oldin');
  var yopilganRoyxat = Object.keys(yopilganOylar_()).sort();
  malumot.push('Yopilgan oylar: ' + (yopilganRoyxat.length ? yopilganRoyxat.join(', ') : "yo'q"));
  if (soz.telegram && !props.getProperty('telegramChatId')) {
    ogoh.push("⚠ Telegram yoqilgan, lekin ulanmagan — menyu → ⚙️ Sozlash → 🤖 Telegram sozlash.");
  }

  var barchasi = hammaXulosalar_();
  var qarzHolati = qarzlarniHisobla_(ss, barchasi.bogJami, false);
  qarzHolati.royxat.forEach(function (d) {
    var bog = barchasi.bogJami[kalit_(d.nomi)] || { xarajat: 0, daromad: 0, kutilmoqda: 0 };
    var harakat = d.turi === QARZ_TURLARI[1] ? bog.daromad : bog.xarajat;
    if (harakat > 0 || d.qolgan === 0) return;

    // Bog'langan, ammo Fakt ustuni to'ldirilmagan
    if (bog.kutilmoqda > 0) {
      ogoh.push("⚠ '" + d.nomi + "' ga bog'langan to'lov bor (" + son_(bog.kutilmoqda) +
        "), lekin hali to'lanmagan — Xarajatdagi 'Fakt' ustunini to'ldiring " +
        "(yoki telefonda ⏳ To'lov → \"To'landi\"). Shundan keyin qarz qoldig'i kamayadi.");
      return;
    }
    var maslahat = '';
    if (d.turi !== QARZ_TURLARI[1]) {
      // Nomi o'xshash xarajatlarni topib, qaysi qatorni bog'lash kerakligini aytamiz
      var kalitNom = kalit_(d.nomi);
      var nomzodlar = Object.keys(barchasi.joyJami).filter(function (joy) {
        return joy !== kalitNom && (joy.indexOf(kalitNom) > -1 || kalitNom.indexOf(joy) > -1);
      });
      if (nomzodlar.length) {
        maslahat = " Ehtimol shular: " + nomzodlar.join(', ') +
          " — o'sha qatorlarda 'Qarz / haq' ustunidan '" + d.nomi + "' ni tanlang.";
      }
    }
    ogoh.push("⚠ '" + d.nomi + "' uchun bog'langan " +
      (d.turi === QARZ_TURLARI[1] ? 'daromad' : 'xarajat') + " yo'q — " +
      (d.turi === QARZ_TURLARI[1]
        ? "pul qaytarilganda Daromad sheetidagi 'Haq / qarz' ustunidan shu nomni tanlang."
        : "to'lov qilganda Xarajat sheetidagi 'Qarz / haq' ustunidan shu nomni tanlang.") + maslahat);
  });
  if (qarzHolati.royxat.length) {
    malumot.push('Qarzlar: ' + qarzHolati.royxat.map(function (d) {
      return d.nomi + ' (' + (d.turi === QARZ_TURLARI[1] ? 'haqim' : 'qarzim') +
        ", to'landi " + son_(d.tolangan) + ', qolgan ' + son_(d.qolgan) + ')';
    }).join(' | '));
  }

  var qoidalar = daromadQoidalari_(ss);
  var qoidaMatni = Object.keys(qoidalar).map(function (k) {
    return k + (qoidalar[k] ? ' → oldingi oy' : ' → joriy oy');
  });
  malumot.push('Daromad tegishlilik qoidalari: ' + (qoidaMatni.length ? qoidaMatni.join(', ') : 'belgilanmagan'));

  var oylar = ustunRoyxati_(ss.getSheetByName(SH.ROYXAT), 5);
  malumot.push('Topilgan oylar: ' + (oylar.length ? oylar.join(', ') : "yo'q"));
  var tanlangan = String(ss.getSheetByName(SH.HISOBOT).getRange('B2').getValue());
  malumot.push('Hisobotda tanlangan oy: ' + tanlangan);
  if (!OY_REGEX.test(tanlangan)) {
    xato.push("❌ Hisobot!B2 — oy YYYY-MM ko'rinishida emas: '" + tanlangan + "'.");
  } else if (oylar.length && oylar.indexOf(tanlangan) === -1) {
    ogoh.push('⚠ Hisobot!B2 — ' + tanlangan + " oyida yozuv yo'q (shuning uchun raqamlar 0).");
  }

  if (!dsh.getRange(2, D_US.TUR).getDataValidation()) {
    ogoh.push("⚠ Daromad — dropdown ro'yxatlari yo'q.");
  }

  return { xato: xato, ogoh: ogoh, malumot: malumot };
}

function fondniTekshir_(sh, toliqUstun, summaUstun, nom, xato, ogoh, malumot) {
  var oxirgi = oxirgiQator_(sh, toliqUstun);
  if (oxirgi < FOND_BOSH) {
    malumot.push(nom + ": yozuv yo'q");
    return;
  }
  var soni = oxirgi - FOND_BOSH + 1;
  var qatorlar = sh.getRange(FOND_BOSH, 1, soni, 6).getValues();
  var sanasiz = [], summasiz = [];
  qatorlar.forEach(function (r, i) {
    if (!r[1]) sanasiz.push(i + FOND_BOSH);
    if (!(Number(r[summaUstun - 1]) > 0)) summasiz.push(i + FOND_BOSH);
  });
  if (sanasiz.length) xato.push('❌ ' + nom + " — sanasi bo'sh qatorlar: " + qisqaRoyxat_(sanasiz) + '.');
  if (summasiz.length) ogoh.push('⚠ ' + nom + " — summasi bo'sh qatorlar: " + qisqaRoyxat_(summasiz) + '.');
  malumot.push(nom + ' yozuvlari: ' + soni);
}

function ustunHarfi_(raqam) {
  var harf = '';
  while (raqam > 0) {
    var qoldiq = (raqam - 1) % 26;
    harf = String.fromCharCode(65 + qoldiq) + harf;
    raqam = Math.floor((raqam - 1) / 26);
  }
  return harf;
}

function qisqaRoyxat_(royxat) {
  return royxat.slice(0, 12).join(', ') + (royxat.length > 12 ? ' … (' + royxat.length + ' ta)' : '');
}

function hisobotniKorsat_(qatorlar) {
  var matn = qatorlar.join('\n');
  Logger.log(matn);

  var himoyalangan = matn.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.5 -apple-system,system-ui,sans-serif;padding:10px">' +
    "<p style=\"margin:0 0 8px\">Quyidagi matnni to'liq nusxalang (Ctrl+A → Ctrl+C):</p>" +
    '<textarea readonly style="width:100%;height:330px;font:12px/1.45 monospace;box-sizing:border-box">' +
    himoyalangan + '</textarea></div>'
  ).setWidth(640).setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(html, '🩺 Tekshiruv natijasi');
  return matn;
}

/** ===================== Yordamchi funksiyalar ===================== */

/**
 * Yozuv operatsiyalarini qulflaydi: telefon va jadval bir vaqtda yozganda
 * ikkala yozuv ham bir xil qatorga tushib qolmasligi uchun.
 */
function qulfBilan_(ish) {
  var qulf = LockService.getScriptLock();
  if (!qulf.tryLock(20000)) {
    throw new Error("Hozir boshqa yozuv saqlanmoqda. Bir necha soniyadan so'ng qayta urinib ko'ring.");
  }
  try {
    return ish();
  } finally {
    qulf.releaseLock();
  }
}

function sheetOl_(ss, nom) {
  return ss.getSheetByName(nom) || ss.insertSheet(nom);
}

function talabSheet_(ss, nom) {
  var sh = ss.getSheetByName(nom);
  if (!sh) throw new Error("'" + nom + "' sheeti topilmadi. Menyudan '🚀 Dastlabki sozlash' ni ishga tushiring.");
  return sh;
}

/** Aniq ustun bo'yicha oxirgi to'ldirilgan qator (getLastRow() boshqa ustunlar tufayli oshib ketishi mumkin). */
function oxirgiQator_(sh, ustun) {
  var oxirgi = sh.getLastRow();
  if (oxirgi < 2) return 1;
  var qiymatlar = sh.getRange(1, ustun, oxirgi, 1).getValues();
  for (var i = qiymatlar.length - 1; i >= 0; i--) {
    if (qiymatlar[i][0] !== '' && qiymatlar[i][0] !== null) return i + 1;
  }
  return 1;
}

function ustunRoyxati_(sh, ustun) {
  var oxirgi = oxirgiQator_(sh, ustun);
  if (oxirgi < 2) return [];
  return sh.getRange(2, ustun, oxirgi - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v !== ''; });
}

function oyMatni_(sana) {
  return Utilities.formatDate(sana, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM');
}

function sanaYasa_(oy, kun) {
  var qism = oy.split('-');
  var yil = Number(qism[0]);
  var oyRaqam = Number(qism[1]);
  var oxirgiKun = new Date(yil, oyRaqam, 0).getDate();
  var tanlangan = Math.min(Math.max(Number(kun) || 1, 1), oxirgiKun);
  return new Date(yil, oyRaqam - 1, tanlangan);
}

function sanaOqi_(matn) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(matn || '').trim());
  if (!m) throw new Error("Sana noto'g'ri: " + matn);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function musbatSon_(qiymat, nom) {
  var son = Number(String(qiymat).replace(/[\s,]/g, ''));
  if (!isFinite(son) || son <= 0) throw new Error(nom + ' musbat son bo\'lishi kerak.');
  return son;
}

function matnTalab_(qiymat, nom) {
  var matn = String(qiymat || '').trim();
  if (matn === '') throw new Error(nom + ' to\'ldirilishi shart.');
  return matn;
}

function sanami_(qiymat) {
  return !!qiymat && typeof qiymat.getMonth === 'function';
}

function sanaMatni_(qiymat) {
  if (sanami_(qiymat)) {
    return Utilities.formatDate(qiymat, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'dd.MM');
  }
  return String(qiymat || '');
}

function bosh_(qiymat) {
  return qiymat === '' || qiymat === null || qiymat === undefined;
}

function kalit_(qiymat) {
  return String(qiymat).trim().toLowerCase();
}

function bolim_(sh, a1, matn) {
  var range = sh.getRange(a1);
  if (range.isPartOfMerge()) range.breakApart();
  range.merge().setValue(matn)
    .setFontWeight('bold').setFontSize(11)
    .setBackground(RANG.BOLIM_FON).setFontColor(RANG.BOLIM_MATN);
}

/** Sarlavhani yagona manbadan yozadi. */
function sarlavhaYoz_(sh, tavsif) {
  jadvalSarlavhasi_(sh, tavsif.diapazon, tavsif.ustunlar);
}

function jadvalSarlavhasi_(sh, a1, qiymatlar) {
  sh.getRange(a1).setValues([qiymatlar])
    .setFontWeight('bold').setBackground(RANG.SARLAVHA_FON).setFontColor('#FFFFFF')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function bandlash_(sh, range, mavzu) {
  if (sh.getBandings().length > 0) return;
  range.applyRowBanding(mavzu, true, false);
}

/** Qoldiq manfiy bo'lsa qizil, musbat bo'lsa yashil. */
function qoldiqRangi_(sh) {
  var range = sh.getRange('B18:B19');
  var qoidalar = sh.getConditionalFormatRules().filter(function (q) {
    return q.getRanges().every(function (r) { return r.getA1Notation() !== 'B18:B19'; });
  });
  qoidalar.push(
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0)
      .setBackground('#FFCDD2').setFontColor('#B71C1C').setRanges([range]).build()
  );
  qoidalar.push(
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0)
      .setBackground('#C8E6C9').setFontColor('#1B5E20').setRanges([range]).build()
  );
  sh.setConditionalFormatRules(qoidalar);
}

function tartibla_(ss) {
  var tartib = [SH.HISOBOT, SH.DAROMAD, SH.XARAJAT, SH.OZIM, SH.JAMGARMA, SH.QARZ, SH.MAQSAD, SH.SOZLAMALAR, SH.YILLIK, SH.ROYXAT];
  tartib.forEach(function (nom, i) {
    var sh = ss.getSheetByName(nom);
    if (!sh) return;
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });

  // Bo'sh standart sheetni olib tashlaymiz
  ss.getSheets().forEach(function (sh) {
    if (tartib.indexOf(sh.getName()) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
  ss.setActiveSheet(ss.getSheetByName(SH.HISOBOT));
}
