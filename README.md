# ⚡ YT2Course — دوره‌ساز هوشمند یوتیوب

از یوتیوب **دوره آموزشی مرحله‌به‌مرحله** بساز — مستقیم روی موبایل، بدون افزونه.

🌐 **نسخه آنلاین:** https://yt2course.pages.dev (بعد از اتصال ریپو به Cloudflare Pages فعال می‌شود)

## ✨ امکانات

- 🤖 **حالت خودکار با AI (Gemini):** موضوع را جستجو کن، ویدیوها را انتخاب کن؛ اپ ترنسکریپت ویدیوها را می‌خواند و یک دوره ساختاریافته با لینک هر بخش تولید می‌کند.
- 🪄 **حالت پل NotebookLM:** لینک ویدیوها را بده، پرامپت آماده ساخته و کپی می‌شود — یک کلیک تا NotebookLM.
- 📱 **PWA موبایلی:** روی گوشی نصب می‌شود (Add to Home Screen)، تم تیره نئونی، فارسی RTL، آفلاین قابل باز شدن.
- 📚 ذخیره دوره‌ها در «دوره‌های من» (localStorage).

## ☁️ دیپلوی Cloudflare Pages (پیشنهادی)

1. Cloudflare Dashboard → Workers & Pages → Create → **Pages** → Connect to Git
2. این ریپو را انتخاب کن (output = `public` از `wrangler.toml` خوانده می‌شود)
3. Settings → Environment variables → Add: `GEMINI_API_KEY` (Type: **Secret**)
4. Deploy → آدرس `yt2course.pages.dev` آماده ✅

بک‌اند روی **Cloudflare Functions** اجرا می‌شود (`functions/api/[[route]].js`).

## 🚀 اجرای محلی (Node)

```bash
npm install
cp .env.example .env   # کلید Gemini از https://aistudio.google.com/apikey
npm start              # http://localhost:3001
```

## 📲 نصب روی موبایل

1. آدرس اپ را در کروم موبایل باز کن
2. منو → **Add to Home Screen**
3. مثل یک اپ واقعی تمام‌صفحه اجرا می‌شود

## 🗂 ساختار

```
public/                       → PWA (index.html, app.js, sw.js, manifest)
src/                          → نسخه Node/Express (اجرای محلی)
functions/api/[[route]].js    → بک‌اند Cloudflare Pages (جستجو + Gemini)
wrangler.toml                 → کانفیگ Cloudflare
```

## 🔗 API

| Endpoint | توضیح |
|---|---|
| `GET /health` | سلامت سرور |
| `GET /api/status` | وضعیت اتصال Gemini |
| `GET /api/search?q=` | جستجوی یوتیوب |
| `POST /api/course` | `{topic, links[], lang}` → دوره markdown |

---
ساخته‌شده با 💜 برای [@alirezaiwisi1](https://github.com/alirezaiwisi1)
