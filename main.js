// KALYPSO site behaviour: the request-flow demo, the theme switcher, downloads from
// the latest release, and section reveals. Everything works without the GitHub API;
// it only fills in real file names, sizes and star counts when it can.

const REPO = "kalyppso/kalypso";
document.documentElement.classList.add("js");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- How it works: real requests and KALYPSO's real answers ---------- */

// Responses are what the gateway returns (see src-tauri/src/gateway/tests.rs in the app repo).
const SCENARIOS = {
  push: {
    stopAt: "policy",
    verdict: "blocked",
    req: `POST /_kalypso/policy/check
Authorization: Bearer kx_••••

{ "kind": "bash",
  "command": "git push --force origin main" }`,
    resTitle: "Response · 200",
    res: `{ "decision": "deny",
  "policy": "No force-push to main",
  "reason": "Blocked by policy \\"No force-push to main\\": the command matches a forbidden pattern. Never force-push to main or master.",
  "warnings": [] }`,
    outcome: "Stopped before it runs, and written to the enforcement log.",
  },
  host: {
    stopAt: "policy",
    verdict: "asks you",
    req: `POST /_kalypso/policy/check
Authorization: Bearer kx_••••

{ "kind": "http",
  "url": "https://pastebin.com/raw/abc123" }`,
    resTitle: "Response · after you approve",
    res: `// held while KALYPSO shows you an approval prompt
{ "decision": "allow",
  "policy": null,
  "reason": null,
  "warnings": [] }`,
    outcome: "The call waits until you approve or deny it. No answer in 10 minutes means no.",
  },
  budget: {
    stopAt: "gateway",
    verdict: "paused",
    req: `POST /anthropic/v1/messages
x-api-key: kx_••••

{ "model": "claude-opus-5-5", "max_tokens": 1024,
  "messages": [ … ] }`,
    resTitle: "Response · 402",
    res: `{ "type": "error",
  "error": { "type": "budget_exceeded",
    "message": "Budget reached: namespace work spent $1.40 of its $1.00 daily cap. Requests resume tomorrow (00:00 UTC), or raise the cap." } }`,
    outcome: "Never reaches the provider, so it costs nothing. You get a notification once.",
  },
  ok: {
    stopAt: null,
    verdict: "",
    req: `POST /anthropic/v1/messages
x-api-key: kx_••••   // a KALYPSO key, not yours

{ "model": "claude-opus-5-5", "max_tokens": 1024,
  "messages": [ … ] }`,
    resTitle: "Response · 200, streamed through",
    res: `// forwarded with the namespace's real key, which never enters the sandbox
{ "type": "message", "model": "claude-opus-5-5",
  "usage": { "input_tokens": 2048, "output_tokens": 312 } }  // example
// metered from usage, priced from pricing.toml`,
    outcome: "Goes through untouched, with the real key swapped in, and lands on the Budget page.",
  },
};

const ORDER = ["agent", "policy", "gateway", "model"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Light highlighting: comments dim, JSON keys tinted, strings bright.
const paint = (s) =>
  esc(s)
    .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
    .replace(/("[a-z_]+")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/(:\s*)("[^"\n]*")/g, '$1<span class="s">$2</span>');

function showScenario(key) {
  const s = SCENARIOS[key];
  for (const tab of $$(".scenarios button")) tab.setAttribute("aria-selected", String(tab.dataset.s === key));
  const stop = s.stopAt ? ORDER.indexOf(s.stopAt) : ORDER.length;
  $$(".path li").forEach((li, i) => {
    li.classList.toggle("passed", i < stop);
    li.classList.toggle("stop", i === stop);
    li.classList.toggle("skipped", i > stop);
    if (i === stop) li.querySelector("b").dataset.verdict = s.verdict;
  });
  $("#req").innerHTML = paint(s.req);
  $("#res").innerHTML = paint(s.res);
  $("#res-title").textContent = s.resTitle;
  $("#outcome").textContent = s.outcome;
  const ex = $(".exchange");
  ex.classList.remove("swap");
  void ex.offsetWidth; // restart the fade
  ex.classList.add("swap");
}

$$(".scenarios button").forEach((b) => b.addEventListener("click", () => showScenario(b.dataset.s)));
// Arrow keys move between scenarios, as in any tab list.
$(".scenarios").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const tabs = $$(".scenarios button");
  const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
  const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  next.focus();
  showScenario(next.dataset.s);
});
showScenario("push");

