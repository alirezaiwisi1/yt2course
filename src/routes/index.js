import { Router } from "express";
import { youtubeSearch } from "./youtube.js";
import { generateCourse } from "../gemini.js";

const router = Router();

router.get("/status", (_req, res) =>
  res.json({ ok: true, gemini: !!process.env.GEMINI_API_KEY })
);

router.get("/search", async (req, res) => {
  try {
    const results = await youtubeSearch(req.query.q || "");
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/course", async (req, res) => {
  try {
    const { topic, links, lang = "fa" } = req.body;
    const course = await generateCourse({ topic, links, lang });
    res.json({ course });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
