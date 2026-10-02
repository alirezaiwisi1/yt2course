/* YT2Course — mobile PWA logic */
const $ = (s) => document.querySelector(s);
const state = { mode: "auto", selected: [], searching: false };

/* ---------- helpers ---------- */
function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast on" + (err ? " err" : "");
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = "toast"), 2600);
}
const vid = (s) => (String(s).match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/) || [])[1];
const show = (id) => {
  ["view-home", "view-load", "view-course"].forEach(
    (v) => (document.getElementById(v).style.display = v === id ? "" : "none")
  );
};

/* ---------- status ---------- */
const getKey = () => localStorage.getItem("y2c_key") || "";
let serverGemini = false;
fetch("/api/status")
  .then((r) => r.json())
  .then((s) => {
    serverGemini = !!s.gemini;
    refreshChip();
  })
  .catch(() => ($("#aiChip").textContent = "آفلاین"));

function refreshChip() {
  const chip = $("#aiChip");
  if (getKey()) {
    chip.textContent = "AI: کلید شخصی 🔑";
    chip.className = "chip on";
  } else if (serverGemini) {
    chip.textContent = "AI: متصل ✅";
    chip.className = "chip on";
  } else {
    chip.textContent = "AI: کلید بده 🔑";
    chip.className = "chip";
  }
}

/* click chip = open key modal */
$("#aiChip").addEventListener("click", () => {
  $("#keyInput").value = getKey();
  $("#keyModal").style.display = "flex";
  setTimeout(() => $("#keyInput").focus(), 50);
});
$("#keyClose").addEventListener("click", () => ($("#keyModal").style.display = "none"));
$("#keyModal").addEventListener("click", (e) => {
  if (e.target.id === "keyModal") $("#keyModal").style.display = "none";
});
$("#keySave").addEventListener("click", saveKey);
$("#keyInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveKey();
});
async function saveKey() {
  const k = $("#keyInput").value.trim();
  if (!k) return toast("کلید را وارد کن", true);
  toast("در حال بررسی کلید…");
  try {
    const r = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k }),
    });
    const { valid } = await r.json();
    if (!valid) return toast("کلید نامعتبر است ❌", true);
    localStorage.setItem("y2c_key", k);
    refreshChip();
    $("#keyModal").style.display = "none";
    toast("کلید ذخیره شد 🎉");
  } catch {
    toast("خطا در بررسی کلید", true);
  }
}
$("#keyRemove").addEventListener("click", () => {
  localStorage.removeItem("y2c_key");
  refreshChip();
  $("#keyModal").style.display = "none";
  toast("کلید حذف شد");
});

/* ---------- tabs ---------- */
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.mode = b.dataset.mode;
    const auto = state.mode === "auto";
    $("#linksCard").style.display = auto ? "none" : "";
    $("#notebookBtn").style.display = auto ? "none" : "";
    $("#goBtn").style.display = auto ? "" : "none";
  })
);

/* ---------- search (debounced) ---------- */
let deb;
$("#q").addEventListener("input", () => {
  clearTimeout(deb);
  deb = setTimeout(searchYT, 550);
});

async function searchYT() {
  const q = $("#q").value.trim();
  if (q.length < 3) return;
  $("#results").innerHTML = `<p style="color:var(--dim);font-size:12px;text-align:center;padding:10px">🔍 در حال جستجو…</p>`;
  try {
    const isPl = /list=|^(PL|OL|UU|FL|LL|RD)[\w-]{10,}$/.test(q);
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const { results, playlist } = await r.json();
    if (!results?.length) throw 0;
    const header = playlist
      ? `<div class="vitem" data-selectall="1"><div style="font-size:12px;font-weight:800;color:var(--neon3)">📂 پلی‌لیست — ${results.length} ویدیو (کلیک = انتخاب همه)</div></div>`
      : "";
    $("#results").innerHTML = header + results
      .map(
        (v) => `
      <div class="vitem" data-id="${v.id}" data-title="${v.title.replace(/"/g, "&quot;")}"
           data-url="https://www.youtube.com/watch?v=${v.id}">
        <img src="${v.thumb}" alt="" loading="lazy">
        <div><div class="vt">${v.title}</div>
        <div class="vc">${v.channel}${v.duration ? " • " + v.duration : ""}</div></div>
        <div class="tick">✓</div>
      </div>`
      )
      .join("");
  } catch {
    $("#results").innerHTML = `<p style="color:var(--dim);font-size:12px;text-align:center;padding:10px">چیزی پیدا نشد 😕</p>`;
  }
}

/* ---------- selection ---------- */
$("#results").addEventListener("click", (e) => {
  const it = e.target.closest(".vitem");
  if (!it) return;
  // select-all toggle when clicking a playlist header
  if (it.dataset.selectall === "1") {
    const items = [...document.querySelectorAll(".vitem[data-id]")];
    const turnOn = state.selected.length < items.length;
    state.selected = turnOn
      ? items.map((x) => ({ id: x.dataset.id, url: x.dataset.url, title: x.dataset.title }))
      : [];
    items.forEach((x) => x.classList.toggle("sel", turnOn));
    updateCount();
    return;
  }
  const id = it.dataset.id;
  const i = state.selected.findIndex((s) => s.id === id);
  if (i >= 0) state.selected.splice(i, 1);
  else state.selected.push({ id, url: it.dataset.url, title: it.dataset.title });
  it.classList.toggle("sel");
  updateCount();
});

