// KALYPSO site: the live window, downloads from the latest release, and small touches.
// Everything works without the GitHub API; it only fills in real files and stars when it can.

const REPO = "kalyppso/kalypso";
document.documentElement.classList.add("js");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- The live window ---------- */

// Click around: each sidebar item shows its panel.
$$(".ws-nav button").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".ws-nav button").forEach((x) => x.classList.toggle("on", x === b));
    $$(".panel").forEach((p) => p.classList.toggle("on", p.dataset.panel === b.dataset.panel));
  }),
);

// The shape of a real run, as the Claude Agent SDK runtime writes it to the transcript.
const DEMO = [
  ["status", "started · claude-sonnet-5-5 · 22 tools", 500],
  ["text", "I'll run the tests first to see what fails.", 900],
  ["tool", "Bash|npm test", 700, 0.012],
  ["output", "23 passing, 1 failing: parses an empty config file", 900],
  ["tool", "Read|src/config.ts", 600, 0.018],
  ["tool", "Edit|src/config.ts", 900, 0.027],
  ["tool", "Bash|npm test", 700, 0.012],
  ["output", "24 passing", 900],
  ["tool", "Bash|git push --force origin main", 800, 0.009],
  ["policy", 'Blocked by policy <b>"No force-push to main"</b>. The command never ran.', 1500, 0, true],
  ["text", "Force-pushing to main isn't allowed here. I'll push a branch and open a pull request instead.", 1000, 0.015],
  ["tool", "Bash|git push origin fix/empty-config", 800, 0.009],
  ["tool", "Bash|gh pr create --fill", 900, 0.012],
  ["output", "https://github.com/acme/app/pull/482", 700],
  ["result", "Done · 9 turns · $0.042", 4500],
];

(function demo() {
  const log = $("#demo-log");
  if (!log) return;
  const status = $("#demo-status");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let i = 0, spend = 0.84, blocked = 0, timer = null, visible = false;
  const meters = () => {
    $("#demo-spend").textContent = `$${spend.toFixed(2)}`;
    $("#demo-meter").style.width = `${Math.min(100, (spend / 5) * 100)}%`;
    $("#demo-blocked-row").textContent = `${blocked} today`;
  };
  const line = ([kind, text], animate = true) => {
    const li = document.createElement("li");
    li.className = `k-${kind}${animate ? " new" : ""}`;
    if (kind === "tool") { const [tool, arg] = text.split("|"); li.innerHTML = `<b>${tool}</b>${esc(arg)}`; }
    else if (kind === "policy") li.innerHTML = text;
    else li.textContent = text;
    log.append(li);
    while (log.children.length > 24) log.firstElementChild.remove();
  };
  const apply = (s) => {
    spend += s[3] || 0;
    if (s[4]) blocked += 1;
    if (s[0] === "result") { status.classList.add("done"); status.lastChild.textContent = "Waiting for a message"; }
    meters();
  };
  const reset = () => {
    log.replaceChildren(); i = 0; spend = 0.84; blocked = 0;
    status.classList.remove("done"); status.lastChild.textContent = "Running"; meters();
  };
  const step = () => {
    timer = null;
    if (!visible) return;
    if (i >= DEMO.length) { reset(); timer = setTimeout(step, 600); return; }
    const s = DEMO[i++];
    line(s); apply(s);
    timer = setTimeout(step, s[2]);
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    DEMO.forEach((s) => { line(s, false); apply(s); });
    return;
  }
  meters();
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !timer) timer = setTimeout(step, 400);
  }).observe($(".stage"));
})();

/* ---------- Downloads ---------- */

const PICK = {
  exe: (n) => /\.exe$/i.test(n),
  msi: (n) => /\.msi$/i.test(n),
  dmg: (n) => /\.dmg$/i.test(n),
  appimage: (n) => /\.appimage$/i.test(n),
  deb: (n) => /\.deb$/i.test(n),
  rpm: (n) => /\.rpm$/i.test(n),
};
const MAIN = { windows: "exe", mac: "dmg", linux: "appimage" };
const NAME = { windows: "Windows", mac: "macOS", linux: "Linux" };
const macArch = (name) => (/universal/i.test(name) ? "Apple silicon and Intel" : /aarch64|arm64/i.test(name) ? "Apple silicon" : /x64|x86_64/i.test(name) ? "Intel" : "");

function platform() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return null;
}

async function latestRelease() {
  // The list includes pre-releases, which /releases/latest skips; 0.x builds are pre-releases.
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).find((r) => !r.draft && r.assets.length) ?? null;
}

(async () => {
  const os = platform();
  if (os) {
    $(`.oses li[data-os="${os}"]`)?.classList.add("mine");
    $("#hero-label").textContent = `Download for ${NAME[os]}`;
  }
  let release = null;
  try { release = await latestRelease(); } catch { /* offline or rate-limited: links stay on the releases page */ }
  if (!release) return;
  for (const a of $$(".oses a[data-asset]")) {
    const asset = release.assets.find((x) => PICK[a.dataset.asset](x.name));
    if (asset) { a.href = asset.browser_download_url; a.title = asset.name; } else a.hidden = true;
  }
  const dmg = release.assets.find((x) => PICK.dmg(x.name));
  if (dmg && macArch(dmg.name)) $("#mac-arch").textContent = macArch(dmg.name);
  const mine = os && release.assets.find((x) => PICK[MAIN[os]](x.name));
  if (mine) {
    $("#hero-download").href = mine.browser_download_url;
    $$("[data-dl]").forEach((a) => (a.href = mine.browser_download_url));
  }
  const when = new Date(release.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  $("#release-line").textContent = `${release.tag_name}, ${when}. No account, no telemetry. Needs Docker or Podman.`;
})();

// Stars: shown only once the number means something.
fetch(`https://api.github.com/repos/${REPO}`)
  .then((r) => (r.ok ? r.json() : null))
  .then((repo) => {
    if (!repo || !(repo.stargazers_count >= 50)) return;
    $$("[data-stars]").forEach((el) => { el.textContent = repo.stargazers_count.toLocaleString(); el.hidden = false; });
  })
  .catch(() => {});

/* ---------- Page chrome ---------- */

const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => $(".nav").classList.toggle("scrolled", !e.isIntersecting)).observe(sentinel);

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  },
  { rootMargin: "0px 0px -10% 0px" },
);
$$(".three, .get, .faq").forEach((el) => { el.classList.add("reveal"); io.observe(el); });

