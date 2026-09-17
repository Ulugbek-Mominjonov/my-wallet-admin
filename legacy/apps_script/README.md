# 💰 Oylik byudjet — Google Sheets app

Oylikni turlari bo'yicha qabul qilish (avans / oylik / KPI / qo'shimcha × karta / naqd),
doimiy va o'zgaruvchan xarajatlarni yuritish, "o'zim uchun" ajratmasini hisoblash va
har oy uchun **total + qoldiq**ni avtomatik ko'rsatish uchun.

📱 **Telefonda ham ishlaydi** — web-ilova sifatida (pastda).

---

## Fayllar

| Fayl | Nima |
|---|---|
| `Code.gs` | Butun logika: sheetlarni yaratish, yangi oy ochish, hisobot, web-ilova API |
| `Ilova.html` | Telefon/desktop uchun interfeys (qoldiq + yozuv qo'shish + to'lovni belgilash) |
| `appsscript.json` | Manifest (vaqt zonasi: Asia/Tashkent, web app sozlamalari) |

---

## 1. O'rnatish (5 daqiqa)

1. Brauzerda [sheets.new](https://sheets.new) — yangi jadval oching, nomini "Oylik byudjet" qo'ying.
2. **Extensions → Apps Script**.
3. Chapdagi `Code.gs` faylini oching, ichidagini o'chirib, shu repodagi **`Code.gs`** ni to'liq nusxalang.
4. **+ → HTML** bosing, nomiga aniq **`Ilova`** deb yozing (`.html` yozmang) va **`Ilova.html`** ichidagini qo'ying.
5. (ixtiyoriy) ⚙️ Project Settings → "Show appsscript.json" ni yoqing va `appsscript.json` ni almashtiring.
6. 💾 saqlang → jadvalga qayting → sahifani **yangilang** (F5).
7. Yuqorida yangi **💰 Byudjet** menyusi chiqadi → **🚀 Dastlabki sozlash**.
   Birinchi safar Google ruxsat so'raydi: *Review permissions → o'z akkauntingiz → Advanced →
   Go to ... (unsafe) → Allow*. (Skript sizniki, faqat shu jadval bilan ishlaydi.)

---

## 2. Sozlash

**Sozlamalar** sheetida:

- **O'zim uchun ajratma** — `Foiz` (masalan 10 → daromadning 10%) yoki `Summa` (qat'iy miqdor),
  to'lov usuli va oyning qaysi kunida ajratilishi.
- **Doimiy xarajatlar jadvali** — har oy takrorlanadigan joylar: nomi, kategoriya, oylik reja,
  to'lov usuli, to'lov kuni, `Aktiv` ✅. Namuna qatorlar kiritilgan — o'zingiznikiga almashtiring.
  Aktiv belgisini olib tashlasangiz, keyingi oylarga ko'chirilmaydi.

Yangi kategoriya/daromad turi kerak bo'lsa — **Ro'yxat** sheetiga qo'shing va menyudan
**🔄 Ro'yxatlarni yangilash** ni bosing.

---

## 3. Har oyda ishlatish

