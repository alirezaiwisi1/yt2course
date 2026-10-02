import { Router } from "express";
import { youtubeSearch, extractPlaylistId, playlistVideos } from "./youtube.js";
import { generateCourse } from "../gemini.js";

const router = Router();

router.get("/status", (_req, res) =>
  res.json({ ok: true, gemini: !!process.env.GEMINI_API_KEY })
);

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const pl = extractPlaylistId(q);
    if (pl) {
      const videos = await playlistVideos(pl);
      if (videos.length) return res.json({ results: videos, playlist: true });
    }
    const results = await youtubeSearch(q);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/course", async (req, res) => {
  try {
    const { topic, lang = "fa" } = req.body;
    // expand playlist links into their videos
    const expanded = [];
    for (const l of req.body.links || []) {
      const pl = extractPlaylistId(l.url || l);
      if (pl && !l.url?.includes("v=")) {
        const vids = await playlistVideos(pl);
        expanded.push(...vids.map((v) => ({ url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title })));
      } else expanded.push(l);
    }
    const course = await generateCourse({ topic, links: expanded, lang });
    res.json({ course });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
