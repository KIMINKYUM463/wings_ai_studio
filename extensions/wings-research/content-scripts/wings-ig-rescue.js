/**
 * WINGS IG rescue — only on profile pages; nudge stuck "Analyzing" chips.
 */
(() => {
  if (window.__WINGS_IG_RESCUE__) return;
  window.__WINGS_IG_RESCUE__ = true;

  const RESERVED = new Set([
    "reels","reel","explore","direct","accounts","p","stories","about","developer",
    "legal","privacy","terms","web","session","emails","challenge","oauth","ajax",
    "api","graphql","your_activity","inbox","notifications","nametag"
  ]);

  function isProfilePath(pathname) {
    const m = (pathname || "").match(/^\/([A-Za-z0-9._]+)\/?(?:$|(?:reels?|tagged)\/?$)/);
    if (!m) return false;
    return !RESERVED.has(m[1].toLowerCase());
  }

  const started = new WeakMap();

  function scan() {
    if (!isProfilePath(location.pathname)) return;
    const chips = document.querySelectorAll(".hd-feed-chip");
    chips.forEach((chip) => {
      const text = (chip.textContent || "").replace(/\s+/g, " ");
      const analyzing = /분석 중|Analyzing/i.test(text);
      if (!analyzing) {
        started.delete(chip);
        return;
      }
      const t0 = started.get(chip) || Date.now();
      if (!started.has(chip)) started.set(chip, t0);
      if (Date.now() - t0 < 8000) return;
      try {
        chip.removeAttribute("data-hd-feed");
        chip.style.opacity = "0.99";
        window.dispatchEvent(new Event("scroll"));
        chip.setAttribute("data-wings-rescue", String(Date.now()));
      } catch {
        /* ignore */
      }
    });
  }

  setInterval(scan, 2000);
  window.addEventListener("wxt:locationchange", scan);
})();
