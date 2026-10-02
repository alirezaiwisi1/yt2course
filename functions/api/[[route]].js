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

function extractPlaylistId(link) {
  const m = String(link).match(/[?&]list=([\w-]+)/);
  return m ? m[1] : (/^(PL|OL|UU|FL|LL|RD)[\w-]{10,}$/.test(link.trim()) ? link.trim() : null);
}

// Playlist page uses new lockupViewModel format
async function playlistVideos(listId) {
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
  const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const m = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!m) return [];
  let d;
  try { d = JSON.parse(m[1]); } catch { return []; }
  const lvs = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (o.lockupViewModel) lvs.push(o.lockupViewModel);
      for (const v of Object.values(o)) walk(v);
    }
  })(d);
  return lvs
    .map((lv) => ({
      id: lv.contentId,
      title: lv?.metadata?.lockupMetadataViewModel?.title?.content ?? "",
      channel: "",
      thumb: `https://i.ytimg.com/vi/${lv.contentId}/mqdefault.jpg`,
      duration: "",
    }))
    .filter((v) => v.id && /^[\w-]{11}$/.test(v.id))
    .slice(0, 30);
}

async function generateCourse({ topic, links, lang = "fa" }, apiKey) {
  if (!apiKey) throw new Error("NO_KEY");
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

  // Discover which models this key can actually use (avoids retired-model 404s)
  const models = await pickModels(apiKey);
  if (!models.length) throw new Error("کلید هیچ مدل Gemini قابل استفاده‌ای ندارد");

  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  let lastErr = "";
  for (const m of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${m}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
    if (res.ok) {
      const data = await res.json();
      return (
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "No response"
      );
    }
    lastErr = (await res.text()).slice(0, 200);
    // 429 = rate limit on a good model: stop trying others
    if (res.status === 429) break;
  }
  throw new Error("Gemini error: " + lastErr);
}

// Query ListModels and return generateContent-capable model ids, best first
let modelCache = null;
async function pickModels(apiKey) {
  if (modelCache) return modelCache;
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=" +
      encodeURIComponent(apiKey)
  );
  if (!r.ok) throw new Error("اعتبارسنجی کلید ناموفق بود");
  const { models = [] } = await r.json();
  const ok = models
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !/embedding|aqa|imagen|veo|tts|image/i.test(n));
  // prefer flash (fast+cheap), then newest version numbers
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

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const route = url.pathname;

  if (route === "/api/status")
    return json({ ok: true, gemini: !!env.GEMINI_API_KEY, runtime: "cloudflare" });

  if (route === "/api/validate-key" && request.method === "POST") {
    try {
      const { key } = await request.json();
      if (!key) return json({ valid: false });
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key)
      );
      return json({ valid: r.ok });
    } catch {
      return json({ valid: false });
    }
  }

  if (route === "/api/search") {
    try {
      const q = url.searchParams.get("q") || "";
      const pl = extractPlaylistId(q);
      if (pl) {
        const videos = await playlistVideos(pl);
        if (videos.length) return json({ results: videos, playlist: true });
      }
      return json({ results: await youtubeSearch(q) });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (route === "/api/course" && request.method === "POST") {
    try {
      const { topic, links, lang, userKey } = await request.json();
      // user-provided key takes priority; else server secret
      const key = userKey || env.GEMINI_API_KEY;
      const expanded = [];
      for (const l of links || []) {
        const pl = extractPlaylistId(l.url || l);
        if (pl && !l.url?.includes("v=")) {
          const vids = await playlistVideos(pl);
          expanded.push(...vids.map((v) => ({ url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title })));
        } else expanded.push(l);
      }
      const course = await generateCourse({ topic, links: expanded }, key);
      return json({ course });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}
