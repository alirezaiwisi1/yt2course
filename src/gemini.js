// Gemini client with dynamic model discovery (retired-model-proof)
const BASE = "https://generativelanguage.googleapis.com/v1beta";

let modelCache = null;
async function pickModels(key) {
  if (modelCache) return modelCache;
  const r = await fetch(`${BASE}/models?pageSize=100&key=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error("اعتبارسنجی کلید ناموفق بود");
  const { models = [] } = await r.json();
  const ok = models
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !/embedding|aqa|imagen|veo|tts|image/i.test(n));
  const score = (n) => {
    let s = 0;
    if (/flash/.test(n)) s += 100;
    if (/lite/.test(n)) s -= 20;
    const v = parseFloat((n.match(/(\d+(?:\.\d+)?)/) || [])[1] || "0");
    s += v * 5;
    return s;
  };
  modelCache = ok.sort((a, b) => score(b) - score(a)).slice(0, 4);
  return modelCache;
}

export async function generateCourse({ topic, links, lang = "fa" }, userKey) {
  const key = userKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");

  let context = topic ? `Topic: ${topic}\n` : "";
  if (links?.length) {
    context += `Videos:\n`;
    for (const l of links) context += `- ${l.url} (${l.title || ""})\n`;
  }
  if (!context) throw new Error("Provide a topic or video links");

  const prompt = `You are an expert course creator. Using ONLY the videos/topic below, write a COMPLETE, DETAILED course in ${lang === "fa" ? "Persian (Farsi)" : "English"}.

STRICT REQUIREMENTS:
- This must be a REAL course with actual teaching content, NOT a table of contents or syllabus.
- For EVERY module: write 2-4 full LESSONS.
- Each lesson must contain 3-6 solid PARAGRAPHS of real explanatory teaching text (as if the instructor is explaining the concept in words), covering the key ideas, examples, and practical takeaways from the relevant video.
- End each lesson with: "🎬 ویدیوی این درس:" + the relevant video link(s) in markdown format [title](url).
- Begin each module with a 2-3 sentence warm intro.
- Finish with a "جمع‌بندی" section (2-3 paragraphs) and a short "قدم بعدی تو" action list.

Format in markdown: # course title, ## module, ### lesson.
Do NOT just list bullet points of topics — actually TEACH the material in prose.

${context}`;

  const iaErrors = [];
  // Interactions API on v1beta (verified live) — lite first (highest free quota)
  const iaModels = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.5-flash", "gemini-2.5-flash-lite"];
  for (const m of iaModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ model: m, input: prompt }),
        });
        if (res.ok) {
          const data = await res.json();
          let text = "";
          for (const step of data?.steps || data?.outputs || []) {
            const content = step?.content || [];
            if (step?.type && step.type !== "model_output") continue;
            for (const c of content) if (c?.text) text += c.text;
          }
          if (!text) {
            text = JSON.stringify(data).match(/"text":"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") || "";
          }
          if (text) return text;
          iaErrors.push(`${m}: پاسخ بدون متن — ${JSON.stringify(data).slice(0, 200)}`);
          break;
        }
        const t = await res.text();
        if (res.status === 429)
          throw new Error("سقف رایگان Gemini موقتاً پر شده — چند دقیقه دیگر دوباره امتحان کن ⏳");
        if (res.status === 403 || (res.status === 400 && /api.?key|API_KEY_INVALID/i.test(t)))
          throw new Error("کلید Gemini نامعتبر یا بدون دسترسی است — یک کلید تازه بگیر 🔑");
        if ((res.status === 503 || res.status === 500 || /high demand|overloaded/i.test(t)) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        iaErrors.push(`${m} → HTTP ${res.status}: ${t.slice(0, 250)}`);
        break;
      } catch (e) {
        if (/سقف|کلید/.test(e.message)) throw e;
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 2500)); continue; }
        iaErrors.push(`${m}: ${e.message}`);
        break;
      }
    }
  }

  // FALLBACK: legacy generateContent with discovered + alias models
  const aliases = ["gemini-flash-latest", "gemini-2.5-flash"];
  let discovered = [];
  try { discovered = await pickModels(key); } catch (_) {}
  const models = [...new Set([...aliases, ...discovered])];

  const errors = [...iaErrors];
  for (const m of models) {
    let res;
    try {
      res = await fetch(`${BASE}/${m}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
    } catch (e) {
      errors.push(`${m}: network ${e.message}`);
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "No response";
    }
    const errText = await res.text();
    errors.push(`${m} → HTTP ${res.status}: ${errText.slice(0, 400)}`);
    if (res.status === 429)
      throw new Error("سقف رایگان Gemini موقتاً پر شده — چند دقیقه دیگر دوباره امتحان کن ⏳");
    if (res.status === 403 || res.status === 400) {
      if (/api key|api_key|permission/i.test(errText))
        throw new Error("کلید Gemini نامعتبر یا بدون دسترسی است — یک کلید تازه بگیر 🔑");
    }
  }
  throw new Error("Gemini error:\n" + errors.join("\n").slice(0, 1500));
}
