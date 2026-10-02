# ⚡ YT2Course — دوره‌ساز هوشمند یوتیوب

از یوتیوب **دوره آموزشی مرحله‌به‌مرحله** بساز — مستقیم روی موبایل، بدون افزونه.

## ✨ امکانات

- 🤖 **حالت خودکار با AI (Gemini):** موضوع را جستجو کن، ویدیوها را انتخاب کن؛ اپ ترنسکریپت ویدیوها را می‌خواند و یک دوره ساختاریافته با لینک هر بخش تولید می‌کند.
- 🪄 **حالت پل NotebookLM:** لینک ویدیوها را بده، پرامپت آماده ساخته و کپی می‌شود — یک کلیک تا NotebookLM.
- 📱 **PWA موبایلی:** روی گوشی نصب می‌شود (Add to Home Screen)، تم تیره نئونی، فارسی RTL، آفلاین قابل باز شدن.
- 📚 ذخیره دوره‌ها در «دوره‌های من» (localStorage).

## 🚀 اجرا

```bash
npm install
cp .env.example .env   # کلید Gemini را در .env بگذار (https://aistudio.google.com/apikey — رایگان)
npm start              # http://localhost:3001
```

> بدون کلید Gemini هم اپ اجرا می‌شود — فقط حالت پل NotebookLM فعال است.

## 📲 نصب روی موبایل

1. آدرس اپ را در کروم موبایل باز کن
2. منو → **Add to Home Screen**
3. مثل یک اپ واقعی تمام‌صفحه اجرا می‌شود

## 🗂 ساختار

```
public/        → PWA (index.html, app.js, sw.js, manifest)
src/server.js  → Express
src/routes/    → /api/search (جستجوی یوتیوب), /api/course (تولید دوره)
src/gemini.js  → کلاینت Gemini
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