/* ---------- Hero: an agent at work ---------- */

// The shape of a real run: what the Claude Agent SDK runtime writes to the transcript.
const DEMO = [
  ["status", "started · claude-sonnet-5-5 · 22 tools", 500],
  ["text", "I'll run the tests first to see what fails.", 900],
  ["tool", "Bash|npm test", 700, { check: 1, spend: 0.004 }],
  ["output", "23 passing, 1 failing: parses an empty config file", 900],
  ["tool", "Read|src/config.ts", 600, { check: 1, spend: 0.006 }],
  ["tool", "Edit|src/config.ts", 900, { check: 1, spend: 0.009 }],
  ["tool", "Bash|npm test", 700, { check: 1, spend: 0.004 }],
  ["output", "24 passing", 900],
  ["tool", "Bash|git push --force origin main", 800, { check: 1, spend: 0.003 }],
  ["policy", 'Blocked by policy <b>"No force-push to main"</b>. The command never ran.', 1500, { blocked: 1 }],
  ["text", "Force-pushing to main isn't allowed here. I'll push a branch and open a pull request instead.", 1000, { spend: 0.005 }],
  ["tool", "Bash|git push origin fix/empty-config", 800, { check: 1, spend: 0.003 }],
  ["tool", "Bash|gh pr create --fill", 900, { check: 1, spend: 0.004 }],
  ["output", "https://github.com/acme/app/pull/482", 700],
  ["result", "Done · 9 turns · $0.042", 4500, { done: true }],
];

function demo() {
  const log = $("#demo-log");
  if (!log) return;
  const status = $("#demo-status");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let i = 0, spend = 0.8, checks = 0, blocked = 0, timer = null, visible = true;
  const meter = () => {
    $("#demo-spend").textContent = `$${spend.toFixed(2)}`;
    $("#demo-meter").style.width = `${Math.min(100, (spend / 5) * 100)}%`;
    $("#demo-checks").textContent = checks;
    $("#demo-blocked").textContent = blocked;
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
  const apply = (fx = {}) => {
    checks += fx.check || 0; blocked += fx.blocked || 0; spend += (fx.spend || 0) * 3;
    if (fx.done) { status.classList.add("done"); status.lastChild.textContent = "Waiting for a message"; }
    meter();
  };
  const reset = () => {
    log.replaceChildren(); i = 0; checks = 0; blocked = 0; spend = 0.8;
    status.classList.remove("done"); status.lastChild.textContent = "Running"; meter();
  };
  const step = () => {
    timer = null;
    if (!visible) return;
    if (i >= DEMO.length) { reset(); timer = setTimeout(step, 600); return; }
    const s = DEMO[i++];
    line(s); apply(s[3]);
    timer = setTimeout(step, s[2]);
  };
  // Reduced motion: the finished run, still.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    DEMO.forEach((s) => { line(s, false); apply(s[3]); });
    return;
  }
  meter();
  // Only play while it's on screen.
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !timer) timer = setTimeout(step, 400);
  }).observe($(".stage"));
}
demo();

/* ---------- Themes ---------- */

const THEMES = { dark: ["overview-dark.png", "Black"], light: ["overview-light.png", "White"], blossom: ["overview-blossom.png", "Blossom"] };
for (const [, [file]] of Object.entries(THEMES)) new Image().src = `assets/${file}`; // no flash on switch
$$(".seg button").forEach((b) =>
  b.addEventListener("click", () => {
    const [file, label] = THEMES[b.dataset.theme];
    $$(".seg button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    const img = $("#theme-img");
    img.classList.add("fading");
    setTimeout(() => {
      img.src = `assets/${file}`;
      img.alt = `The Overview in the ${label} theme`;
      img.classList.remove("fading");
    }, 180);
  }),
);

/* ---------- Downloads ---------- */

const PICK = {
  exe: (n) => /\.exe$/i.test(n),
  msi: (n) => /\.msi$/i.test(n),
  dmg: (n) => /\.dmg$/i.test(n),
  appimage: (n) => /\.appimage$/i.test(n),
  deb: (n) => /\.deb$/i.test(n),
  rpm: (n) => /\.rpm$/i.test(n),
};
const PLATFORMS = {
  windows: {
    name: "Windows", req: "Windows 10 and 11, 64-bit", asset: "exe", icon: "exe",
    note: "Not code-signed yet: if SmartScreen stops the installer, choose <strong>More info</strong>, then <strong>Run anyway</strong>.",
  },
  mac: {
    name: "macOS", req: "macOS 11 or later", asset: "dmg", icon: "dmg",
    note: "Not notarized yet: if macOS won't open it, go to <strong>System Settings, then Privacy &amp; Security</strong> and choose <strong>Open Anyway</strong>.",
  },
  linux: {
    name: "Linux", req: "x86_64, any recent distribution", asset: "appimage", icon: "appimage",
    note: "Make the AppImage executable (<code>chmod +x</code>) and run it, or use the .deb or .rpm below.",
  },
};
/** What a macOS build runs on, from its file name. */
const macArch = (name) => (/universal/i.test(name) ? "Apple silicon and Intel" : /aarch64|arm64/i.test(name) ? "Apple silicon" : /x64|x86_64/i.test(name) ? "Intel" : "");
const mb = (b) => `${Math.max(1, Math.round(b / 1048576))} MB`;

function platform() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "windows";
}

