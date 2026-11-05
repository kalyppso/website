// KALYPSO site: downloads from the latest release, the depth scroll, and small touches.
// Everything works without the GitHub API; it only fills in real files and stars when it can.

const REPO = "kalyppso/kalypso";
document.documentElement.classList.add("js");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Seven layers deep ---------- */

// The layer you scroll to lights its mark on the gauge and pans the painting to its depth.
(function depths() {
  const steps = $$(".steps li");
  const marks = $$(".gauge li");
  const img = $("#plate-img");
  const frame = $(".plate-frame");
  if (!steps.length || !img || !frame) return;
  const show = (d) => {
    steps.forEach((li) => li.classList.toggle("on", +li.dataset.d === d));
    marks.forEach((m, i) => m.classList.toggle("on", i === d));
    if (matchMedia("(max-width: 900px)").matches) return;
    const travel = Math.max(0, img.offsetHeight - frame.clientHeight);
    img.style.setProperty("--pan", `${-(travel * d) / (steps.length - 1)}px`);
  };
  show(0);
  // The step crossing the middle of the screen is the current one.
  const watch = new IntersectionObserver(
    (entries) => { for (const e of entries) if (e.isIntersecting) show(+e.target.dataset.d); },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  steps.forEach((li) => watch.observe(li));
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
    // The hero button carries the visitor's OS mark, from the list below.
    const mark = $(`.oses li[data-os="${os}"] .i`);
    if (mark) $("#hero-os").replaceChildren(mark.cloneNode(true));
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
  if (mine) $$("[data-dl]").forEach((a) => (a.href = mine.browser_download_url));
  const when = new Date(release.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  $("#release-line").textContent = `${release.tag_name}, ${when}. No account and no telemetry. Needs Docker or Podman.`;
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

// The nav floats over the painting, then settles onto a solid bar once you scroll.
const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:80px;width:1px";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => $(".nav").classList.toggle("scrolled", !e.isIntersecting)).observe(sentinel);

// The app screenshot rises into place the first time it's seen.
if (!reduce) {
  const reveal = new IntersectionObserver(
    (entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); } },
    { rootMargin: "0px 0px -12% 0px" },
  );
  $$(".shot").forEach((el) => reveal.observe(el));
}
