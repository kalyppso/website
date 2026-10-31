# KALYPSO website

The landing page for [KALYPSO](https://github.com/kalyppso/kalypso), a desktop workspace for running and supervising AI agents. Live at **https://kalyppso.github.io/website/**.

Plain HTML, CSS and a little JavaScript, no build step. Pushing to `main` deploys it to GitHub Pages (`.github/workflows/pages.yml`).

## Downloads

The download buttons read the newest release of `kalyppso/kalypso` from the GitHub API (`main.js`) and link straight to its installers: the `.exe` and `.msi` for Windows, the `.dmg` for macOS and the `.AppImage`, `.deb` and `.rpm` for Linux. The visitor's platform is highlighted. If the API can't be reached, the links fall back to the releases page.

New installers appear here automatically: tag a version in the app repo (`v0.1.0`) and its release workflow builds and publishes them.

## Run it locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.