1. **📅 Yangi oy ochish** → `2026-10` kabi kiriting. Doimiy xarajatlar + "o'zim uchun"
   qatori o'sha oy uchun **reja** sifatida `Xarajat` sheetiga yoziladi.
   (Qayta bossangiz takrorlanmaydi — faqat yetishmayotgani qo'shiladi.)
2. Pul tushganda → **➕ Yozuv qo'shish → Daromad**: sana, tur (avans/oylik/KPI/qo'shimcha),
   usul (karta/naqd), summa. Oraliqda chiqqan qo'shimcha pul ham shu yerga — turi `Qo'shimcha`.
3. To'lov qilganingizda → `Xarajat` qatoridagi **Fakt** ustunini to'ldiring
   (yoki telefonda "To'landi" tugmasi). Holat ustuni o'zi ✅ ga o'zgaradi.
4. Rejada yo'q xarajat chiqsa → **➖ Xarajat** dan yangi qator qo'shing.
5. **Hisobot** sheetida oyni tanlang.

---

## 4. 📱 Telefon uchun (muhim)

Google Sheets'ning **mobil ilovasida Apps Script menyusi ko'rinmaydi**. Shuning uchun
telefon uchun alohida web-ilova bor — xuddi shu ma'lumot bilan ishlaydi.

**Bir marta chiqarish:**

1. Apps Script muharririda (o'ngda tepada) **Deploy → New deployment**.
2. ⚙️ **Select type → Web app**.
3. *Execute as:* **Me** · *Who has access:* **Only myself** → **Deploy**.
4. Chiqqan **Web app URL** ni nusxalang (keyin ham kerak bo'lsa: menyu → **📱 Telefon uchun havola**).

**Telefonga qo'yish:**

- **Android (Chrome):** havolani oching → ⋮ → *Add to Home screen*.
- **iPhone (Safari):** havolani oching → Share ⬆️ → *Add to Home Screen*.

Ilovada nima bor (pastda 5 bo'limli navigatsiya):

- **Tepada** — oy nomi (`Sentabr 2026`), katta **QOLDIQ**, 💳 karta / 💵 naqd / 🔮 prognoz;
  `‹ ›` bilan oy almashtiriladi.
- **📊 Xulosa** — "shu oyda orttirgan pul" kartasi va foiz chizig'i, 4 ta stat (daromad,
  xarajat, o'zim uchun, to'lanmagan), byudjet holati progressi, daromad turlari va xarajat
  kategoriyalari **diagramma chiziqlarida**, ikkala fond qoldig'i, barcha oylar bo'yicha yakun.
- **➕ Daromad / ➖ Xarajat** — katta summa maydoni, tur va usul chiplari, bir necha bosishda saqlash.
- **⏳ To'lov** — to'lanmagan rejalar; har birida summa maydoni va "To'landi" tugmasi;
  shu yerdan **yangi oy ochish** ham mumkin.
- **🏦 Fondlar** — 👤 shaxsiy fond (qoldiq, ajratilgan/sarflangan, sarf qo'shish formasi va tarix)
  va 🏦 jamg'arma (avtomatik to'plangan qoldiq, oylar ro'yxati).

Dizayn: tizim shriftlari, yumaloq kartalar, **tungi rejim** (telefon sozlamasiga qarab avtomatik),
iOS/Android "safe area" hisobga olingan, bosh ekranga qo'shilganda alohida ilovadek ochiladi.

> Kodni o'zgartirsangiz: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**
> (havola o'zgarmaydi).

**Muqobil yo'l:** mobil Sheets ilovasida to'g'ridan-to'g'ri qator qo'shish ham ishlaydi —
dropdown'lar, `Oy` va `Holat` ustunlari formula bilan avtomatik to'ladi (skript talab qilmaydi).
Faqat **Sana** ustunini to'ldirishni unutmang — hisobot o'shanga qarab oyni aniqlaydi.

---

## 5. Sheetlar

| Sheet | Vazifasi |
|---|---|
| **Hisobot** | Tanlangan oy: daromad matritsasi (tur × karta/naqd), yakun, qoldiq, kategoriya kesimi, to'lanmagan to'lovlar |
| **Daromad** | Har bir tushum: `Oy (avto)`, sana, tur, usul, summa, izoh |
| **Xarajat** | Har bir to'lov: `Oy (avto)`, sana, joy, kategoriya, usul, **reja**, **fakt**, izoh, `Holat (avto)` |
| **O'zim uchun** | 👤 Shaxsiy fond: ajratmalar (avtomatik) va sarflar, qoldiq |
| **Jamg'arma** | 🏦 Umumiy jamg'arma: har oyning qoldig'i avtomatik to'planadi — qo'lda yozilmaydi |
| **Qarzlar** | 💳 Qarz va kreditlar: qolgan summa, oylik to'lov, tugash prognozi |
| **Maqsadlar** | 🎯 Jamg'arish maqsadlari: progress va "necha oyda yetadi" prognozi |
| **Sozlamalar** | Doimiy xarajatlar, "o'zim uchun" qoidasi, kategoriya limitlari, eslatma sozlamalari, tez tugmalar |
| **Yillik** | Oylar kesimida daromad / xarajat / o'zim uchun / qoldiq + diagramma |
| **Ro'yxat** | Dropdown ro'yxatlari (turlar, usullar, kategoriyalar) va oylar ro'yxati |

### Hisobot qanday hisoblanadi (muhim)

Jadvalda **umuman formula yo'q** — hamma narsani Apps Script hisoblab, tayyor qiymat sifatida
yozadi. Sabab: ruscha lokalli jadvalda formulalar (`SUMIFS`, `QUERY`, hatto `ARRAYFORMULA`)
`#ERROR!` berib qolishi aniqlandi. Skript hisoblagani uchun natija lokaldan mutlaqo mustaqil va
telefon ilovasidagi raqamlar bilan **aynan bir xil** (bitta hisoblash manbai).

Shuning uchun:

- `Oy (avto)` ustunini skript `Sana` dan hisoblab yozadi, `Holat (avto)` ni ham skript to'ldiradi;
- hisobot uchun oy **`Sana` ustunidan** olinadi — `Oy` ustuni faqat ko'rsatish uchun, u bo'sh
  bo'lsa ham hisob-kitob to'g'ri chiqadi;
- `Sozlamalar` da "o'zim uchun" `Foiz` rejimida bo'lsa, rejasi har yangilanishda oy daromadiga
  qarab qayta hisoblanadi.

Hisobot o'zi yangilanadi:

