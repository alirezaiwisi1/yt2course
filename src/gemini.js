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

  const models = await pickModels(key);
  if (!models.length) throw new Error("کلید هیچ مدل Gemini قابل استفاده‌ای ندارد");

  let lastErr = "";
  for (const m of models) {
    const res = await fetch(`${BASE}/${m}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "No response";
    }
    lastErr = (await res.text()).slice(0, 200);
    if (res.status === 429) break;
  }
  throw new Error("Gemini error: " + lastErr);
}
