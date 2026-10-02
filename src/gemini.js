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

  const prompt = `You are an expert course designer. Using ONLY the videos/topic below, create a step-by-step course in ${lang === "fa" ? "Persian (Farsi)" : "English"}.
Return markdown with:
1. Course title
2. Short description
3. Numbered modules (each with: title, 3-5 bullet learnings, and the relevant video link(s))
4. Estimated total duration
Make it practical and beginner-friendly.

${context}`;

  const iaErrors = [];
  // NEW: Interactions API (Google's current GA endpoint) first
  const iaModels = ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.5-flash"];
  for (const m of iaModels) {
    try {
      const res = await fetch(`${BASE}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ model: m, input: prompt }),
      });
      if (res.ok) {
        const data = await res.json();
        const outs = data?.outputs || [];
        const text = [...outs].reverse().find((o) => o.text)?.text;
        if (text) return text;
      } else {
        const t = await res.text();
        if (res.status === 429)
          throw new Error("سقف رایگان Gemini موقتاً پر شده — چند دقیقه دیگر دوباره امتحان کن ⏳");
        if (res.status === 403 || (res.status === 400 && /api.?key|permission/i.test(t)))
          throw new Error("کلید Gemini نامعتبر یا بدون دسترسی است — یک کلید تازه بگیر 🔑");
        iaErrors.push(`${m} → HTTP ${res.status}: ${t.slice(0, 300)}`);
      }
    } catch (e) {
      if (/سقف|کلید/.test(e.message)) throw e;
      iaErrors.push(`${m}: ${e.message}`);
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
