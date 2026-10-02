// YouTube helpers: search (public scrape) + transcript extraction
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

export async function youtubeSearch(q) {
  if (!q.trim()) return [];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const m = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!m) return [];
  const results = [];
  try {
    const contents =
      m[1].matchRenderer?.contents ??
      JSON.parse(m[1])?.contents?.twoColumnSearchResultsRenderer
        ?.primaryContents?.sectionListRenderer?.contents ?? [];
    for (const sec of contents) {
      const items = sec?.itemSectionRenderer?.contents ?? [];
      for (const it of items) {
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

export function extractVideoId(link) {
  const m = String(link).match(
    /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/
  );
  return m ? m[1] : (/^[\w-]{11}$/.test(link.trim()) ? link.trim() : null);
}

export async function getTranscript(videoId) {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const parts = await YoutubeTranscript.fetchTranscript(videoId);
    return parts.map((p) => p.text).join(" ").slice(0, 12000);
  } catch (e) {
    return null;
  }
}