- `Daromad` yoki `Xarajat` da biror katak o'zgarganda (`onEdit`),
- `Hisobot!B2` da oy almashtirilganda,
- telefon ilovasidan yozuv qo'shilganda yoki "To'landi" bosilganda,
- menyu → **🔄 Hisobotni yangilash** (qo'lda).

> Mobil Sheets ilovasida qator qo'shsangiz, `onEdit` ishlamaydi — `Oy` va `Holat` ustunlari
> bo'sh turadi. Jadvalni kompyuterda ochganingizda (`onOpen`) yoki menyudan "Hisobotni
> yangilash" bosganingizda ular avtomatik to'ladi. Telefondagi web-ilova esa bunga bog'liq
> emas — u oyni `Sana` dan hisoblab, har doim to'g'ri ko'rsatadi.

### Hisobotdagi ko'rsatkichlar

- **QOLDIQ** = jami daromad − faktik xarajat.
- **Prognoz qoldiq** = qoldiq − to'lanmagan rejalar (oy oxirigacha nima qolishi).
- **Karta / Naqd qoldiq** = shu usulda tushgan pul − shu usulda sarflangan pul.
- **JAMI** qatori to'lov usuli bo'yicha hisoblanadi, shuning uchun ro'yxatda yo'q
  daromad turi bo'lsa ham total to'g'ri chiqadi (yonida ⚠ ogohlantirish chiqadi).

---

## 6. Jadval va telefon ilovasi sinxronmi?

Ha — **bitta ma'lumot**, alohida baza yo'q. Web-ilova shu jadvalga "bog'langan" (container-bound)
skript, ya'ni u aynan `Daromad` / `Xarajat` sheetlariga yozadi va o'shalardan o'qiydi.

| Qayerda o'zgartirdingiz | Qayerda ko'rinadi | Qachon |
|---|---|---|
| Telefon ilovasida yozuv qo'shdingiz | Jadvalda yangi qator | **Darhol** (jadval ochiq bo'lsa, jonli yangilanadi) |
| Jadvalda qator qo'shdingiz / `Fakt` ni to'ldirdingiz | Telefon ilovasida | Sahifani yangilaganda yoki `‹ ›` bilan oyni almashtirganda |
| Telefondan "To'landi" bosdingiz | Jadvaldagi `Fakt` va `Holat` ustuni | **Darhol** |

Muhim tafsilotlar:

- Telefon ilovasi raqamlarni **Hisobot sheetidagi formulalardan emas**, xom qatorlardan
  o'zi hisoblaydi. Shuning uchun Hisobotda qaysi oy tanlanganidan qat'i nazar bir xil natija
  chiqadi va ikkalasi hech qachon "chalkashmaydi".
- Telefonda `‹ ›` bilan oy almashtirish **Hisobot sheetidagi tanlovni o'zgartirmaydi** — ular
  mustaqil. Ya'ni kompyuterda sentabrni ko'rib turganingizda telefonda oktabrni ochsangiz,
  kompyuterdagi ko'rinish o'zgarmaydi.
- Bir vaqtda ikki joydan yozilsa ham qator ustma-ust tushmaydi — yozuv operatsiyalari
  `LockService` bilan qulflangan.
- Telefonda "To'landi" bosganingizda qator jadvalda o'zgargan (o'chirilgan/saralangan) bo'lsa,
  ilova noto'g'ri qatorga yozmaydi — xato beradi va ro'yxatni yangilashni so'raydi.
- Web-ilova **internet talab qiladi** (Google serverida ishlaydi). Internetsiz ishlash kerak
  bo'lsa — mobil Sheets ilovasining offline rejimidan foydalaning, qator qo'shish baribir ishlaydi.

---

## 7. Doimiy xarajat summasi oydan-oyga o'zgarsa

Har bir oy uchun **alohida qator** yoziladi, shuning uchun summani o'zgartirish oson —
`Sozlamalar` dagi miqdor faqat **boshlang'ich qiymat** (oy ochilganda ko'chiriladigan reja).

| Holat | Nima qilasiz |
|---|---|
| Shu oyda summa boshqacha | `Xarajat` sheetida o'sha oy qatorining **`Reja`** ini o'zgartiring — boshqa oylarga ta'sir qilmaydi |
| Reja 300 000 edi, 350 000 to'ladingiz | **`Fakt`** ga haqiqiy summani yozing (telefonda: "To'landi" yonidagi maydonda tuzating). Reja tegilmaydi — farq hisobotda ko'rinib turadi |
| Summa butunlay o'zgardi (masalan ijara oshdi) | `Sozlamalar` dagi miqdorni yangilang — **keyingi** oylarga qo'llanadi |
| Summa har oy o'zgaruvchan (kommunal, oziq-ovqat) | `Sozlamalar` da **`Oylik reja` ni bo'sh qoldiring** — qator har oy summasiz ochiladi, to'laganda faqat `Fakt` ni kiritasiz |

