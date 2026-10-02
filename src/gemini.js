import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateCourse({ topic, links, lang = "fa" }, userKey) {
  const key = userKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const res = await model.generateContent(prompt);
  return res.response.text();
}
