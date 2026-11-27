import { drawCinematicFX, cardEffect } from "./cinematic-fx.mjs";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const active = new Set();
let raf = 0,
  last = 0;
const node = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
function tick(now) {
  raf = 0;
  const delta = Math.min(0.05, last ? (now - last) / 1000 : 0);
  last = now;
  for (const item of active) {
    if (!item.visible || reduced.matches || document.hidden) continue;
    item.time += delta;
    const { canvas, host, options } = item,
      w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) continue;
    const dpr = Math.min(devicePixelRatio, 1.5),
      cw = Math.round(w * dpr),
      ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCinematicFX(ctx, {
      width: w,
      height: h,
      time: item.time,
      quality: w < 500 ? 0.6 : 0.85,
      ...options,
    });
    options.onFrame?.(item.time);
  }
  if ([...active].some(item => item.visible) && !reduced.matches && !document.hidden)
    raf = requestAnimationFrame(tick);
}
function wake() {
  last = 0;
  if (!raf && [...active].some(item => item.visible) && !reduced.matches && !document.hidden)
    raf = requestAnimationFrame(tick);
}
reduced.addEventListener("change", wake);
document.addEventListener("visibilitychange", wake);

export function mountFX(host, options = {}) {
  const canvas = node("canvas", "cinematic-canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const item = { host, canvas, options, time: 0, visible: true };
  active.add(item);
  const observer = new IntersectionObserver((entries) => {
    item.visible = entries[0]?.isIntersecting ?? false;
    if (item.visible) wake();
  });
  observer.observe(host);
  wake();
  return () => {
    observer.disconnect();
    active.delete(item);
    canvas.remove();
    if (!active.size) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
export function animateCard(el, card) {
  if (!["Epic", "Legendary"].includes(card.rarity)) return () => {};
  el.classList.add("high-rarity");
  el.dataset.rarity = card.rarity;
  const halo = node("div", "card-halo"),
    art = node("div", "card-art-motion");
  el.prepend(halo);
  el.append(art);
  const stopHalo = mountFX(halo, {
    kind: card.rarity === "Legendary" ? "gold" : "arcane",
    strength: 0.45,
  });
  const stopArt = mountFX(art, {
    kind: cardEffect(card.id, card.rarity),
    mode: "art",
    strength: 0.9,
  });
  return () => {
    stopHalo();
    stopArt();
    halo.remove();
    art.remove();
  };
}