Bo'sh rejali ("summasi har oy o'zgaradi") to'lovlar ham unutilib qolmaydi:
Hisobotning **to'lanmagan to'lovlar** ro'yxatida va telefondagi **⏳ To'lovlar** bo'limida
ko'rinib turadi, faqat summasi `?` bilan belgilanadi (xulosada: `1 200 000 so'm + 2 ta ?`).

> `📅 Yangi oy ochish` allaqachon ochilgan oyni **qayta yozmaydi** — faqat yetishmayotgan
> qatorlarni qo'shadi. Ya'ni oy ichida qo'lda tuzatgan summalaringiz saqlanib qoladi.

---

## 8. 🇷🇺 Ruscha interfeys uchun qadamlar

Google Sheets/Apps Script tili ruscha bo'lsa, tugma nomlari quyidagicha:

### O'rnatish

1. **Расширения** → **Apps Script**
2. Chapdagi `Code.gs` → **Ctrl+A** → **Delete** → `Code.gs` mazmunini paste → **Ctrl+S**
3. Chapda **Файлы** yonidagi **+** → **HTML** → nomi: `Ilova` → ichini tozalab `Ilova.html` ni paste → **Ctrl+S**
4. (ixtiyoriy) **⚙️ Настройки проекта** → ✅ *Показывать файл манифеста appsscript.json в редакторе* → `appsscript.json` ni almashtiring
5. Jadvalga qayting → **F5** → yuqorida **💰 Byudjet** menyusi → **🚀 Dastlabki sozlash**
6. Ruxsat oynasi: **Проверить разрешения** → akkauntni tanlang → **Дополнительные настройки** →
   **Перейти на страницу … (небезопасно)** → **Разрешить**

### Vaqt zonasi (muhim)

**Файл** → **Настройки** → **Часовой пояс**: `(GMT+05:00) Ташкент` → **Сохранить настройки**.
Apps Script tarafida ham: **⚙️ Настройки проекта** → **Часовой пояс** → `Asia/Tashkent`.

> **Региональные настройки** (til/lokal) ni o'zgartirish **shart emas** — ruscha qolsa ham hammasi ishlaydi.

### Telefon uchun web-ilovani chiqarish

1. Apps Script'da o'ng tepada **Начать развертывание** → **Новое развертывание**
2. ⚙️ **Выберите тип** → **Веб-приложение**
3. **Описание**: `Byudjet v1` · **Запуск от имени**: *Я* · **У кого есть доступ**: **Только я**
4. **Развернуть** → **URL веб-приложения** ni nusxalang
5. Telefonda: Chrome → ⋮ → **Добавить на главный экран** / Safari → ⬆️ → **На экран «Домой»**

### Kodni yangilaganda

**Начать развертывание** → **Управление развертываниями** → ✏️ (**Изменить**) →
**Версия**: **Новая версия** → **Развернуть**. Havola o'zgarmaydi.

### Formulalar haqida

Ruscha lokalda qo'lda formula yozganda argumentlar `;` bilan ajratiladi (`=СУММ(A1;A2)`),
lekin **siz formula yozmaysiz** — hammasini skript qo'yadi va skript formulalari lokalga
bog'liq emas. `Oy` ustuni ham `YEAR()/MONTH()` orqali hisoblanadi, ya'ni har qanday tilda
bir xil ishlaydi. Raqamlar ruscha formatda ko'rinadi: `1 234 567 so'm`.

---

## 9. Ikkita alohida fond

Pul ikkita **butunlay mustaqil** hisobda yuritiladi. Ular hech bir joyda qo'shilmaydi —
na hisobotda, na telefon ilovasida.

### 👤 O'zim uchun (shaxsiy pul) — `O'zim uchun` sheeti

- **Kirim avtomatik:** `Xarajat` dagi `O'zim uchun` kategoriyali qatorning `Fakt` ustunini
  to'ldirsangiz (yoki telefonda "To'landi" bossangiz), o'sha summa shu fondga tushadi.
  Qo'shimcha ajratsangiz — `Xarajat` ga yana bir `O'zim uchun` qatori qo'shasiz.
- **Chiqim qo'lda:** sheetning pastki jadvaliga yoki telefondagi 🏦 Fondlar bo'limiga yozasiz.
- **Qoldiq** = ajratilgan − sarflangan.

### 🏦 Jamg'arma (umumiy) — `Jamg'arma` sheeti

**To'liq avtomatik, qo'lda hech narsa yozilmaydi.** Har oy uchun `daromad − xarajat` hisoblanadi
va oylar bo'yicha to'planib boradi:

| Oy | Daromad | Xarajat (fakt) | Shu oy qolgan | To'plangan (jami) |
|---|---|---|---|---|
| 2026-08 | 4 000 000 | 2 600 000 | 1 400 000 | 1 400 000 |
| 2026-09 | 5 750 000 | 3 000 000 | 2 750 000 | 4 150 000 |

Xarajat **qo'shsangiz, o'zgartirsangiz yoki qatorini o'chirsangiz** — jamg'arma o'sha zahoti
qayta hisoblanadi. Qator o'chirilishini oddiy `onEdit` ushlamagani uchun qo'shimcha
`onChange` trigger o'rnatiladi (birinchi o'rnatishda Google bir marta ruxsat so'raydi).

### Qayerda ko'rinadi

