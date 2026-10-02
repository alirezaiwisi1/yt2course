// Cloudflare Pages Function: /api/* (Workers runtime)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

async function youtubeSearch(q) {
  if (!q.trim()) return [];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const m = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!m) return [];
  const results = [];
  try {
    const data = JSON.parse(m[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents ?? [];
    for (const sec of contents) {
      for (const it of sec?.itemSectionRenderer?.contents ?? []) {
        const v = it?.videoRenderer;
        if (!v) continue;
        results.push({
          id: v.videoId,
          title: v.title?.runs?.[0]?.text ?? "",
          channel: v.ownerText?.runs?.[0]?.text ?? "",
          thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url ?? "",
          duration: v.lengthText?.simpleText ?? "",
        });
      }
    }
  } catch (_) {}
  return results.slice(0, 12);
}

async function generateCourse({ topic, links, lang = "fa" }, apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  let context = topic ? `Topic: ${topic}\n` : "";
  if (links?.length)
    context += "Videos:\n" + links.map((l) => `- ${l.url} (${l.title || ""})`).join("\n") + "\n";
  if (!context) throw new Error("Provide a topic or video links");

  const prompt = `You are an expert course designer. Using ONLY the videos/topic below, create a step-by-step course in ${lang === "fa" ? "Persian (Farsi)" : "English"}.
Return markdown with:
1. Course title
2. Short description
3. Numbered modules (each with: title, 3-5 bullet learnings, and the relevant video link(s))
4. Estimated total duration
Make it practical and beginner-friendly.

${context}`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Gemini error: " + err.slice(0, 200));
  }
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
    "No response"
  );
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const route = url.pathname;

  if (route === "/api/status")
    return json({ ok: true, gemini: !!env.GEMINI_API_KEY, runtime: "cloudflare" });

  if (route === "/api/search") {
    try {
      return json({ results: await youtubeSearch(url.searchParams.get("q") || "") });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (route === "/api/course" && request.method === "POST") {
    try {
      const { topic, links, lang } = await request.json();
      const course = await generateCourse({ topic, links, lang }, env.GEMINI_API_KEY);
      return json({ course });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}
