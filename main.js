// Point every download link at the newest KALYPSO release and highlight the
// visitor's platform. Without the API (offline, rate limit) the links keep
// pointing at the releases page, so downloading still works.

const REPO = "kalyppso/kalypso";

/** Which asset a link wants, by file name. */
const PICK = {
  exe: (n) => /setup\.exe$/i.test(n) || /\.exe$/i.test(n),
  msi: (n) => /\.msi$/i.test(n),
  dmg: (n) => /\.dmg$/i.test(n),
  appimage: (n) => /\.appimage$/i.test(n),
  deb: (n) => /\.deb$/i.test(n),
  rpm: (n) => /\.rpm$/i.test(n),
};

function platform() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return null;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;

async function latestRelease() {
  // The list includes pre-releases, which /releases/latest skips; 0.x builds are pre-releases.
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const releases = await res.json();
  return releases.find((r) => !r.draft && r.assets.length > 0) ?? null;
}

function applyRelease(release) {
  const find = (kind) => release.assets.find((a) => PICK[kind](a.name));
  for (const link of document.querySelectorAll("[data-asset]")) {
    const asset = find(link.dataset.asset);
    if (!asset) continue;
    link.href = asset.browser_download_url;
    if (link.classList.contains("btn")) {
      const size = document.createElement("span");
      size.className = "size";
      size.textContent = mb(asset.size);
      link.append(" ", size);
    }
  }
  const exe = find("exe");
  if (exe) document.getElementById("hero-download").dataset.exe = exe.browser_download_url;
  const when = new Date(release.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  document.getElementById("release-line").textContent =
    `${release.name || release.tag_name}, released ${when}${release.prerelease ? " (pre-release)" : ""}.`;
  return { exe, dmg: find("dmg"), appimage: find("appimage"), tag: release.tag_name };
}

function applyPlatform(os, found) {
  const hero = document.getElementById("hero-download");
  const label = document.getElementById("hero-label");
  const meta = document.getElementById("hero-meta");
  const card = os && document.querySelector(`.platform[data-os="${os}"]`);
  card?.classList.add("mine");
  const pick = { windows: ["Windows", found?.exe, ".exe installer"], mac: ["macOS", found?.dmg, ".dmg"], linux: ["Linux", found?.appimage, ".AppImage"] }[os ?? "windows"];
  label.textContent = `Download for ${pick[0]}`;
  if (pick[1]) {
    hero.href = pick[1].browser_download_url;
    meta.textContent = `${found.tag} · ${pick[2]} · ${mb(pick[1].size)} · free and open source`;
  } else if (os !== "windows" && os) {
    hero.href = "#download";
  }
}

(async () => {
  const os = platform();
  let found = null;
  try {
    const release = await latestRelease();
    if (release) found = applyRelease(release);
  } catch {
    // Keep the fallback links to the releases page.
  }
  applyPlatform(os, found);
})();

// Fade sections in as they scroll into view.
const io = "IntersectionObserver" in window && new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { rootMargin: "0px 0px -10% 0px" });
if (io) for (const el of document.querySelectorAll(".section")) { el.classList.add("reveal"); io.observe(el); }