| Joy | 👤 O'zim uchun | 🏦 Jamg'arma |
|---|---|---|
| O'z sheeti | Tepada: ajratilgan / sarflangan / qoldiq | Tepada: jami to'plangan + oylar jadvali |
| `Hisobot` | O'ng tepadagi 👤 bloki (shu oy ajratilgan, sarflangan, fond qoldig'i) | Uning ostidagi 🏦 bloki (oldingi oylardan, shu oy qo'shilgan, shu oygacha to'plangan) |
| Telefon | **🏦 Fondlar** dagi birinchi karta (sarf qo'shish formasi bilan) | O'sha bo'limdagi ikkinchi karta (faqat ko'rsatadi) |

> **Ikkalasi nega aralashmaydi?** 👤 shaxsiy fond faqat `O'zim uchun` ajratmalaridan to'ladi va
> undan qilingan xaridlar o'sha fond ichida yuriladi. 🏦 jamg'arma esa oylik qoldiqlardan
> hisoblanadi — ajratma allaqachon xarajat sifatida chiqib bo'lgani uchun u yerga ikkinchi
> marta tushmaydi. Hech bir hisobotda bu ikki raqam qo'shilmaydi.

## 10. 📈 Har oyda qancha pul orttiryapman?

`Hisobot` ning **5️⃣ ORTTIRISH VA JAMG'ARMA** blokidagi birinchi raqam — **shu oyda orttirgan
pulingiz**. U shunday hisoblanadi:

```
Orttirgan = Byudjet qoldig'i + O'zim uchun ajratma − Shaxsiy fonddan sarflangan
```

Nega ajratma qo'shiladi? Chunki "o'zim uchun" ajratilgan pul **sarflanmagan** — u shunchaki
boshqa cho'ntakka (jamg'armaga) o'tgan, ya'ni u ham siz orttirgan pul. Jamg'armadan
nimadir sotib olsangiz — o'sha haqiqiy sarf, shuning uchun ayiriladi.

**Misol** (bir oy): daromad 5 750 000, to'langan xarajat 3 000 000 (shundan 1 000 000 —
o'zim uchun ajratma), shaxsiy fonddan 450 000 sarflangan.

| | |
|---|---|
| Byudjet qoldig'i | 5 750 000 − 3 000 000 = **2 750 000** |
| + o'zim uchun ajratma | + 1 000 000 |
| − shaxsiy fonddan sarf | − 450 000 |
| **📈 Orttirgan** | **3 300 000** (daromadning 57% i) |

Tekshirish: haqiqiy sarf = 2 000 000 (ijara) + 450 000 (shaxsiy fonddan) = 2 450 000.
5 750 000 − 2 450 000 = 3 300 000 ✅

### Barcha oylar kesimi

`Hisobot` ning **3️⃣ ORTTIRISH** blokida:

| Ko'rsatkich | Ma'nosi |
|---|---|
| **📈 Shu oy orttirgan pul** | Yuqoridagi formula bo'yicha |
| **Umumiy byudjet qoldig'i** | Barcha oylardagi qoldiqlar yig'indisi |
| **Oyiga o'rtacha orttirish** | Jami orttirish ÷ oylar soni |

> **Tekshirish qoidasi:** har oydagi "Orttirgan" yig'indisi = umumiy byudjet qoldig'i +
> 👤 shaxsiy fond qoldig'i. 🏦 umumiy jamg'arma bu hisobga kirmaydi — u byudjetdagi pulni
> boshqa joyga ko'chirish, ya'ni ichki harakat.

`Yillik` sheetida esa bularning hammasi oylar kesimida: daromad, xarajat, o'zim uchun,
byudjet qoldig'i, shaxsiy fonddan sarf, **📈 orttirgan** va orttirish foizi, pastda **JAMI** qatori.

---

## 11. Qo'shimcha imkoniyatlar

### 📊 Kategoriya limitlari