function updateCount() {
  $("#selCount").textContent = state.selected.length ? `✓ ${state.selected.length} ویدیو انتخاب شد` : "";
}

/* ---------- generate course ---------- */
$("#goBtn").addEventListener("click", async () => {
  const topic = $("#q").value.trim();
  if (!topic && !state.selected.length) return toast("موضوع یا ویدیو انتخاب کن", true);
  show("view-load");
  try {
    const r = await fetch("/api/course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        links: state.selected.map((s) => ({ url: s.url, title: s.title })),
        lang: "fa",
        userKey: getKey(),
      }),
    });
    const { course, error } = await r.json();
    if (error) throw new Error(error);
    $("#courseOut").innerHTML = marked.parse(course);
    saveCourse({ title: topic || state.selected[0]?.title || "دوره", body: course, date: Date.now() });
    show("view-course");
  } catch (e) {
    show("view-home");
    toast(
      e.message === "NO_KEY"
        ? "اول کلید Gemini بده — روی «AI: کلید بده 🔑» بالا بزن"
        : e.message,
      true
    );
  }
});

/* ---------- NotebookLM bridge ---------- */
$("#notebookBtn").addEventListener("click", () => {
  const links = $("#links").value.trim();
  if (!links) return toast("حداقل یک لینک ویدیو وارد کن", true);
  const urls = links.split("\n").map((l) => l.trim()).filter((l) => vid(l) || /list=|^(PL|OL|UU|FL|LL|RD)[\w-]{10,}$/.test(l));
  if (!urls.length) return toast("لینک معتبر یوتیوب یا پلی‌لیست پیدا نشد", true);
  const plUrls = urls.filter((u) => /list=|^(PL|OL|UU|FL|LL|RD)/.test(u) && !vid(u));
  const prompt = `با استفاده از این ویدیوها${plUrls.length ? " و پلی‌لیست‌ها (تمام ویدیوهای داخل هر پلی‌لیست را هم بررسی کن)" : ""}، یک دوره آموزشی مرحله‌به‌مرحله به همراه لینک ویدیوی مرتبط برای من بساز:\n\n${urls.join("\n")}`;
  saveCourse({ title: "پل NotebookLM", body: prompt, date: Date.now(), bridge: true });
  navigator.clipboard
    ? navigator.clipboard.writeText(prompt).then(
        () => toast("پرامپت کپی شد! در NotebookLM پیست کن 📋"),
        () => toast("پرامپت در «دوره‌های من» ذخیره شد")
      )
    : toast("پرامپت ذخیره شد");
  setTimeout(() => window.open("https://notebooklm.google.com", "_blank"), 900);
});

/* ---------- storage ---------- */
const getCourses = () => JSON.parse(localStorage.getItem("y2c_courses") || "[]");
function saveCourse(c) {
  const all = getCourses();
  all.unshift(c);
  localStorage.setItem("y2c_courses", JSON.stringify(all.slice(0, 30)));
}

/* ---------- bottom nav ---------- */
document.querySelectorAll("nav.bottom button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll("nav.bottom button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const nav = b.dataset.nav;
    if (nav === "home") show("view-home");
    else if (nav === "saved") renderSaved();
    else about();
  })
);

function renderSaved() {
  const all = getCourses();
  show("view-course");
  $("#courseOut").innerHTML = all.length
    ? `<h2>📚 دوره‌های من</h2>` +
      all
        .map(
          (c, i) =>
            `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
             <b>${c.bridge ? "🪄 " : "🎬 "}${c.title}</b>
             <div style="font-size:11px;color:var(--dim)">${new Date(c.date).toLocaleString("fa-IR")}</div>
             <div style="font-size:12.5px;color:var(--dim);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.body.slice(0, 80)}</div>
             <button class="cta ghost" style="margin-top:8px;padding:9px;font-size:12px" onclick="openSaved(${i})">مشاهده</button></div>`
        )
        .join("")
    : `<h2>📚 دوره‌های من</h2><p style="color:var(--dim)">هنوز دوره‌ای نساختی!</p>`;
}
window.openSaved = (i) => {
  const c = getCourses()[i];
  $("#courseOut").innerHTML = marked.parse(c.body);
  show("view-course");
};
function about() {
  show("view-course");
  $("#courseOut").innerHTML = marked.parse(
    `# ⚡ YT2Course\nاز یوتیوب دوره بساز — مستقیم روی گوشی.\n\n- **حالت خودکار:** موضوع بده، AI ترنسکریپت ویدیوها را می‌خواند و دوره مرحله‌به‌مرحله می‌سازد.\n- **حالت پل:** لینک‌ها را بده، پرامپت آماده را در NotebookLM پیست کن.\n\nساخته‌شده با 💜 برای [alirezaiwisi1](https://github.com/alirezaiwisi1)`
  );
}

/* ---------- copy / back ---------- */
$("#copyBtn").addEventListener("click", () => {
  navigator.clipboard.writeText($("#courseOut").innerText).then(() => toast("کپی شد ✅"));
});
$("#backBtn").addEventListener("click", () => show("view-home"));

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
