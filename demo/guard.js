/* The live preview on kalyppso.github.io: the real app with sample data. Look around freely;
   anything that would change something (typing, saving, starting, toggling) asks you to download. */
(function () {
  let white = false;
  try { white = parent !== window && parent.document.documentElement.classList.contains("white"); } catch (e) { /* not embedded */ }
  try {
    localStorage.setItem("kalypso.proto.v2", JSON.stringify({
      session: { name: "sam", email: "sam@example.com", provider: "email", linked: [], since: "2026-11-01" },
      appearance: white
        ? { theme: "custom", bg: "#fffdfa", text: "#101010", accent: "#4b5efc", font: "geist", size: "default" }
        : { theme: "custom", bg: "#101010", text: "#f6f4ef", accent: "#6274ff", font: "geist", size: "default" },
      prefs: { ambient: false },
      view: "overview",
    }));
  } catch (e) { /* storage blocked: the app shows its sign-in, which the guard also catches */ }

  let last = 0;
  const ask = (what) => {
    const now = Date.now();
    if (now - last < 600) return;
    last = now;
    if (parent !== window) parent.postMessage({ kalypsoDemo: "download", what }, location.origin);
  };
  const DO = /^(save|create|start|stop|restart|delete|remove|send|run|connect|disconnect|import|upload|approve|deny|allow|retry|sign|install|apply|give|pause|resume|merge|test|rotate|revoke|reset|add|new|open terminal|clear|confirm|done|grant|assign|link|unlink|keep|discard|publish|push|deploy)\b/i;
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.title || "").trim();
  const block = (e, what) => { e.preventDefault(); e.stopImmediatePropagation(); ask(what); };

  addEventListener("focusin", (e) => {
    const t = e.target;
    if (t instanceof Element && t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=''], [contenteditable=true]")) { t.blur(); ask("type"); }
  }, true);
  const onPress = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest("input[type=checkbox], input[type=radio], [role=switch], .toggle")) return block(e, "toggle");
    const b = t.closest("button, [role=button], a");
    if (!b) return;
    if (b.closest("nav, [role=tablist]")) return; // moving around is free
    const name = label(b);
    // Opening a "New …" form is fine to look at; its Save is what asks. Primary buttons inside forms always ask.
    if (b.closest(".modal, [role=dialog]") && (b.classList.contains("primary") || DO.test(name))) return block(e, name);
    if (DO.test(name) && !/^(new|add)\b/i.test(name)) return block(e, name);
    if (b.classList.contains("danger")) return block(e, name);
  };
  addEventListener("click", onPress, true);
  addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target instanceof Element && e.target.matches("input, textarea")) block(e, "type"); }, true);
  addEventListener("submit", (e) => block(e, "submit"), true);
})();
