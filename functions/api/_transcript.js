// Transcript extraction for Cloudflare Workers (no libs).
// Technique: watch-page scrape -> ytInitialPlayerResponse -> captionTracks -> timedtext XML.
const UA_WEB =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";

function parseInlineJson(html, globalName) {
  const startToken = `var ${globalName} = `;
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) return null;
  const jsonStart = startIndex + startToken.length;
  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

/**
 * Fetch transcript text for a video. Returns { text, lang } or null when unavailable.
 * Tries: manual tracks first, then auto-generated (ASR).
 */
export async function fetchTranscript(videoId, langPref = ["en", "fa"]) {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&bpctr=9999999999`, {
      headers: { "User-Agent": UA_WEB, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!page.ok) return null;
    const html = await page.text();
    if (html.includes('class="g-recaptcha"')) return null; // rate-limited
    const player = parseInlineJson(html, "ytInitialPlayerResponse");
    const tracks =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) return null;

    // prefer preferred languages, manual before ASR
    const score = (t) => {
      let s = 0;
      const idx = langPref.indexOf(t.languageCode);
      if (idx >= 0) s += 100 - idx;
      if (!t.kind) s += 20; // manual
      return s;
    };
    const track = [...tracks].sort((a, b) => score(b) - score(a))[0];
    const url = track.baseUrl.replace(/\\u0026/g, "&");
    const res = await fetch(url, { headers: { "User-Agent": UA_WEB } });
    if (!res.ok) return null;
    const xml = await res.text();
    const parts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\n/g, " ")
    );
    if (!parts.length) return null;
    return { text: parts.join(" ").slice(0, 15000), lang: track.languageCode };
  } catch {
    return null;
  }
}