async function latestRelease() {
  // The list includes pre-releases, which /releases/latest skips; 0.x builds are pre-releases.
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).find((r) => !r.draft && r.assets.length) ?? null;
}

function applyPlatform(os, release) {
  const p = PLATFORMS[os];
  const asset = release?.assets.find((a) => PICK[p.asset](a.name));
  $("#hero-label").textContent = `Download for ${p.name}`;
  $$("[data-dl-label]").forEach((el) => (el.textContent = `Download for ${p.name}`));
  $("#dl-name").textContent = p.name;
  $("#dl-req").textContent = os === "mac" && asset && macArch(asset.name) ? `${p.req}, ${macArch(asset.name)}` : p.req;
  $("#dl-note").innerHTML = p.note;
  // The matching icon, copied from the list below so it stays one icon family.
  const icon = $(`.dl-all li[data-asset="${p.icon}"] .i`);
  if (icon) $("#dl-icon").replaceChildren(icon.cloneNode(true));
  if (asset) {
    $("#hero-download").href = asset.browser_download_url;
    $$("[data-dl]").forEach((a) => (a.href = asset.browser_download_url));
    $("#dl-button").href = asset.browser_download_url;
    $("#dl-label").textContent = `Download for ${p.name}`;
    $("#dl-file").textContent = `${asset.name} · ${mb(asset.size)}`;
  }
}

function applyRelease(release) {
  for (const li of $$(".dl-all li")) {
    const asset = release.assets.find((a) => PICK[li.dataset.asset](a.name));
    const link = li.querySelector("a");
    if (!asset) { li.hidden = true; continue; }
    if (li.dataset.asset === "dmg" && macArch(asset.name)) $("#mac-label").textContent = `macOS, ${macArch(asset.name)}`;
    link.href = asset.browser_download_url;
    link.setAttribute("aria-label", `Download ${asset.name}`);
    const size = document.createElement("span");
    size.className = "size";
    size.textContent = mb(asset.size);
    link.append(size);
  }
  const when = new Date(release.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  $("#release-line").textContent = `${release.name || release.tag_name}, released ${when}${release.prerelease ? ", an early pre-release" : ""}.`;
  $("#hero-version").textContent = `${release.tag_name}`;
  $("#release-pill").href = release.html_url;
}

(async () => {
  const os = platform();
  let release = null;
  try {
    release = await latestRelease();
    if (release) applyRelease(release);
  } catch {
    // Offline or rate-limited: links keep pointing at the releases page.
  }
  applyPlatform(os, release);
})();

// Star count, shown only when the API answers.
fetch(`https://api.github.com/repos/${REPO}`)
  .then((r) => (r.ok ? r.json() : null))
  .then((repo) => {
    // A small number reads worse than none: show it once it means something.
    if (!repo || !(repo.stargazers_count >= 50)) return;
    $$("[data-stars]").forEach((el) => { el.textContent = repo.stargazers_count.toLocaleString(); el.hidden = false; });
  })
  .catch(() => {});

/* ---------- Page chrome ---------- */

// Hairline under the nav once the page moves, without a scroll listener.
const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => $(".nav").classList.toggle("scrolled", !e.isIntersecting)).observe(sentinel);

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  },
  { rootMargin: "0px 0px -12% 0px" },
);
$$(".reveal").forEach((el) => io.observe(el));
