# My Wallet — biznes qoidalar spetsifikatsiyasi

> **Manba:** `oylik-byudjet-admin` va `oylik-byudjet-app` loyihalaridagi biznes
> mantiq (Google Sheets `Code.gs` v28, Dart `packages/domain`, admin panel,
> cron ishlari) to'liq o'rganildi. Bu hujjat **faqat mantiqni** oladi — eski
> texnik qarorlar (Firestore, delta-agregat, Vercel cron) olinmagan.
>
> **Belgilar:**
> `[ASL]` — eski tizimda bor edi, xulqi aynan saqlanadi.
> `[ASL*]` — eski tizimda bor edi, kamchiligi tuzatilgan holda saqlanadi.
> `[YANGI]` — o'xshash ilovalarda bor, eski tizimda yo'q edi — qo'shiladi.
>
> Har bir qoidaning ID si bor (`BR-xxx`). Kod, test va reja vazifalari shu
> ID larga havola qiladi. Qoida o'zgarsa — avval shu hujjat, keyin kod.
>
> Bu hujjat `contracts/` orqali mobil repoga ham ko'chiriladi (yagona manba —
> shu repo).

---

## 1. Lug'at

| Atama | Ma'nosi | Kod nomi |
|---|---|---|
| **Byudjet** | Ma'lumotlar egasi (ijarachi/tenant). Shaxsiy yoki oilaviy. Bir foydalanuvchi bir nechta byudjetda a'zo bo'lishi mumkin | `household` |
| **A'zo** | Byudjetga kirish huquqi bor foydalanuvchi (rol bilan) | `household_member` |
| **Hisob (hamyon)** | Pul turadigan joy: naqd, karta, bank, e-hamyon, omonat, shaxsiy fond | `account` |
| **Kategoriya** | Daromad yoki xarajat turi. Daromad kategoriyasi = eski "daromad turi" (Avans, Oylik, KPI, Qo'shimcha) | `category` |
| **Amal (yozuv)** | Haqiqiy pul harakati: daromad, xarajat, o'tkazma. Eski tizimdagi "fakt" | `transaction` |
| **Tegishli oy** | Amal qaysi oy byudjetiga tegishli (pul kelgan/ketgan oydan farq qilishi mumkin) | `budget_month` |
| **Reja** | Kutilayotgan to'lov yoki daromad (eski "Reja" ustuni). Oy ochilganda doimiy rejalardan yaratiladi | `planned_item` |
| **Doimiy reja (shablon)** | Har oy takrorlanadigan to'lov/daromad shabloni (eski "Doimiy xarajatlar") | `recurring_rule` |
| **Oyni ochish** | Doimiy rejalarni oyga reja sifatida ko'chirish | `open_month` |
| **Oyni yopish** | Tugagan oyni "yopilgan" deb belgilash | `month.closed_at` |
| **Qoldiq** | Oy daromadi − oy xarajati (fakt) | `balance` |
| **Prognoz qoldiq** | Qoldiq − to'lanmagan rejalar | `forecast_balance` |
| **Orttirgan** | Oyda haqiqatda orttirilgan pul (10-bo'lim) | `saved` |
| **👤 Shaxsiy fond** | "O'zim uchun" ajratilgan pul hisobi | `personal_fund` |
| **🏦 Jamg'arma** | Oylik qoldiqlarning xronologik yig'indisi (avtomatik) | `savings` |
| **Limit** | Kategoriya bo'yicha oylik chegara | `category_limit` |
| **Tez tugma** | Bir bosishda xarajat yozadigan tugma | `quick_action` |
| **Qarz / haq** | "Men qarzdorman" yoki "Menga qarzdor" registri | `debt` |
| **Maqsad** | To'planish maqsadi | `goal` |
| **Asosiy valyuta** | Byudjet hisobotlari yuritiladigan valyuta (standart UZS) | `base_currency` |

---

## 2. Umumiy tamoyillar

- **BR-001 [ASL]** Pul hech qachon kasr (`float`) bilan hisoblanmaydi. Barcha
  summalar **butun son, eng kichik birlikda** (tiyin/sent) saqlanadi va
  hisoblanadi. Kasr faqat ko'rsatishda paydo bo'ladi. UZS ekranda so'mgacha
  yaxlitlab, `1 234 567 so'm` ko'rinishida chiqadi.
- **BR-002 [ASL]** Sanalar **kun aniqligida** va **byudjet vaqt zonasida**
  (standart `Asia/Tashkent`) solishtiriladi. Soat-minut hech qachon "bugungi
  to'lov kechikdi" degan natija bermaydi.
- **BR-003 [ASL]** Nomlarni solishtirish normallashtirilgan holda:
  `trim + lowercase` ("Oziq-ovqat " = "oziq-ovqat"). Kategoriya, hisob,
  doimiy reja nomlari byudjet ichida shu kalit bo'yicha **yagona**.
- **BR-004 [ASL]** Hosila qiymatlar (qoldiq, prognoz, orttirgan, jamg'arma,
  qarz qoldig'i, maqsad progressi) **saqlanmaydi** — har doim xom yozuvlardan
  hisoblanadi. Ikki manba = nomuvofiqlik.
- **BR-005 [ASL]** 👤 Shaxsiy fond va 🏦 jamg'arma **hech qaysi ekranda yoki
  hisobotda qo'shilmaydi** va bitta "jami" sifatida ko'rsatilmaydi.
- **BR-006 [ASL*]** Bir vaqtning o'zida ikki qurilmadan tahrirlansa, yozuv
  jimgina ustma-ust yozilmaydi: versiya tekshiriladi, to'qnashuvda
  foydalanuvchiga "Bu yozuv boshqa qurilmada o'zgartirilgan" deb ko'rsatiladi
  (eski tizimdagi "qator jadvalda o'zgargan" tekshiruvining davomi).
- **BR-007 [ASL]** Offline: internet bo'lmasa ham amal yoziladi, qoldiq
  **darhol** yangilanadi, ulanish tiklanganda sinxronlanadi. Oflayn holat
  ekranda ko'rinib turadi.
- **BR-008 [YANGI]** Har bir o'chirish/tahrir **audit jurnaliga** tushadi:
  kim, qachon, nima, eski → yangi qiymat. Saqlash muddati 180 kun.
- **BR-009 [YANGI]** O'chirilgan amalni 5 soniya ichida "Bekor qilish"
  (undo) bilan qaytarish mumkin (mobil).

---

## 3. Byudjet, a'zolar va rollar `[YANGI]`

- **BR-010** Ro'yxatdan o'tgan foydalanuvchiga avtomatik **shaxsiy byudjet**
  yaratiladi va u shu byudjetning `owner` i bo'ladi.
- **BR-011** Rollar:

  | Rol | O'qish | Amal yozish | Spravochniklar | A'zolar / sozlamalar |
  |---|---|---|---|---|
  | `owner` | ✅ | ✅ | ✅ | ✅ (egalikni o'tkazish ham) |
  | `admin` | ✅ | ✅ | ✅ | ✅ (owner'ni o'chira olmaydi) |
  | `member` | ✅ | ✅ | ❌ | ❌ |
  | `viewer` | ✅ | ❌ | ❌ | ❌ |

- **BR-012** Taklif: havola yoki 8 belgili kod, **7 kun** amal qiladi, bir
  martalik, rol bilan. Qabul qilinganda a'zo qo'shiladi.
- **BR-013** Har bir amal **kim yozgani** (`created_by`) bilan saqlanadi —
  oilaviy byudjetda "kim qancha sarfladi" tahlili uchun.
- **BR-014** Byudjetning oxirgi `owner` i chiqib keta olmaydi — avval egalikni
  o'tkazadi yoki byudjetni o'chiradi.
- **BR-015** Foydalanuvchi o'z akkauntini va unga tegishli barcha ma'lumotni
  o'chira oladi (Google Play talabi). Boshqa a'zolari bor byudjetda uning
  amallari `created_by = null` bo'lib qoladi.

---

## 4. Hisoblar (hamyonlar) `[YANGI]`

Eski tizimda faqat `karta / naqd` **usuli** bor edi. Endi ular haqiqiy hisoblar.

- **BR-020** Hisob turlari: `cash` (naqd), `card` (karta), `bank` (bank
  hisobi), `ewallet` (Click/Payme va h.k.), `deposit` (omonat), `personal_fund`
  (👤 shaxsiy fond — byudjetda bitta, tizim hisobi: turi o'zgarmaydi,
  o'chirilmaydi, arxivlanmaydi; nomi o'zgarishi mumkin), `other`.
- **BR-021** Hisob qoldig'i =
  `boshlang'ich qoldiq + Σ daromad − Σ xarajat + Σ kiruvchi o'tkazma − Σ chiquvchi o'tkazma`
  (hisob valyutasida).
- **BR-022 [ASL*]** Eski "💳 Karta / 💵 Naqd qoldiq" kesimi saqlanadi:
  `cash` → **Naqd**, qolgan turlar → **Karta** (naqdsiz). `personal_fund`
  hisobidagi harakatlar bu kesimga kirmaydi.
- **BR-023** O'tkazma (A → B) byudjet daromadi ham, xarajati ham **emas**
  (masalan kartadan naqd yechish). **Yagona istisno** — `personal_fund`
  hisobiga o'tkazma (BR-061).
- **BR-024** Tranzaksiyasi bor hisob o'chirilmaydi — **arxivlanadi**
  (tanlash ro'yxatlarida ko'rinmaydi, hisobotlarda qoladi). Reja, doimiy
  reja, tez tugma yoki 👤 fond manbai sifatida ishlatilayotgan hisob ham
  o'chirilmaydi; fond manbai arxivlanmaydi ham — avval fond sozlamasida
  boshqa hisob tanlanadi.
- **BR-025** Naqd hisob qoldig'i manfiy bo'lsa — ogohlantirish (tekshiruvda
  va hisob kartasida).
- **BR-026** Hisob valyutasi birinchi amaldan keyin o'zgartirilmaydi.

---

## 5. Kategoriyalar

- **BR-030 [ASL]** Kategoriya turi: `income` yoki `expense`.
- **BR-031 [ASL]** **Daromad kategoriyasi = daromad turi** va unda **oy
  siljishi qoidasi** turadi (BR-040). Standart to'plam:
  `Avans (0)`, `Oylik (−1)`, `KPI (−1)`, `Qo'shimcha (−1)`.
- **BR-032 [ASL]** Standart xarajat kategoriyalari: Ijara, Kommunal,
  Internet/Aloqa, Oziq-ovqat, Transport, Kredit/Qarz, Sog'liq, Ta'lim, Kiyim,
  Ko'ngilochar, Sovg'a, Uy-ro'zg'or, **O'zim uchun**, Boshqa.
- **BR-033 [ASL]** **"O'zim uchun"** — tizim kategoriyasi
  (`system_code = personal_allocation`). O'chirilmaydi va arxivlanmaydi,
  nomi (ikon, rang) o'zgartirilishi mumkin. Shaxsiy fond ajratmalari shu
  kategoriyada ko'rinadi.
- **BR-034 [YANGI]** Bir darajali **subkategoriya** (masalan Transport →
  Taksi, Yoqilg'i). Hisobotlar ota-kategoriyaga yig'ib ko'rsata oladi.
- **BR-035 [ASL*]** Eski tizimda kategoriya erkin matn edi (xato yozilsa
  alohida kategoriya bo'lib qolardi). Endi faqat spravochnikdan tanlanadi;
  amal qo'shayotganda **joyida yangi kategoriya** yaratish mumkin.
- **BR-036 [YANGI]** Ishlatilgan kategoriya (amal, reja, doimiy reja, limit,
  tez tugma yoki subkategoriyasi bor) o'chirilmaydi — arxivlanadi yoki
  boshqasi bilan **birlashtiriladi** (barcha amallar ko'chiriladi, bitta
  tranzaksiyada). Kategoriya turi (daromad/xarajat) yaratilgandan keyin
  o'zgarmaydi. Birlashtirishda turlar bir xil, daromad turlarida oy siljishi
  ham bir xil bo'lishi kerak (aks holda amallar jimgina boshqa oyga
  ko'chardi — avval BR-043 bilan tekislanadi).
- **BR-037 [YANGI]** Ikon va rang (UI uchun), tartib (drag & drop).

---

## 6. Tegishli oy (eng muhim qoida)

Pul **qachon kelgani** bilan **qaysi oyning puli** ekani har doim bir xil emas:
1–3-sentabrda kelgan oylik — **avgust** oyining oyligi.

- **BR-040 [ASL]** Daromadning tegishli oyi:
  `tegishli_oy = oy(olingan_sana) + kategoriya.oy_siljishi`
  (`0` — joriy oy, `−1` — oldingi oy). Qoida topilmasa `0`.

  | Olingan sana | Tur | Tegishli oy |
  |---|---|---|
  | 02.10 | Oylik (−1) | **2026-09** |
  | 06.10 | KPI (−1) | **2026-09** |
  | 16.10 | Avans (0) | **2026-10** |
  | 18.10 | Qo'shimcha (−1) | **2026-09** |

- **BR-041 [ASL]** Xarajatning tegishli oyi: qo'lda tanlangan oy bo'lsa —
  o'sha, aks holda to'lov sanasining oyi. (5-oktabrdagi kredit to'lovi
  qo'lda **sentabr**ga biriktirilishi mumkin.)
- **BR-042 [ASL*]** Daromadga ham qo'lda oy tanlash mumkin (eski tizimda faqat
  qoida bor edi — kutilmagan to'lovlar uchun noqulay edi). Manba saqlanadi:
  `auto` yoki `manual`.
- **BR-043 [ASL]** Kategoriyaning oy siljishi o'zgarsa, eski yozuvlar **avval
  preview** ko'rsatiladi ("N ta yozuv ko'chadi: 2026-09 → 2026-10"), tasdiqdan
  keyin bitta tranzaksiyada qayta joylanadi. `manual` yozuvlarga tegilmaydi.
- **BR-044 [ASL]** Oy ochilganda yaratilgan rejalar (va ularning to'lovlari)
  **ochilgan oyga** tegishli bo'ladi — to'lov kuni keyingi oyga tushsa ham.
- **BR-045 [ASL]** Kiritish formasida tegishli oy **jonli ko'rsatiladi**:
  "→ Avgust 2026 oyining daromadi sifatida yoziladi (oldingi oy)",
  xarajatda: "Qaysi oyning byudjetiga? [Sana bo'yicha] [Oldingi oy] [Tanlash]".
- **BR-046 [ASL]** O'tkazmaning tegishli oyi — sana oyi (faqat BR-061 holatida
  ahamiyatga ega; ajratma rejasi orqali to'lansa — reja oyi).

---

## 7. Amallar (daromad, xarajat, o'tkazma)

- **BR-050 [ASL]** Daromad: summa > 0, kategoriya (tur), hisob, olingan sana,
  izoh, ixtiyoriy qarz bog'lanishi (BR-111).
- **BR-051 [ASL]** Xarajat: summa > 0, kategoriya, hisob, sana, **joy / nomi**
  (payee), izoh, ixtiyoriy: reja bog'lanishi, qarz bog'lanishi.
- **BR-052 [ASL*]** Eski tizimda reja va fakt bitta qatorda edi, to'langan
  sana saqlanmas edi. Endi **reja** (`planned_item`) va **fakt**
  (`transaction`) alohida; fakt o'z sanasiga ega, bitta rejaga bir nechta
  to'lov (qisman to'lov) bog'lanishi mumkin.
- **BR-053 [YANGI]** O'tkazma: manba hisob, manzil hisob, summa (turli
  valyutada — ikkala summa), sana, izoh. Manba = manzil bo'lishi mumkin emas.
- **BR-054 [YANGI]** Amalga teglar va chek rasmi biriktiriladi (21-bo'lim).
- **BR-055 [ASL]** Yopilgan oy amalini tahrirlashda **ogohlantirish** chiqadi
  (bloklanmaydi). `[YANGI]` Sozlamada "qattiq qulf" yoqilsa — faqat
  owner/admin oyni qayta ochib tahrirlay oladi.
- **BR-056 [YANGI]** Joy/nomi maydoni tarixdan **avtomatik to'ldiriladi** va
  shu nom uchun oxirgi kategoriya/hisob taklif qilinadi.

---

## 8. Rejalar (to'lovlar va kutilayotgan daromadlar)

### 8.1. Reja va holat

- **BR-070 [ASL]** Reja: nomi, kategoriya, hisob (taxminiy), rejadagi summa
  (**bo'sh bo'lishi mumkin** = "summasi har oy o'zgaradi"), to'lov kuni,
  tegishli oy, avto to'lov belgisi, ixtiyoriy qarz bog'lanishi, izoh.
  Reja summasi byudjetning asosiy valyutasida; 👤 fond hisobi rejada
  qatnashmaydi. To'lovi bor reja o'chirilmaydi — o'tkazib yuboriladi.
- **BR-071 [ASL]** Holat (ko'rsatishda **bugungi sanadan** hisoblanadi, BR-002):

  | Holat | Qachon |
  |---|---|
  | ✅ `paid` | to'langan summa ≥ reja (yoki summasi bo'sh rejaga to'lov bor) yoki "yopildi" deb belgilangan |
  | 🟡 `partial` `[YANGI]` | 0 < to'langan < reja |
  | ⏳ `pending` | to'lov yo'q, to'lov kuni ≥ bugun |
  | ⚠️ `overdue` | to'lov yo'q (yoki qisman), to'lov kuni < bugun |
  | ⏭ `skipped` `[YANGI]` | foydalanuvchi shu oy uchun o'tkazib yubordi |

- **BR-072 [ASL]** Sana kelgani bilan reja o'z-o'zidan "to'landi" bo'lmaydi
  (reja — to'lov emas; kechikishi yoki bekor bo'lishi mumkin). Istisno — avto
  to'lov (BR-075).
- **BR-073 [ASL]** "To'landi": summa standart = **qolgan reja**; reja bo'sh
  bo'lsa summa **majburiy** ("Bu to'lovning summasi belgilanmagan — qancha
  to'laganingizni kiriting"); allaqachon to'langan bo'lsa — xato.
  `[YANGI]` Summa qolgandan kam bo'lsa: "Qisman to'lov — qolganini keyin
  to'laysizmi?" → `partial`; yoki "Yopish" → `paid`.
- **BR-074 [ASL]** Ommaviy "To'landi" (admin): tanlangan rejalar **bitta
  tranzaksiyada**; faqat summasi aniq (> 0) rejalar. To'lanmaganlari sababi
  bilan qaytadi (summa noma'lum, hisob yo'q, boshqa valyutadagi hisob va h.k.).
- **BR-075 [ASL]** **Avto to'lov:** `avto && reja > 0 && to'lanmagan &&
  to'lov_kuni ≤ bugun` → server ilovani ochmasangiz ham har kuni (00:10)
  qolgan summaga teng to'lov yozadi (`source = auto_pay`). Internet, telefon,
  obuna kabi bankdan o'zi yechiladiganlar uchun.
- **BR-076 [ASL]** To'lanmagan jami = Σ(to'lanmagan rejalar qoldig'i); summasi
  noma'lumlar soni alohida: ekranda `1 200 000 so'm + 2 ta ?`.
- **BR-077 [YANGI]** Kutilayotgan daromad ham reja bo'la oladi (Oylik 1–3,
  KPI 5–8, Avans 15–17). Kelganda "Keldi" bosiladi → daromad amali
  bog'lanadi. Prognoz shundan foydalanadi (BR-093).

### 8.2. Doimiy rejalar va oyni ochish

- **BR-080 [ASL]** Doimiy reja: nomi, turi (xarajat / daromad / shaxsiy fond
  ajratmasi), kategoriya, hisob, summa (bo'sh = o'zgaruvchi), oyning kuni
  (1–31, qisqa oyda oxirgi kunga qisiladi), avto to'lov, aktiv, qarz
  bog'lanishi, tartib. `[YANGI]` amal qilish davri (boshlanish/tugash oyi).
- **BR-081 [ASL]** **Oyni ochish** — aktiv doimiy rejalardan shu oy uchun
  rejalar yaratadi + 👤 shaxsiy fond ajratmasi rejasini (BR-060).
  **Idempotent:** shu oyda shu shablondan reja bor bo'lsa — o'tkazib
  yuboriladi. Natija: "N ta qo'shildi, M ta allaqachon bor edi".
- **BR-082 [ASL]** Oyni qayta ochish oy ichida qo'lda tuzatilgan summalarni
  **qayta yozmaydi**.
- **BR-083 [ASL]** Shablon summasi o'zgarsa — faqat **keyingi** ochiladigan
  oylarga ta'sir qiladi. Shu oy uchun boshqacha summa — oy rejasining o'zida
  tahrirlanadi.
- **BR-084 [ASL*]** Oyni istalgan vaqtda qo'lda ochish mumkin (mobil va
  admin). `[YANGI]` Avto-ochish: har oyning 1-kuni 00:30 da server o'zi ochadi
  (sozlamada o'chirsa bo'ladi). Ochishdan oldin **preview**: nimalar
  yaratiladi.
- **BR-085 [ASL]** Tekshiruv joriy oyga ko'chirilmagan aktiv shablonlarni
  ko'rsatadi ("oyni ochish kerak").

---

## 9. 👤 Shaxsiy fond ("O'zim uchun")

- **BR-060 [ASL]** Ajratma qoidasi (byudjet sozlamasi): rejim `percent` yoki
  `fixed`, qiymat (foiz yoki summa), qaysi hisobdan, oyning qaysi kuni.
  Standart: 10%, naqd, 5-kun.
  - `percent`: `reja = round(oy_daromadi × foiz / 100 / 1000) × 1000` —
    **bir marta** yaxlitlanadi (1000 so'mgacha).
  - `fixed`: `reja = qiymat`.
  - `percent` rejimida oy daromadi o'zgarsa, shu oy ajratma rejasi **o'zi
    qayta hisoblanadi** (daromad kelgani sari oshib boradi). Allaqachon qisman
    to'langan bo'lsa, farq `partial` bo'lib ko'rinadi (BR-071).
- **BR-061 [ASL*]** Ajratma = tanlangan hisobdan **👤 shaxsiy fond hisobiga
  o'tkazma**. Byudjet uchun u **"O'zim uchun" kategoriyasidagi xarajat**
  hisoblanadi (oy qoldig'ini kamaytiradi) — eski tizim bilan aynan bir xil
  arifmetika, lekin endi pul qayerda ekani ham ko'rinadi. Ajratma rejasi
  faqat byudjet hisobidan fondga o'tkazma bilan to'lanadi. `[YANGI]` Fonddan
  byudjet hisobiga o'tkazma — ajratmaning qaytishi (manfiy ajratma): oy
  xarajatini kamaytiradi, shuning uchun BR-092 invarianti saqlanadi.
- **BR-062 [ASL]** Shaxsiy fonddan sarf = `personal_fund` hisobidan xarajat.
  U **oylik byudjet qoldig'iga ta'sir qilmaydi** — faqat fond qoldig'ini
  kamaytiradi. Kategoriya ko'rsatilmasa — "O'zim uchun". Fonddan sarf
  byudjet rejasiga bog'lanmaydi (reja — byudjet bandi).
- **BR-063 [ASL]** Fond qoldig'i = Σ ajratilgan − Σ sarflangan
  (= `personal_fund` hisobining qoldig'i). Shu tenglik saqlanishi uchun fond
  hisobiga daromad yozilmaydi — pul fondga faqat ajratma o'tkazmasi bilan
  tushadi.
- **BR-064 [ASL]** Fond ekrani: qoldiq, shu oy ajratilgan/sarflangan, jami
  ajratilgan/sarflangan, sarf qo'shish formasi, sarflar tarixi.
- **BR-065 [ASL]** Fonddan sarfning tegishli oyi — sarf sanasi oyi.

---

## 10. Oylik yakun va hosila ko'rsatkichlar

Quyidagi formulalar oy `M` uchun. "Byudjet amallari" — `personal_fund`
hisobidan tashqari hisoblardagi daromad/xarajatlar + fondga ajratmalar.

- **BR-090 [ASL]** Asosiy yig'indilar:

  | Ko'rsatkich | Formula |
  |---|---|
  | Daromad | Σ byudjet daromadlari (tegishli oyi `M`) |
  | Daromad matritsasi | tur (kategoriya) × Karta/Naqd (BR-022) |
  | Xarajat (fakt) | Σ byudjet xarajatlari + Σ fondga ajratmalar |
  | Xarajat kesimi | kategoriya bo'yicha: reja va fakt; Karta/Naqd bo'yicha |
  | Reja jami | Σ xarajat rejalari summasi (bo'sh = 0) |
  | To'lanmagan jami | BR-076 |
  | Summasi noma'lum | to'lanmagan, summasi bo'sh rejalar soni |
  | O'zim uchun ajratilgan | Σ fondga ajratmalar (`M`) |
  | Fonddan sarflangan | Σ fond xarajatlari (`M`) |

- **BR-091 [ASL]** Hosila ko'rsatkichlar:

  | Ko'rsatkich | Formula |
  |---|---|
  | 💰 **Qoldiq** | Daromad − Xarajat |
  | 🔮 **Prognoz qoldiq** | Qoldiq − To'lanmagan jami |
  | 💳 **Karta qoldiq** | Daromad(karta) − Xarajat(karta) |
  | 💵 **Naqd qoldiq** | Daromad(naqd) − Xarajat(naqd) |
  | 📈 **Orttirgan** | Qoldiq + Ajratilgan − Fonddan sarflangan |
  | Orttirish foizi | Orttirgan ÷ Daromad (daromad 0 bo'lsa 0) |
  | Sarflandi (%) | Xarajat ÷ Daromad |
  | Reja bajarilishi | Xarajat ÷ Reja jami |

  **Nega ajratma qo'shiladi?** "O'zim uchun" ajratilgan pul sarflanmagan —
  boshqa cho'ntakka o'tgan, u ham orttirilgan pul. Fonddan nimadir olinsa —
  o'sha haqiqiy sarf.

  **Misol (hujjatlashtirilgan test holati):** daromad 5 750 000; xarajat
  3 000 000 (shundan 1 000 000 — ajratma); fonddan sarf 450 000 →
  qoldiq **2 750 000**, orttirgan **3 300 000** (57%).
  Tekshiruv: haqiqiy sarf 2 000 000 + 450 000 = 2 450 000;
  5 750 000 − 2 450 000 = 3 300 000 ✅.

- **BR-092 [ASL]** Barcha oylar kesimi: jami daromad, jami xarajat, umumiy
  qoldiq (Σ qoldiq), jami orttirgan, **oyiga o'rtacha orttirish** =
  `round(jami orttirgan ÷ oylar soni)`, oylar soni (yozuvi bor oylar),
  o'rtacha oylik xarajat.
  **Invariant (testda tekshiriladi):** Σ oylik orttirgan = umumiy qoldiq +
  👤 fond qoldig'i.
- **BR-093 [ASL*]** **Prognoz** (oy oxirigacha):

  | Ko'rsatkich | Formula |
  |---|---|
  | O'tgan kunlar | joriy oy: `min(bugun, oydagi kunlar)`; o'tgan oy: oydagi kunlar |
  | Kunlik o'rtacha sarf | Xarajat ÷ o'tgan kunlar |
  | Oy oxirigacha sarf | joriy oy: `round(kunlik × oydagi kunlar)`; aks holda Xarajat |
  | Kutilayotgan daromad | joriy oy: 1) `[YANGI]` kutilayotgan daromad rejalari bo'lsa — kelgan + kelmagan rejalar; 2) aks holda `[ASL]` `max(kelgan, boshqa oylar o'rtachasi)`; o'tgan oy: kelgan |
  | Boshqa oylar o'rtachasi | (jami daromad − joriy oy daromadi) ÷ (oylar soni − 1) |
  | 📉 Oy oxiri qoldig'i | Kutilayotgan daromad − Oy oxirigacha sarf |
  | "Hali kelmagan" belgisi | kutilayotgan > kelgan bo'lsa: "hozircha kelgani X, qolgani kutilmoqda" |

- **BR-094 [YANGI]** **Kuniga sarflash mumkin** (joriy oy):
  `max(0, kutilayotgan daromad − xarajat − to'lanmagan jami) ÷ qolgan kunlar`
  (qolgan kunlar ≥ 1, bugun ham kiradi). Dashboardda katta raqam.
- **BR-095 [YANGI]** Oyni o'tgan oy va 3 oylik o'rtacha bilan solishtirish
  (↑/↓ foiz) — kategoriya va jami bo'yicha.

---

## 11. 🏦 Jamg'arma

- **BR-100 [ASL]** To'liq avtomatik, qo'lda yozilmaydi:
  `to'plangan[i] = to'plangan[i−1] + qoldiq[oy_i]` (oylar xronologik).
  Har oy uchun: daromad, xarajat, shu oy qolgan, to'plangan.
- **BR-101 [ASL]** Joriy oy ⏳ bilan belgilanadi (raqami oy davomida
  o'zgaradi). Xarajat qo'shilsa/o'zgarsa/o'chirilsa — darhol qayta hisoblanadi.
- **BR-102 [ASL]** Hisobotda: "Oldingi oylardan to'plangan", "Shu oy
  qo'shilgan (qoldiq)", "Shu oygacha to'plangan".
- **BR-103 [YANGI]** Jamg'arma — *ko'rsatkich*; pul **jismonan** qayerda
  ekanini hisoblar (masalan omonat) ko'rsatadi. Omonatga o'tkazma jamg'armani
  o'zgartirmaydi (BR-023).

---

## 12. 💳 Qarzlar va haqlar

- **BR-110 [ASL]** Qarz: nomi, yo'nalish (`i_owe` — men qarzdorman,
  `owed_to_me` — menga qarzdor), umumiy summa, oldin to'langan (ilovadan
  tashqari), oylik to'lov, `[YANGI]` muddat, izoh, arxiv.
- **BR-111 [ASL]** Bog'lanish **faqat aniq `debt_id` orqali** (nom bo'yicha
  taxmin qilinmaydi — eski tizimdagi nom mosligi xatolari takrorlanmaydi;
  bog'langan amal qarz valyutasida bo'ladi):
  - `i_owe` ← bog'langan **xarajatlar** (qarzimni to'ladim);
  - `owed_to_me` ← bog'langan **daromadlar** (haqimni qaytarishdi).
  Doimiy reja qarzga bog'lansa, undan yaratilgan rejalar ham bog'lanadi.
- **BR-112 [ASL]** Hisoblash:
  ```
  ilovadan  = Σ bog'langan amallar (yo'nalishga mos turdagi)
  qolgan    = max(0, umumiy − oldin_to'langan − ilovadan)
  qolgan_oy = oylik > 0 ? ceil(qolgan ÷ oylik) : —
  tugash    = joriy oy + qolgan_oy          ("16 oy (2028-01)")
  holat     = qolgan = 0 → "✅ Yopildi"
  progress  = min(1, (oldin_to'langan + ilovadan) ÷ umumiy)
  ```
- **BR-113 [ASL]** Bog'langan, lekin **to'lanmagan rejalar** qarzni
  kamaytirmaydi — "kutilmoqda: X so'm" sifatida alohida ko'rsatiladi.
- **BR-114 [ASL]** Jami: men qarzdorman (qolgan), menga qarzdorlar (qolgan),
  oylik majburiyat (qolgani > 0 bo'lgan `i_owe` qarzlarning oylik to'lovi),
  ⚖️ sof holat = menga qarzdor − men qarzdorman, shu oyda qarzga to'langan.
- **BR-115 [ASL]** Qarz to'lovi byudjetdan **oddiy xarajat** sifatida chiqadi
  (pul haqiqatan ketdi), qarz registri esa alohida — ikki marta sanalmaydi.
- **BR-116 [ASL]** Qarzlar ekranida 3 holat: bog'lanmagan (hali to'lov yo'q),
  kutilmoqda (bog'langan reja bor, to'lanmagan), to'lanyapti/yopildi.
- **BR-117 [ASL*]** Tekshiruv: bog'langan to'lovi yo'q qarzlar uchun **nomi
  o'xshash** xarajatlarni taklif qiladi ("Ehtimol shular: mashina — bog'lash").
- **BR-118 [YANGI]** Qarz tafsiloti: bog'langan barcha to'lovlar tarixi;
  muddat yaqinlashganda eslatma; `owed_to_me` uchun "qaytarishni so'rash"
  eslatmasi.

---

## 13. 🎯 Maqsadlar

- **BR-120 [ASL]** Maqsad: nomi, kerakli summa, yig'ilgan, oyiga ajratma
  (ixtiyoriy), muddat (ixtiyoriy), tartib.
- **BR-121 [ASL]** Hisoblash:
  ```
  qolgan   = max(0, kerak − yig'ilgan)
  progress = min(1, yig'ilgan ÷ kerak)
  oyiga    = maqsad.oyiga ?? oyiga_o'rtacha_orttirish (BR-092)
  oylar    = qolgan > 0 && oyiga > 0 ? ceil(qolgan ÷ oyiga) : —
  prognoz  = qolgan = 0 → "✅ Yig'ildi" | oylar → "N oy (YYYY-MM)"
             | "— oyiga ajratma yo'q"
  ulguradimi = tugash_oyi ≤ muddat oyi
  ```
- **BR-122 [YANGI]** Maqsadni hisobga bog'lash mumkin (masalan "USD omonat"):
  u holda `yig'ilgan = hisob qoldig'i` (asosiy valyutaga o'girilgan); aks
  holda qo'lda kiritiladi (eski xulq).
- **BR-123 [YANGI]** Maqsad yig'ilganda tabrik bildirishnomasi; muddatga
  ulgurmayotgan bo'lsa — ogohlantirish.

---

## 14. Limitlar (kategoriya byudjeti)

- **BR-130 [ASL]** Kategoriya uchun oylik limit. Holat: `ratio = fakt ÷ limit`
  — < 80% oddiy, 80–100% 🟡 yaqin, > 100% 🔴 oshdi. Ko'rinishi:
  `2 000 000 (100%)`.
- **BR-131 [ASL]** Oylik hisobotda limitdan oshganlar alohida ro'yxat.
- **BR-132 [YANGI]** Ota-kategoriya limiti subkategoriyalar yig'indisiga
  qo'llanadi.
- **BR-133 [YANGI]** 80% va 100% ga yetganda push-bildirishnoma — har oyda
  har chegara uchun **bir marta**.
- **BR-134 [YANGI]** Ishlatilmagan limitni keyingi oyga o'tkazish (rollover)
  opsiyasi: shu oy amaldagi limiti = limit + **o'tgan oy** qoldig'i
  (`limit − fakt`, ota-kategoriyada subkategoriyalar bilan). Oshib ketgan
  (manfiy) qoldiq faqat alohida sozlama yoqilganda ayiriladi; amaldagi limit
  noldan kichik bo'lmaydi va zanjir yig'ilmaydi — faqat bitta oldingi oy.

---

## 15. ⚡ Tez tugmalar

- **BR-140 [ASL]** Tez tugma: nomi, summa, kategoriya, hisob (namuna: Taksi
  20 000, Tushlik 35 000, Nonushta 15 000).
- **BR-141 [ASL]** Bosilganda **darhol** bugungi sana bilan xarajat yoziladi
  (`source = quick_action`). `[YANGI]` 5 soniyalik "Bekor qilish" bilan;
  uzoq bosilsa — to'ldirilgan forma ochiladi (summani o'zgartirish uchun).
- **BR-142 [YANGI]** Tartibni drag & drop bilan o'zgartirish; eng ko'p
  ishlatiladiganlar tavsiyasi (tarixdan).

---

## 16. 🔒 Oyni yopish

- **BR-150 [ASL]** Tugagan oyni yopish / qayta ochish (owner/admin). Joriy va
  kelgusi oylar yopilmaydi.
- **BR-151 [ASL]** Yopilgan oy 🔒 belgisi bilan ko'rsatiladi (yillik ko'rinish,
  hisobot, dashboard).
- **BR-152 [ASL]** Yopilgan oy amalini tahrirlash — ogohlantirish (BR-055).
- **BR-153 [YANGI]** Oyni yopishdan oldin tekshiruv: to'lanmagan rejalar,
  summasi noma'lumlar — "Yopish baribir?" dialogi.

---

## 17. 🔔 Eslatmalar va oylik hisobot

- **BR-160 [ASL]** **Kunlik eslatma** har a'zoning o'z soatida (standart
  09:00): ⚠️ muddati o'tgan, 📌 bugun, 🗓 yaqin N kunda (standart 3) to'lovlar
  + joriy oy qoldig'i. Summasi noma'lumlar "summa o'zgaruvchi" deb
  yoziladi. Eslatadigan narsa bo'lmasa — **yuborilmaydi**.
- **BR-161 [ASL]** **Oylik hisobot** har oyning belgilangan kunida
  (1–28, standart **21** — o'tgan oyning oylik/KPI/qo'shimchasi kelib
  bo'lishi uchun), o'tgan oy uchun: daromad, xarajat, qoldiq, orttirgan (%),
  👤 fond qoldig'i, 🏦 jamg'arma, qolgan qarz (> 0 bo'lsa), eng ko'p
  sarflangan 5 kategoriya, limitdan oshganlar.
- **BR-162 [ASL]** Shubhali oy: daromad < boshqa oylar o'rtachasining **60%**
  i bo'lsa — "⚠️ Diqqat: barcha yozuvlar kiritilganini tekshiring".
- **BR-163 [ASL*]** Kanallar: `[YANGI]` **push** (asosiy), **Telegram**,
  `[ASL]` email (ixtiyoriy). Har a'zo o'zi sozlaydi. Eski tizimda Telegram
  chat bitta global sozlama edi — endi har foydalanuvchi o'z botini
  **bir martalik havola** (`t.me/<bot>?start=<token>`) orqali ulaydi.
- **BR-164 [ASL]** "Hozir yuborish" / "Test xabar" (admin): natija aniq
  ko'rsatiladi — qayerga yuborildi yoki **nega yuborilmadi** (sozlanmagan /
  yozuv yo'q / o'chirilgan).
- **BR-165 [YANGI]** Kutilayotgan daromad rejasi 2 kundan ko'p kechiksa —
  "Oylik hali kiritilmadi" eslatmasi.
- **BR-166 [YANGI]** Har bir yuborish jurnalga yoziladi (kanal, holat, xato);
  bir xil xabar ikki marta yuborilmaydi (dedup kalit).
- **BR-167 [YANGI]** Oylik hisobotlar arxivi (admin panelda o'tgan
  hisobotlarni ko'rish).
- **BR-168 [YANGI]** Offline mahalliy eslatma: mobil ilova yaqin to'lovlar
  uchun qurilmaning o'zida eslatma rejalashtiradi (server ishlamasa ham).

---

## 18. 🩺 Tekshiruv (diagnostika)

- **BR-170 [ASL]** Tekshiruv natijasi uch bo'lim: **Muammolar**,
  **Ogohlantirishlar**, **Holat** (ma'lumot). Imkoni bo'lsa har muammo
  yonida "Tuzatish" amali.
- **BR-171** Tekshiriladi:
  - `[ASL]` joriy oyga ko'chirilmagan aktiv doimiy rejalar;
  - `[ASL]` bog'langan to'lovi yo'q qarzlar + o'xshash nomli xarajatlar;
  - `[ASL]` bog'langan, lekin to'lanmagan qarz rejalari;
  - `[ASL]` Telegram yoqilgan, lekin ulanmagan;
  - `[ASL]` aktiv doimiy reja umuman yo'q;
  - `[YANGI]` manfiy naqd qoldiq; uzoq (30+ kun) muddati o'tgan rejalar;
    yopilgan oyda keyin tahrirlangan amallar; sinxron to'qnashuvlari;
    oxirgi 24 soatda muvaffaqiyatsiz rejali ishlar; valyuta kursi eskirgan;
    push token eskirgan qurilmalar.
- **BR-172 [ASL]** Holat bo'limi: yozuvlar soni, oylar ro'yxati, yopilgan
  oylar, daromad qoidalari, eslatma sozlamalari, oxirgi rejali ishlar.

---

## 19. Ma'lumotlarni boshqarish

- **BR-180 [ASL]** To'liq eksport (JSON zaxira nusxa). `[YANGI]` CSV/XLSX
  (amallar, rejalar, davr bo'yicha), oylik hisobot PDF.
- **BR-181 [ASL]** Eski Google Sheets ilovasidan import (eksport JSON v1):
  import tugagach har oy uchun **qoldiq va orttirgan Sheets'ning o'z
  yakunlari bilan aynan mos** kelishi tekshiriladi; farq bo'lsa import
  bekor qilinadi (dry-run hisobot bilan).
- **BR-182 [YANGI]** CSV import (bank ko'chirmasi): ustunlarni moslashtirish,
  preview, dublikatlarni aniqlash (sana + summa + nom).
- **BR-183 [ASL]** Ommaviy tahrirlash (admin): kategoriyani almashtirish,
  o'chirish, "To'landi" — bitta tranzaksiyada.

---

## 20. Ko'p valyuta `[YANGI]`

- **BR-190** Byudjetning asosiy valyutasi (UZS). Har hisob o'z valyutasida.
- **BR-191** Har amalda: summa (hisob valyutasida) va **asosiy valyutadagi
  summa** — amal sanasidagi **Markaziy bank (cbu.uz)** kursi bo'yicha
  (sana uchun kurs bo'lmasa — undan oldingi eng yaqin kurs). Hisobotlar
  asosiy valyutada.
- **BR-192** Kurslar har kuni avtomatik yangilanadi. Foydalanuvchi amal
  uchun **o'z kursini** kiritishi mumkin (masalan bozordagi haqiqiy kurs).
- **BR-193** Turli valyutali o'tkazma ikkala summani saqlaydi; kurs
  ko'rsatiladi (masalan 100 USD → 1 265 000 so'm, kurs 12 650).
- **BR-194** Qarz va maqsad o'z valyutasiga ega bo'lishi mumkin; jamlarda
  asosiy valyutaga o'giriladi (joriy kurs bo'yicha).

---

## 21. Teglar, cheklar, qidiruv `[YANGI]`

- **BR-200** Teg — erkin belgi (masalan `#samarqand-safari`); amalga bir
  nechta teg; teg bo'yicha hisobot. Teg amal bilan birga yaratiladi, shuning
  uchun uni amal yoza oladigan har a'zo yaratadi; nomini o'zgartirish va
  o'chirish — `owner`/`admin`.
- **BR-201** Chek rasmi: qurilmada ≤ 1 MB gacha siqiladi, byudjetning shaxsiy
  papkasida saqlanadi; amal o'chirilsa rasm ham o'chadi.
- **BR-202** Qidiruv: nomi/izoh bo'yicha (xatoga chidamli), summa oralig'i,
  sana oralig'i, kategoriya, hisob, a'zo, teg filtrlari.

---

## 22. Xavfsizlik va maxfiylik

- **BR-210 [ASL]** Har foydalanuvchi faqat o'zi a'zo bo'lgan byudjet
  ma'lumotini ko'radi (server darajasida majburiy — RLS).
- **BR-211 [ASL]** Ilova qulfi: PIN / biometrika. `[YANGI]` Fonda N daqiqa
  turgach avto-qulf; ilova almashtirgichda ekran xiralashadi.
- **BR-212 [YANGI]** **Maxfiylik rejimi:** bir bosishda barcha summalar
  `•••` bilan yashiriladi (odamlar orasida ilovani ochganda).
- **BR-213 [YANGI]** Platforma adminlari uchun 2FA (TOTP) majburiy.
- **BR-214 [YANGI]** Ilova minimal versiyasi: server eski versiyani
  "Yangilash kerak" deb to'xtatishi mumkin (sxema o'zgarganda).

---

## 23. Telegram bot orqali tez kiritish `[YANGI, kengaytma]`

- **BR-220** Bog'langan foydalanuvchi botga `taksi 20000` yozsa — xarajat
  yaratiladi (nom tarixidan kategoriya/hisob taxmin qilinadi), tasdiqlash
  tugmalari bilan (✅ / ✏️ / ❌).
- **BR-221** Buyruqlar: `/balans` (joriy oy qoldig'i), `/bugun` (bugungi
  to'lovlar), `/hisobot` (oxirgi oylik hisobot).
- **BR-222** Uzcard/Humo karta xabarnomalari (bank botlaridan **forward**
  qilingan xabar) shablon bo'yicha tahlil qilinadi → summa, sana, joy
  to'ldiriladi. Shablonlar — admin paneldagi tizim spravochnigi.

---

## 24. Eski tizim → yangi tizim (izchillik jadvali)

| Eski (Sheets / v1) | Yangi | Izoh |
|---|---|---|
| `Daromad` sheeti | `transactions (kind=income)` | tur → daromad kategoriyasi |
| `Xarajat`: Reja + Fakt bitta qatorda | `planned_items` + `transactions` | BR-052 |
| `To'lov usuli`: Karta / Naqd | `accounts` (cash / card / ...) | BR-020, BR-022 |
| `O'zim uchun` sheeti (sarflar) | `personal_fund` hisobidan xarajatlar | BR-062 |
| "O'zim uchun" xarajat qatori (ajratma) | fondga o'tkazma + ajratma rejasi | BR-060, BR-061 |
| `Jamg'arma` sheeti | hisoblanadigan ko'rsatkich | BR-100 |
| `Qarzlar` (nom bo'yicha bog'lanish) | `debts` + `debt_id` | BR-111 |
| `Maqsadlar` | `goals` (+ hisobga bog'lash) | BR-120, BR-122 |
| `Sozlamalar` → doimiy xarajatlar | `recurring_rules` | BR-080 |
| `Sozlamalar` → limitlar | `category_limits` | BR-130 |
| `Sozlamalar` → tez tugmalar | `quick_actions` | BR-140 |
| `Sozlamalar` → daromad tegishliligi | `categories.month_shift` | BR-031, BR-040 |
| `Sozlamalar` → eslatma (I3:I8) | `notification_prefs` (har a'zoga) | BR-160..163 |
| `Hisobot` sheeti | admin: Oylik hisobot; mobil: Xulosa | BR-090..095 |
| `Yillik` sheeti | admin: Yillik ko'rinish | BR-092 |
| `🩺 Tekshirish va tuzatish` | Tekshiruv sahifasi | BR-170..172 |
| Yopilgan oylar (DocumentProperties) | `months.closed_at` | BR-150 |
| `Ro'yxat` sheeti | spravochniklar | 5-bo'lim |

## 25. Eski tizim va o'xshash ilovalardagi kamchiliklar → yechim

| # | Kamchilik | Qayerda uchragan | Yechim (qoida) |
|---|---|---|---|
| 1 | To'lov usuli faqat "karta/naqd" — bir nechta karta, e-hamyon, omonat yo'q | eski tizim | Hisoblar (BR-020) |
| 2 | Kartadan naqd yechish yozib bo'lmaydi (karta/naqd qoldig'i buziladi) | eski tizim | O'tkazma (BR-023, BR-053) |
| 3 | To'langan sana saqlanmaydi, qisman to'lov yo'q | eski tizim | Reja/fakt ajratildi (BR-052, BR-071) |
| 4 | Kategoriya erkin matn — xato yozilsa hisobot bo'linadi | eski tizim | Spravochnik + birlashtirish (BR-035, BR-036) |
| 5 | Qarz nom bo'yicha bog'lanadi — nom farq qilsa ishlamaydi | eski tizim | `debt_id` + o'xshash nom taklifi (BR-111, BR-117) |
| 6 | Maqsad "yig'ilgan" summasi qo'lda | eski tizim | Hisobga bog'lash (BR-122) |
| 7 | Telegram chat bitta global — ko'p foydalanuvchi mumkin emas | eski v1 | Har a'zoga ulash (BR-163) |
| 8 | Prognoz faqat o'rtacha daromadga tayanadi | eski tizim | Kutilayotgan daromad rejalari (BR-077, BR-093) |
| 9 | Oilaviy byudjet yo'q | eski tizim, ko'p ilovalar | A'zolar va rollar (3-bo'lim) |
| 10 | Valyuta (USD jamg'arma) yo'q | eski tizim | Ko'p valyuta + CBU kursi (20-bo'lim) |
| 11 | Server pullik rejaga bog'langan (Firebase Blaze) | eski v1 | To'liq bepul infratuzilma (ARXITEKTURA) |
| 12 | Zaxira nusxa yo'q | eski v1 | Kunlik shifrlangan zaxira (DEPLOY) |
| 13 | Qo'lda kiritish charchatadi | o'xshash ilovalar | Tez tugma + undo, nom avto-to'ldirish, Telegram bot, karta xabarini forward (BR-141, BR-056, 23-bo'lim) |
| 14 | Xatoni qaytarib bo'lmaydi | o'xshash ilovalar | Undo (BR-009) |
| 15 | Ommaviy joyda balans ko'rinib qoladi | o'xshash ilovalar | Maxfiylik rejimi (BR-212) |
| 16 | Oy boshida "qoldiq manfiy" chalg'itadi | eski tizim | Tegishli oy + kuniga sarflash mumkin (BR-040, BR-094) |
| 17 | Sinxron to'qnashuvda ma'lumot jimgina yo'qoladi | o'xshash ilovalar | Versiya tekshiruvi (BR-006) |
| 18 | Chekni saqlab bo'lmaydi | eski tizim | Chek rasmi (BR-201) |
| 19 | Qidiruv / filtr yo'q (mobil) | eski tizim | BR-202 |
| 20 | Bir martalik sozlash murakkab (Sheets menyulari) | eski tizim | Onboarding ustasi (mobil E14) |
