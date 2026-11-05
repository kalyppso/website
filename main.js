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

/* ---------- How a call travels: the ASCII diagram ---------- */

(function flow() {
  const pre = $("#diagram");
  if (!pre) return;
  const LAYERS = [
    { id: "agent", name: "AGENT", note: "supervised, restarted, capped", title: "Agent", text: "Claude, supervised in its sandbox: restarted when it crashes, stopped at its turn limit." },
    { id: "policies", name: "POLICIES", note: "every call checked first", title: "Policies", text: "Every tool call is checked before it runs. Risky ones wait for you, and no answer means no." },
    { id: "sandbox", name: "SANDBOX", note: "read-only, no privileges", title: "Sandbox", text: "A read-only container with no privileges and its own network, or none at all." },
    { id: "vault", name: "VAULT", note: "secrets lent, never handed", title: "Vault", text: "Secrets arrive as files, or are lent to one approved command the agent can't read." },
    { id: "gateway", name: "GATEWAY", note: "stand-in key in, real out", title: "Gateway", text: "Agents hold a stand-in key; the real one is swapped in here. Every token metered and capped." },
  ];
  const EXTRA = {
    you: { title: "You", text: "Approve, pause or revoke anything, from the app or a notification. Every decision is written down." },
    models: { title: "Models", text: "Claude, any OpenAI-compatible API, or a model on your own machine. Your keys never leave KALYPSO." },
  };
  // Everything is laid out on one grid: the flow runs straight down column 23.
  const CW = 43; // box width between its borders
  const span = (cls, t, attrs = "") => `<span class="${cls}"${attrs}>${t}</span>`;
  const part = (id, t) => span(`part p-${id}`, t, ` data-part="${id}" tabindex="0" role="button" aria-label="${(LAYERS.find((l) => l.id === id) || EXTRA[id] || { title: id }).title}"`);
  const pad = (t, n) => t + " ".repeat(Math.max(0, n - t.length));

  const lines = [];
  lines.push("   " + span("dim", "claude code") + "     " + span("dim", "agent sdk") + "     " + span("dim", "your script"));
  lines.push("        " + span("wire w-in", "|") + " ".repeat(14) + span("wire w-in", "|") + " ".repeat(14) + span("wire w-in", "|"));
  lines.push("        " + span("wire w-in", "+" + "-".repeat(14) + "+" + "-".repeat(14) + "+"));
  lines.push("                       " + span("wire w-in", "v") + span("dim", "  tool call"));
  lines.push(" +" + "-".repeat(CW) + "+");
  LAYERS.forEach((l, i) => {
    // " · NAME      note…  " fills exactly CW columns.
    const row = ` ${span("mark", "·", ` data-mark="${l.id}"`)} ${pad(l.name, 10)}${span("dnote", pad(l.note, CW - 14))} `;
    let tail = "";
    if (l.id === "policies") tail = span("wire w-you", " ····>") + part("you", "|  YOU  |");
    lines.push(" |" + part(l.id, row) + "|" + tail);
    if (i < LAYERS.length - 1) {
      let side = "";
      if (l.id === "agent") side = "      " + span("you-box", "+-------+");
      if (l.id === "policies") side = "      " + span("you-box", "+-------+");
      lines.push(" +" + "-".repeat(CW) + "+" + side);
    }
  });
  const left = Math.floor(CW / 2);
  lines.push(" +" + "-".repeat(left) + "+" + "-".repeat(CW - left - 1) + "+");
  const mid = 2 + left; // column 23, under the tool call arrow
  lines.push(" ".repeat(mid) + span("wire w-out", "|") + span("dim", "  metered · capped"));
  lines.push(" ".repeat(mid - 14) + span("wire w-out", "+" + "-".repeat(13) + "+" + "-".repeat(13) + "+"));
  lines.push(" ".repeat(mid - 14) + span("wire w-out", "v") + " ".repeat(13) + span("wire w-out", "v") + " ".repeat(13) + span("wire w-out", "v"));
  // Each name centred under its arrow (columns mid-14, mid and mid+14).
  lines.push(" ".repeat(mid - 19) + part("models", span("model m-anthropic", " anthropic ") + "   " + span("model m-openai", "  openai  ") + "    " + span("model m-ollama", "  ollama  ")));
  pre.innerHTML = lines.join("\n");
  // Always show the whole diagram: on narrow screens the type shrinks to fit, never scrolls.
  const fit = () => {
    pre.style.fontSize = "";
    const base = parseFloat(getComputedStyle(pre).fontSize);
    let size = base;
    for (let i = 0; i < 6 && pre.scrollWidth > pre.clientWidth && size > 5; i++) {
      size = Math.max(5, (size * pre.clientWidth) / pre.scrollWidth - 0.15);
      pre.style.fontSize = `${size}px`;
    }
  };
  fit();
  addEventListener("resize", fit);

  // ----- Pointing at a part shows it in the app -----
  const card = { title: $("#flow-title"), text: $("#flow-text"), pics: $$(".flow .lx-screen picture") };
  const showPart = (id) => {
    const l = LAYERS.find((x) => x.id === id) || EXTRA[id];
    if (!l) return;
    card.title.textContent = l.title;
    card.text.textContent = l.text;
    card.pics.forEach((p) => p.classList.toggle("on", p.dataset.l === id));
    $$(".part", pre).forEach((p) => p.classList.toggle("picked", p.dataset.part === id));
  };
  let pinnedUntil = 0; // after you point at a part, the animation leaves the card alone for a while
  const point = (e) => { const p = e.target.closest(".part"); if (p) { pinnedUntil = Date.now() + 8000; showPart(p.dataset.part); } };
  pre.addEventListener("mouseover", point);
  pre.addEventListener("focusin", point);
  pre.addEventListener("click", point);
  const follow = (id) => { if (Date.now() > pinnedUntil) showPart(id); };
  showPart("agent");

  // ----- Two scenes, looping: a normal call, and one KALYPSO stops -----
  const status = $("#flow-status");
  const lit = (sel, on = true) => $$(sel, pre).forEach((el) => el.classList.toggle("lit", on));
  const clear = () => { $$(".lit, .stop", pre).forEach((el) => el.classList.remove("lit", "stop")); $$("[data-mark]", pre).forEach((m) => (m.textContent = "·")); };
  const at = (id, cls = "lit") => { const m = $(`[data-mark="${id}"]`, pre); if (m) m.textContent = "*"; $(`.p-${id}`, pre)?.classList.add(cls); follow(id); };
  const SCENES = [
    [
      [() => { clear(); lit(".w-in"); status.textContent = "claude code → bash: npm test"; }, 900],
      [() => at("agent"), 600],
      [() => { at("policies"); status.textContent = "policies: allowed"; }, 800],
      [() => at("sandbox"), 600],
      [() => at("vault"), 600],
      [() => { at("gateway"); status.textContent = "gateway: kx_ key → real key"; }, 800],
      [() => { lit(".w-out"); $(".m-anthropic", pre).classList.add("lit"); follow("models"); status.textContent = "anthropic: 200 · $0.004 metered"; }, 2200],
    ],
    [
      [() => { clear(); lit(".w-in"); status.textContent = "agent sdk → bash: git push --force main"; }, 900],
      [() => at("agent"), 600],
      [() => { at("policies", "stop"); status.textContent = "policies: blocked, no force-push to main"; }, 1100],
      [() => { lit(".w-you"); $(".p-you", pre).classList.add("lit"); lit(".you-box"); follow("you"); status.textContent = "you: notified · it never ran"; }, 2600],
    ],
  ];
  if (reduce) { SCENES[1].forEach(([fn]) => fn()); return; }
  let scene = 0, step = 0, timer = null, visible = false;
  const tick = () => {
    timer = null;
    if (!visible) return;
    const s = SCENES[scene];
    const [fn, wait] = s[step];
    fn();
    step++;
    if (step >= s.length) { step = 0; scene = (scene + 1) % SCENES.length; }
    timer = setTimeout(tick, wait);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !timer) timer = setTimeout(tick, 300);
  }, { threshold: 0.3 }).observe(pre);
})();
