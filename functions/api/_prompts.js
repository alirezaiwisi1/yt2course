// Extra output generators (NotebookLM-style artifacts), all transcript-grounded.
const RULES = `ABSOLUTE RULES:
- Use ONLY the information in the SOURCES below. Do NOT add outside knowledge, do NOT invent, do NOT omit any major point from the sources.`;

// NotebookLM "Briefing Doc"
export function briefingPrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create a professional briefing document in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

Structure:
1. **عنوان و خلاصه اجرایی** (۵-۶ جمله)
2. **نکات کلیدی** (۱۰-۱۵ نکته، هرکدام ۲-۳ جمله توضیح واقعی نه لیست خشک)
3. **موضوعات با جزئیات** (۳-۵ بخش با پاراگراف‌های توضیحی)
4. **جمله‌های کلیدی/نقل‌قول‌های مهم** از منابع
5. **سوالات باز / نکات مبهم** (اگر در منابع هست)

SOURCES:
${sources}`;
}

// NotebookLM "Study Guide"
export function studyGuidePrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create a complete study guide in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

Structure:
1. **مفاهیم کلیدی** — هر مفهوم با تعریف ۲-۴ جمله‌ای واقعی از منابع
2. **راهنمای مطالعه کوتاه‌مدت** (امتحان فردا): ۱۰ نکته حیاتی
3. **سوالات احتمالی امتحان** با پاسخ مدل کامل (۸ سوال)
4. **گلچین اصطلاحات** — جدول: اصطلاح | تعریف از منبع

SOURCES:
${sources}`;
}

// NotebookLM FAQ
export function faqPrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create an FAQ in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

- ۱۲ سوال پرتکراری که یک مخاطب واقعی می‌پرسد
- هر جواب ۳-۵ جمله کامل و آموزنده (نه یک خط)
- سوال‌ها از ساده به عمیق مرتب شوند

SOURCES:
${sources}`;
}

// NotebookLM Timeline
export function timelinePrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create a timeline / step-by-step progression in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

- رویدادها، مراحل یا مفاهیم را به ترتیب منطقی/زمانی مرتب کن
- برای هر آیتم: عنوان کوتاه + ۲-۴ جمله توضیح + اینکه در کدام منبع آمده
- اگر منابع ترتیب زمانی ندارند، یک «مسیر یادگیری» مرحله‌به‌مرحله بساز

SOURCES:
${sources}`;
}

// NotebookLM Quiz
export function quizPrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create a quiz in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

- ۱۵ سوال چهارگزینه‌ای در ۳ سطح:
  - سطح ۱ (سوال ۱-۵): یادآوری مستقیم مفاهیم
  - سطح ۲ (سوال ۶-۱۰): درک و ارتباط مفاهیم
  - سطح ۳ (سوال ۱۱-۱۵): تحلیل و کاربرد
- فرمت دقیق هر سوال:
  **سوال N:** متن سوال
  - الف) ...
  - ب) ...
  - ج) ...
  - د) ...
  ✅ **پاسخ:** گزینه درست + توضیح ۲-۳ جمله‌ای چرا درست است (با ارجاع به منبع)

SOURCES:
${sources}`;
}

// NotebookLM Flashcards
export function flashcardsPrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create flashcards in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

- ۲۰ فلش‌کارت با فرمت دقیق زیر (برای تبدیل خودکار به کارت):
  ### کارت N
  **پرسش:** ...
  **پاسخ:** ... (۱-۳ جمله دقیق از منبع)
- از ساده به دشوار مرتب شوند

SOURCES:
${sources}`;
}

// NotebookLM Mind Map (structured markdown outline)
export function mindMapPrompt(sources, lang = "fa") {
  const L = lang === "fa";
  return `Create a mind map outline in ${L ? "Persian (Farsi)" : "English"} based ONLY on the sources below.

${RULES}

- ساختار درختی با markdown:
  # موضوع مرکزی
  ## شاخه اصلی ۱ (۵-۷ شاخه اصلی)
  ### زیرشاخه
  - نکته (هر نکته یک جمله کوتاه دقیق از منبع)
- هر شاخه اصلی حداکثر ۴ زیرشاخه، هر زیرشاخه ۳-۵ نکته
- کل جزئیات مهم منابع باید در نقشه بیاید

SOURCES:
${sources}`;
}