`Sozlamalar` → **H11:I** jadvali: kategoriya (**ro'yxatdan tanlanadi**) va uning oylik chegarasi.
Tez tugmalar va daromad tegishliligi jadvallaridagi kataklar ham dropdown bilan to'ldiriladi.

- `Hisobot` ning **5️⃣ XARAJAT — KATEGORIYA VA LIMITLAR** jadvalida "Limitdan" ustuni:
  80–100% sariq, 100% dan oshsa qizil.
- Telefonda kategoriya chiziqlari limitga nisbatan bo'yaladi va `2 000 000 (100%)` ko'rinishida chiqadi.
- Oylik hisobotda limitdan oshganlar alohida ro'yxat bo'lib keladi.

### 🔔 Telegram eslatmalari va oylik hisobot

**Bir marta sozlash:**

1. Telegramda **@BotFather** ga `/newbot` yozing, bot nomini bering — u sizga **token** beradi.
2. Jadvalda: menyu → **⚙️ Sozlash → 🤖 Telegram sozlash** → tokenni joylashtiring.
3. Chiqqan oynada aytilganidek, o'z botingizga Telegramda `/start` yozing → **OK**.
   Chat avtomatik aniqlanadi va test xabari keladi.
4. `Sozlamalar` → **H3:I8**: Telegram (Ha/Yo'q), email manzil, necha kun oldin eslatilsin,
   kunlik eslatma soati, oylik hisobot (Ha/Yo'q) va **oylik hisobot qaysi kuni** (odatda 3).

**Nima keladi:**

- **Har kuni** belgilangan soatda — muddati o'tgan, bugungi va yaqin kunlardagi to'lovlar
  hamda byudjet qoldig'i.
- **Har oyning belgilangan kunida** (odatda 3-sana) — o'tgan oy yakuni: daromad, xarajat, qoldiq,
  orttirgan (%), ikkala fond, qolgan qarz, eng ko'p sarflangan 5 kategoriya, limitdan oshganlar.
  Hisobot 1-sanada emas, bir necha kun keyin ketadi — oyning oxirgi yozuvlarini kiritishga
  ulgurishingiz uchun. Agar o'sha oy daromadi odatdagidan ancha kam bo'lsa, hisobotga
  **"⚠️ Diqqat: barcha yozuvlar kiritilganini tekshiring"** ogohlantirishi qo'shiladi.
- Email manzil kiritilgan bo'lsa — xuddi shu xabar pochtaga ham boradi.

> Tekshirish uchun: menyu → ⚙️ Sozlash → **🔔 Eslatmani hozir tekshirish** yoki
> **📊 Oylik hisobotni hozir yuborish** (u qaysi oy kerakligini so'raydi).
> Ikkalasi ham natijani oyna qilib ko'rsatadi: nimaga yuborildi yoki nega yuborilmadi
> (Telegram sozlanmagan / o'sha oyda yozuv yo'q / sozlamada o'chirilgan).

### 🔗 Qarz va haqni yozuvlarga bog'lash

`Xarajat` sheetida **"Qarz / haq (ixtiyoriy)"**, `Daromad` sheetida **"Haq / qarz (ixtiyoriy)"**
ustuni bor — ikkalasi ham `Qarzlar` dagi nomlardan **dropdown** bilan tanlanadi.

| Vaziyat | Qayerga yozasiz | Nimani bog'laysiz | Natija |
|---|---|---|---|
| Qarzimni to'ladim | `Xarajat` | o'z qarzim | Qarz qoldig'i kamayadi |
| Haqimni qaytarishdi | `Daromad` | menga qarzdor | Haq qoldig'i kamayadi |

Yozuv nomi qarz nomidan **farq qilsa ham** bog'lanish ishlaydi — masalan `Xarajat` da
"Avtokredit tolovi" deb yozib, bog'lanishda "Mashina to'lovi" ni tanlasangiz bo'ladi.

Bog'lanish ustuni bo'sh bo'lsa-yu, yozuv nomi qarz nomi bilan aynan mos kelsa —
skript uni **avtomatik bog'laydi** (eski yozuvlar uchun).

### 💳 Qarzlar

`Qarzlar` sheetida har bir qarz: nomi, turi (*Men qarzdorman* / *Menga qarzdor*), umumiy summa,
oldin to'langan, oylik to'lov.

- **"Ilovadan to'langan" avtomatik:** `Xarajat` da `Joy / nomi` ustuni qarz nomi bilan **aynan
  bir xil** bo'lgan to'lovlarning `Fakt` ustuni o'zi yig'iladi. Ya'ni "Mashina to'lovi" ni har oy
  to'lasangiz, qarz qoldig'i o'zi kamayib boradi.

> ⚠️ **Nom aynan mos bo'lishi shart** (katta-kichik harf va ortiqcha bo'sh joy ahamiyatsiz).
> `Xarajat` da "Mashina", `Qarzlar` da "Mashina to'lovi" bo'lsa — bog'lanmaydi. Tekshiruv buni
> topib, o'xshash nomlarni ko'rsatib beradi:
> *"⚠ 'Mashina to'lovi' qarziga bog'langan to'lov topilmadi… O'xshash nomlar bor: mashina"*

**Ikki marta sanalmaydimi?** Yo'q. Qarz to'lovi `Xarajat` da oddiy xarajat sifatida byudjetdan
chiqadi (pul haqiqatan ketdi), `Qarzlar` esa alohida **registr** — u byudjet arifmetikasiga
qo'shilmaydi, faqat qarz qoldig'ini kuzatadi. `Hisobot` ning 💳 blokida "Shu oyda qarzga
to'langan" qatori ham bor.
- **Qolgan** va **tugash prognozi** (`16 oy (2028-01)`) avtomatik hisoblanadi.
- `Hisobot` da 💳 bloki: men qarzdorman / menga qarzdor / oylik majburiyat / ⚖️ sof holat.

### 🎯 Maqsadlar

`Maqsadlar` sheeti: maqsad nomi, kerakli summa, yig'ilgan, ixtiyoriy "oyiga ajratma", muddat.

- Qolgan, progress va **"necha oyda yetadi"** avtomatik hisoblanadi.
- "Oyiga ajratma" bo'sh bo'lsa — **oyiga o'rtacha orttirishingizga** qarab prognoz qilinadi.
- `Hisobot` da 🎯 jadvali, telefonda progress chiziqlari.

### ⚡ Tez qo'shish tugmalari

`Sozlamalar` → **K10:N** jadvali: tugma nomi, summa, kategoriya, to'lov usuli
(namuna: Taksi 20 000, Tushlik 35 000).

Telefondagi **➖ Xarajat** bo'limining tepasida chiqadi — bosilganda **darhol yoziladi**
(bugungi sana bilan). Har kuni takrorlanadigan mayda xarajatlar uchun.

### 📉 Prognoz

`Hisobot` → **4️⃣ PROGNOZ** (va telefonda alohida karta):

| Ko'rsatkich | Ma'nosi |
|---|---|
| Oyning o'tgan qismi | `16 / 30 kun` |
| Kunlik o'rtacha sarf | Shu oygacha sarflangan ÷ o'tgan kunlar |
| Shu sur'atda oy oxirigacha sarf | Kunlik × oydagi kunlar |
| 📉 Taxminiy oy oxiri qoldig'i | Daromad − taxminiy sarf |
| O'rtacha oylik xarajat | Barcha oylar bo'yicha |

### 🔒 Oyni yopish

Menyu → **🔒 Oyni yopish**. Tugagan oyni "yopilgan" deb belgilaydi:

- `Yillik` sheetida oy yoniga 🔒 belgisi qo'yiladi, `Hisobot` da ham ko'rinadi.
- Yopilgan oydagi qatorni o'zgartirsangiz — ogohlantirish chiqadi (bloklamaydi, faqat eslatadi).
- Qaytarish: **🔓 Oyni qayta ochish**.

---

## 12. Daromad oy davomida bo'lib tushsa

Daromad bir kunda emas, oy davomida bo'lib tushadi (masalan: oylik 1–3, KPI 5–8,
avans 15–17, qo'shimcha 15–20). Bu ikkita joyga ta'sir qilardi — ikkalasi ham hisobga olingan:

**Prognoz.** Oy o'rtasida faqat kelib ulgurgan daromad ko'rinadi, xarajatlar esa allaqachon
yozilgan — shuning uchun "oy oxiri qoldig'i" noto'g'ri manfiy chiqishi mumkin edi. Endi prognoz
**kutilayotgan daromad**ni hisoblaydi: agar joriy oyda kelgan daromad o'tgan oylarning
o'rtachasidan kam bo'lsa, farqi hali kelmagan deb hisoblanadi.

```
Kelgan (sentabr):      1 000 000     ← faqat oylik tushgan
O'rtacha (oldingi oy): 6 000 000
Kutilayotgan:          6 000 000     ← prognoz shundan hisoblanadi
```

Hisobotda alohida **"Kutilayotgan daromad"** qatori bor, yonida "hozircha kelgani …" izohi
chiqadi. Telefonda ham xuddi shu ko'k rangda ko'rinadi.

**Oylik hisobot.** 1-sana o'rniga sozlanadigan kunda (odatda 3-sana) yuboriladi va daromad
odatdagidan ancha kam bo'lsa ogohlantirish qo'shiladi.

**Boshqa jarayonlarga ta'siri yo'q:**

| Jarayon | Holat |
|---|---|
| "O'zim uchun" `Foiz` rejimi | Har yangilanishda qayta hisoblanadi — daromad kelgani sari reja o'zi oshadi ✅ |
| Kunlik to'lov eslatmasi | Faqat to'lov sanalariga qaraydi, daromadga bog'liq emas ✅ |
| Limitlar | Faqat xarajatga qaraydi ✅ |
| 🏦 Jamg'arma | Joriy oy qatori ⏳ bilan belgilanadi — oy tugagach yakuniy raqam qoladi |
| 📈 Orttirish | Oy davomidagi haqiqiy holatni ko'rsatadi, oy oxirida to'liq bo'ladi |
| 💳 Qarz, 🎯 maqsad | Daromad vaqtiga bog'liq emas ✅ |

---

## 13. Daromad qaysi oyning puli hisoblanadi

Pul **qachon kelgani** bilan **qaysi oyning daromadi** ekani har doim bir xil emas: 1–3 sanada
kelgan oylik — o'tgan oyning oyligi. Shuning uchun har bir daromad turi uchun qoida bor.

`Sozlamalar` → **P11:Q** jadvali:

| Daromad turi | Tegishli oy |
|---|---|
| Avans | Joriy oy |
| Oylik | Oldingi oy |
| KPI | Oldingi oy |
| Qo'shimcha | Oldingi oy |

Natija (oktabr oyida olingan pullar):

| Olingan sana | Tur | Tegishli oy |
|---|---|---|
| 02.10 | Oylik | **2026-09** |
| 06.10 | KPI | **2026-09** |
| 16.10 | Avans | **2026-10** |
| 18.10 | Qo'shimcha | **2026-09** |

`Daromad` sheetidagi birinchi ustun shuning uchun **"Tegishli oy"** deb nomlangan —
barcha hisobotlar (oylik yakun, orttirish, jamg'arma, prognoz) shu ustunga tayanadi.
`Olingan sana` esa pulni qo'lga olgan kuningiz bo'lib qoladi.

Telefonda daromad qo'shayotganda tur va sanani tanlashingiz bilan ostida
**"→ Sentabr 2026 oyining daromadi sifatida yoziladi (oldingi oy)"** deb ko'rinib turadi.

> **Oylik hisobot kuni shuning uchun 21-sanaga qo'yilgan:** o'tgan oyning oyligi (1–3),
> KPI si (5–8) va qo'shimcha puli (15–20) kelib bo'lgandan keyin yuborilsin.
> `Sozlamalar` → I8 da o'zgartirsangiz bo'ladi.

---

## 14. Xarajat qaysi oyning byudjetiga tegishli

Daromad kabi, xarajatda ham **to'lov sanasi** bilan **qaysi oyning byudjeti** ekani har xil
bo'lishi mumkin: 5-oktabrda to'lanadigan kredit aslida **sentabr** oyining xarajati,
chunki u sentabr oyligidan to'lanadi.

`Xarajat` sheetida **K ustuni — "Tegishli oy (qo'lda)"**:

| To'lov sanasi | K ustuni | Qaysi oyga tushadi |
|---|---|---|
| 05.10.2026 | `2026-09` | **2026-09** (sentabr byudjeti) |
| 07.10.2026 | bo'sh | 2026-10 (sanadan) |

**`📅 Yangi oy ochish` buni o'zi to'ldiradi:** sentabr oyini ochsangiz, barcha doimiy xarajatlar
`K = 2026-09` bilan yoziladi — to'lov kuni keyingi oyga tushsa ham o'sha oyda qoladi.

Telefonda xarajat qo'shayotganda **"Qaysi oyning byudjetiga?"** tanlovi bor:
*Sana bo'yicha* yoki *Oldingi oy* — ostida "→ Sentabr 2026 byudjetiga yoziladi" deb ko'rsatib turadi.

---

## 15. To'lov holati va avtomatik to'lovlar

**Sana kelgani bilan xarajat o'z-o'zidan "to'landi" bo'lmaydi** — bu ataylab shunday: reja
to'lov emas, to'lov kechikishi yoki bekor bo'lishi mumkin. Aks holda byudjet sarflanmagan
pulni sarflangan deb ko'rsatardi.

### Holat (I ustuni) o'zi hisoblanadi

| Holat | Qachon |
|---|---|
| ✅ To'landi | `Fakt` to'ldirilgan |
| ⏳ Kutilmoqda | `Fakt` bo'sh, to'lov sanasi hali kelmagan |
| ⚠️ Muddati o'tdi | `Fakt` bo'sh, to'lov sanasi **o'tib ketgan** |

Telefondagi **⏳ To'lov** bo'limida muddati o'tganlar ⚠️ belgisi va qizil yozuv bilan ajralib turadi.

### Avto to'lov — bankdan o'zi yechiladiganlar uchun

`Sozlamalar` → doimiy xarajatlar jadvalidagi **G ustuni "Avto to'lov"** ✅ bo'lsa:
to'lov sanasi kelganda `Fakt` **avtomatik** `Reja` ga tenglashtiriladi va holat ✅ bo'ladi.

Internet, telefon, obuna kabi bankdan avtomatik yechiladiganlar uchun mos. Ijara, oziq-ovqat
kabi qo'lda to'lanadiganlarni belgilamang.

Bu `Xarajat` sheetining **L ustuniga** ko'chiriladi — istalgan qatorda alohida yoqib/o'chirsangiz bo'ladi.

Avto to'lov ikki joyda bajariladi: jadval har yangilanganda va **har kuni eslatma triggeri
ishlaganda** — ya'ni jadvalni ochmasangiz ham ishlaydi.

---

## Eslatmalar

- `Oy (avto)` va `Holat (avto)` ustunlariga qo'lda yozmang — ular har yangilanishda
  qayta hisoblanadi. Siz to'ldiradigan yagona majburiy ustun — **`Sana`**.
- Muammo bo'lsa: menyu → **🩺 Tekshiruv** — u xato kataklarni, ularning formulasini va
  ma'lumotdagi nuqsonlarni (sanasi bo'sh qatorlar, noto'g'ri to'lov usuli) ro'yxat qilib beradi.
- `To'lov usuli` va `Tur` ro'yxatdan tanlanadi (hisobot shularga tayanadi), `Kategoriya` esa
  erkin — istagan nomni yozsangiz ham kategoriya kesimiga tushadi.
- Qatorlarni o'chirsangiz — hisobot o'zi qayta hisoblaydi, hech narsa buzilmaydi.
- Ma'lumot bitta tekis jadvalda saqlanadi (har oyga alohida sheet ochilmaydi), shuning uchun
  yillar davomida ishlatsangiz ham sekinlashmaydi.
