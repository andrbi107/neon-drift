# Neon Drift

> یک مسابقه‌ی dodging سنت‌ویو سه‌خطی بی‌پایان با حال‌وهوای outrun ۱۹۸۰ — PWA با Vanilla JS.

[![Version](https://img.shields.io/badge/version-v0.0.1-blue)](https://github.com/andrbi107/neon-drift/releases/tag/v0.0.1) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/neon-drift/) [![No deps](https://img.shields.io/badge/dependencies-none-success)](https://github.com/andrbi107/neon-drift) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/neon-drift/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/neon-drift)** · 🏷️ **[Release v0.0.1](https://github.com/andrbi107/neon-drift/releases/tag/v0.0.1)**

---

## معرفی

Neon Drift یک مسابقه‌ی dodging portrait بی‌پایان است که کاملاً روی یک HTML5 `<canvas>` رسم می‌شود. هویت بصری خالص synthwave/outrun: آسمان purple که در افق به magenta-orange می‌ریزد، خورشید رو به غروب با برش‌های افقی، کوه‌های نئونی دور، و یک جاده‌ی perspective grid که به سمت دوربین scroll می‌شود. بازیکن یک ماشین مثلثی cyan درخشان در نزدی‌ترین خط (از سه خط) است و با تعویض خط از موانع و رقیبان جاخالی می‌دهد.

همه‌چیز با primitives کانواس و `shadowBlur` رسم می‌شود — هیچ تصویر/اسپرایت/CDN نیست. سرعت هر ۱۵ ثانیه ۱۰٪ رشد می‌کند و نرخ اسپاون فشرده‌تر می‌شود. یک hit مساوی با پایان run است؛ بهترین امتیاز در `localStorage` ذخیره می‌شود.

## ویژگی‌ها

- **۳ خط perspective** — جاده به‌صورت ذوزنقه از بالا (نزدیک نقطه‌ی vanishing) به پایین (پهن) کشیده می‌شود.
- **اسپاون متنوع** — موانع magenta/red، ماشین‌های رقیب، و سلول‌های انرژی yellow ( diamond).
- **تضمین dodge** — موانع متوالی هرگز هر سه خط را کامل مسدود نمی‌کنند.
- **بوست** — Space یا دکمه‌ی BOOST: سرعت ×۱.۸ و امتیاز ×۱.۸ با یک میزان سوخت شارژی.
- **افکت‌ها** — scanline، glow trail روی ماشین، انفجار ذرات، افق parallax.
- **دلتا-تایم** — شبیه‌سازی مستقل از نرخ فریم (۶۰fps هدف).
- **کنترل کامل تاچ + کیبورد + موس** — روی موبایل ◀ ▶ و BOOST روی صفحه.
- **PWA آفلاین** — پس از اولین بارگذاری بدون اینترنت.

## نحوه‌ی بازی

| دستگاه | تعویض خط | بوست | توقف |
|---|---|---|---|
| **کیبورد** | ←/→ یا A/D | Space (نگه‌دار) | P یا Esc |
| **تاچ** | ◀ ▶ روی صفحه یا swipe چپ/راست | دکمه‌ی BOOST (نگه‌دار) | دکمه‌ی Pause |
| **موس** | کلیک نیمه‌ی چپ/راست کانواس | دکمه‌ی BOOST روی صفحه | دکمه‌ی Pause |

### مکانیک بازی

- **خطوط**: جاده یک ذوزنقه perspective است؛ بازیکن دقیقاً یک خط را اشغال می‌کند و تعویض با tween نرم انیمیشن می‌شود.
- **projection**: هر شیء یک عمق `z∈[0,1.2]` دارد؛ Y صفحه = `horizonY + (H-horizonY)*z`.
- **حرکت موانع**: `baseSpeed * speedMult * dt` در واحد z؛ `baseSpeed=0.40` و هر ۱۵s ×۱.۱۰ می‌شود.
- **امتیاز**: `distance += speed * pxPerZ * dt` → `score = floor(distance/10)`؛ هر سلول انرژی +۵۰.
- **برخورد**: وقتی `z∈[0.92,1.08]` مستطیل صفحه‌ای شیء با بازیکن overlap کند → انفجار + پایان run.
- **بوست**: سوخت در ~۲.۵s استفاده‌ی پیوسته خالی می‌شود، سپس ~۲.۰s cooldown پیش از شارژ مجدد.
- **رکورد**: ذخیره در `localStorage['neonDrift.best']` هنگام گیم‌اور اگر شکسته شود.
- **stateها**: `start` → `playing` → (`paused`) → `over`.

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | viewport meta، canvas، HUD، overlay صفحه‌ها |
| `styles.css` | لایوت نئون responsive، clamp typography، دکمه‌های روی صفحه |
| `main.js` | کل بازی: state machine، رندر perspective، spawn/collision/scoring/boost |
| `manifest.json` | PWA manifest، `orientation: portrait` |
| `sw.js` | precache کل shell و سرو آفلاین |
| `icon.svg` | مثلث ماشین نئون روی grid تیره |

## شخصی‌سازی

تمام tunableها بالای `main.js` به‌صورت ثابت‌های نام‌دار قرار دارند:

- `LANES` (۳) — تعداد خطوط.
- `SPEED_RAMP_INTERVAL_S` (۱۵), `SPEED_RAMP_FACTOR` (۱.۱۰) — کاتدنس دشواری.
- `BASE_SPEED` (۰.۴۰), `BOOST_MULT` (۱.۸) — سرعت پایه و ضریب بوست.
- `SPAWN_INTERVAL_START_S` (۱.۱), `SPAWN_INTERVAL_MIN_S` (۰.۴۵) — بازه‌ی نرخ اسپاون.
- `COIN_VALUE` (۵۰), `SCORE_PX_PER_POINT` (۱۰) — امتیازدهی.
- `BOOST_DURATION_S` (۲.۵), `BOOST_COOLDOWN_S` (۲.۰) — اقتصاد بوست.
- شیء `COLORS` (`sky`, `sun`, `player`, `obstacle`, `rival`, `coin`, `grid`) — retheme کل بازی در یک نقطه.

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/neon-drift.git
cd neon-drift
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/neon-drift/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.
