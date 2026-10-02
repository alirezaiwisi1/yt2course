import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", routes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "yt2course" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ yt2course running on http://localhost:${PORT}`));