/* ---------- The section you're in ---------- */

(function navActive() {
  const links = $$('.nav-link[href^="#"]');
  const targets = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if (!targets.length) return;
  // The section crossing the upper middle of the screen is the one you're in.
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${e.target.id}`));
      }
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  targets.forEach((t) => watch.observe(t));
})();

/* ---------- Kalypso, in ASCII ---------- */

// She decodes into place on load, then a slow tide moves through the waves below her.
(function kalypso() {
  const pre = $("#kalypso");
  if (!pre) return;
  const art = pre.textContent;
  const RAMP = " .,:;=+*#";
  const lines = art.split("\n");
  const tideFrom = Math.floor(lines.length * 0.68); // the waves: the bottom third
  if (reduce) return;

  // 1. Decode: each character settles at its own moment within the first 1.3 s.
  const settle = [...art].map((c) => (c === " " || c === "\n" ? 0 : 200 + Math.random() * 1100));
  const t0 = performance.now();
  const decode = (now) => {
    const t = now - t0;
    let done = true;
    pre.textContent = [...art].map((c, i) => {
      if (t >= settle[i]) return c;
      done = false;
      return RAMP[1 + Math.floor(Math.random() * (RAMP.length - 1))];
    }).join("");
    if (done) startTide(); else requestAnimationFrame(decode);
  };
  requestAnimationFrame(decode);

  // 2. Tide: a slow swell of brightness rolling through the waves, only while she's on screen.
  let visible = true, timer = null, phase = 0;
  function frame() {
    phase += 0.35;
    pre.textContent = lines.map((line, y) => {
      if (y < tideFrom) return line;
      return [...line].map((c, x) => {
        const i = RAMP.indexOf(c);
        if (i <= 0) return c;
        const swell = Math.round(Math.sin(x * 0.18 - phase + y * 0.6) * 1.2);
        return RAMP[Math.max(1, Math.min(RAMP.length - 1, i + swell))];
      }).join("");
    }).join("\n");
  }
  function startTide() {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      clearInterval(timer);
      if (visible) timer = setInterval(frame, 140);
    }).observe(pre);
  }
})();

/* ---------- The island: point at a layer ---------- */

(function isle() {
  const box = $(".isle");
  if (!box) return;
  const map = $("#isle", box);
  const rows = $$(".xr-steps li", box);
  // Point at a ring or a row: that layer lights up on both sides.
  const pick = (key) => {
    if (key) box.dataset.on = key; else delete box.dataset.on;
    rows.forEach((r) => r.classList.toggle("on", r.dataset.layer === key));
  };
  const layerOf = (e) => e.target.closest("[data-layer]")?.dataset.layer || null;
  for (const el of [map, $(".xr-steps", box)]) {
    el.addEventListener("mouseover", (e) => pick(layerOf(e)));
    el.addEventListener("mouseleave", () => pick(null));
    el.addEventListener("focusin", (e) => pick(layerOf(e)));
    el.addEventListener("focusout", () => pick(null));
    el.addEventListener("click", (e) => pick(layerOf(e))); // touch
  }
  // The calls only move while the map is on screen, and never with reduced motion.
  if (reduce) { map.pauseAnimations(); return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? map.unpauseAnimations() : map.pauseAnimations())).observe(map);
})();

/* ---------- In the app: tabs over real screens ---------- */

(function showcase() {
  const tabs = $$(".show-tabs [role=tab]");
  if (!tabs.length) return;
  const row = $(".show-tabs");
  const panel = $("#show-panel");
  // Tabs change only when you pick one: nothing moves on its own while you scroll.
  const select = (i, focus = false) => {
    const current = (i + tabs.length) % tabs.length;
    const key = tabs[current].dataset.tab;
    tabs.forEach((t, n) => {
      t.setAttribute("aria-selected", String(n === current));
      t.tabIndex = n === current ? 0 : -1;
    });
    $$(".show-shot, .show-copy").forEach((el) => el.classList.toggle("on", el.dataset.tab === key));
    panel.setAttribute("aria-labelledby", tabs[current].id);
    if (focus) tabs[current].focus({ preventScroll: true });
    // Keep the chosen tab visible in its own row (phones), without moving the page.
    const t = tabs[current];
    if (t.offsetLeft < row.scrollLeft || t.offsetLeft + t.offsetWidth > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: t.offsetLeft - 8, behavior: reduce ? "auto" : "smooth" });
  };
  tabs.forEach((t, i) => t.addEventListener("click", () => select(i)));
  row.addEventListener("keydown", (e) => {
    const now = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    const go = { ArrowRight: now + 1, ArrowLeft: now - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (go === undefined) return;
    e.preventDefault();
    select(go, true);
  });
  select(0);
})();
