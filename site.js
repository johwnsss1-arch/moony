const REPO = "johwnsss1-arch/moony";
const DISCORD = "https://discord.gg/moonylauncher";

document.querySelectorAll("[data-discord]").forEach((a) => { a.href = DISCORD; a.target = "_blank"; a.rel = "noopener"; });
document.querySelectorAll("[data-download]").forEach((a) => (a.href = `https://github.com/${REPO}/releases/latest`));
document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));

const nav = document.querySelector(".nav");
const menu = document.querySelector(".menu-btn");
menu?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menu.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
});
const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const fill = (sel, text) => document.querySelectorAll(sel).forEach((e) => (e.textContent = text));

fetch(`https://api.github.com/repos/${REPO}/releases/latest`).then((r) => (r.ok ? r.json() : null)).then((rel) => {
  if (!rel) throw 0;
  const exe = rel.assets?.find((a) => /\.exe$/i.test(a.name));
  if (exe) {
    document.querySelectorAll("[data-download]").forEach((a) => (a.href = exe.browser_download_url));
    fill("[data-size]", mb(exe.size));
    const sha = (exe.digest || "").replace(/^sha256:/, "");
    if (sha) {
      fill("[data-sha]", sha);
      document.querySelectorAll("[data-vt]").forEach((a) => (a.href = "https://www.virustotal.com/gui/file/" + sha));
    }
  }
  fill("[data-version]", rel.tag_name.replace(/^v/, ""));
  fill("[data-date]", new Date(rel.published_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }));
}).catch(() => fill("[data-sha]", "Shown on the GitHub release page"));

if (document.querySelector("[data-dls]")) {
  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`).then((r) => (r.ok ? r.json() : null)).then((list) => {
    if (!Array.isArray(list)) return;
    const n = list.reduce((t, rel) => t + (rel.assets || []).filter((a) => /\.exe$/i.test(a.name)).reduce((x, a) => x + a.download_count, 0), 0);
    fill("[data-dls]", n.toLocaleString());
    if (n >= 500) document.querySelectorAll("[data-dl-wrap]").forEach((e) => (e.hidden = false));
    fill("[data-releases]", list.length);
  }).catch(() => {});
}

const releasesEl = document.querySelector("[data-releases-list]");
if (releasesEl) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const md = (src) => {
    const out = []; let list = false;
    for (const raw of (src || "").split(/\r?\n/)) {
      const line = raw.trim();
      const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
      if (/^[-*] /.test(line)) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
      if (list) { out.push("</ul>"); list = false; }
      if (!line) continue;
      if (/^#{1,6} /.test(line)) out.push(`<h3>${inline(line.replace(/^#+ /, ""))}</h3>`);
      else out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  };
  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`).then((r) => (r.ok ? r.json() : Promise.reject())).then((list) => {
    releasesEl.innerHTML = list.filter((r) => !r.draft).map((r) => {
      const exe = r.assets?.find((a) => /\.exe$/i.test(a.name));
      return `<article class="release"><div><h2>${esc(r.tag_name.replace(/^v/, ""))}</h2><time datetime="${r.published_at}">${new Date(r.published_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</time></div>
        <div class="body">${md(r.body) || "<p>No notes for this release.</p>"}${exe ? `<p class="assets"><a href="${exe.browser_download_url}">${esc(exe.name)}</a> · ${mb(exe.size)}</p>` : ""}</div></article>`;
    }).join("");
  }).catch(() => { releasesEl.innerHTML = `<p class="lede">Couldn't load the release list right now. See every release on <a style="color:var(--moon)" href="https://github.com/${REPO}/releases">GitHub</a>.</p>`; });
}

const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const pick = (t, focus) => {
  tabs.forEach((b) => {
    const on = b === t;
    b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
    const p = document.getElementById(b.getAttribute("aria-controls"));
    p.hidden = !on; p.classList.toggle("on", on);
  });
  if (focus) t.focus();
};
tabs.forEach((t, i) => {
  t.addEventListener("click", () => pick(t));
  t.addEventListener("keydown", (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true); }
    if (e.key === "Home") { e.preventDefault(); pick(tabs[0], true); }
    if (e.key === "End") { e.preventDefault(); pick(tabs[tabs.length - 1], true); }
  });
});

// Hero demo: the screenshot is clickable like the real sidebar.
const demo = document.querySelector("[data-demo]");
if (demo) {
  const im = demo.querySelector("[data-demo-img]"), toast = demo.querySelector("[data-demo-toast]");
  const SRC = { home: "img/v41/home.webp", discover: "img/v41/discover.webp", charts: "img/v41/charts.webp", servers: "img/v41/servers.webp", settings: "img/v41/settings.webp" };
  const SAY = { home: "Home: your next game, friends and Boost", discover: "Discover: search, genres and hidden gems", charts: "Charts: what everyone's playing", servers: "Servers: ping, players and Fast join", settings: "Settings: themes, FPS cap and launch options" };
  let cur = "home", t;
  Object.values(SRC).forEach((u) => { const p = new Image(); p.src = u; });
  demo.addEventListener("click", (e) => {
    const b = e.target.closest(".hot"); if (!b) return;
    const v = b.dataset.view; toast.textContent = SAY[v]; toast.hidden = false;
    clearTimeout(t); t = setTimeout(() => (toast.hidden = true), 2600);
    if (v === cur) return; cur = v;
    im.classList.add("swap");
    setTimeout(() => { im.src = SRC[v]; im.alt = SAY[v]; im.classList.remove("swap"); }, 140);
    demo.querySelectorAll(".hot").forEach((h) => h.classList.toggle("on", h.dataset.view === v && h.getAttribute("aria-label") !== "Show Pick a server"));
  });
}
