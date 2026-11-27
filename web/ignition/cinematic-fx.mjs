// Shared, deterministic motion renderer for the browser and frame-by-frame film.
// No economy state, randomness source, image mutation, or reward selection here.
import { renderGPU } from "./gpu-fx.mjs";
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const fract = (v) => v - Math.floor(v);
const noise = (i) => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453123);
const particles = Array.from({ length: 320 }, (_, i) => ({
  a: noise(i) * TAU,
  r: noise(i + 70),
  v: noise(i + 140),
  z: noise(i + 210),
  phase: noise(i + 280) * TAU,
}));
export function cardEffect(id, rarity = "Epic") {
  return id === "mage-pyroblast"
    ? "fire"
    : id === "ranger-dragon-shot"
      ? "plasma"
      : rarity === "Legendary"
        ? "gold"
        : "arcane";
}
const palette = {
  fire: [255, 116, 34],
  plasma: [108, 240, 190],
  arcane: [166, 113, 255],
  gold: [255, 194, 91],
  blue: [76, 143, 255],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
const textures = new WeakMap();
function glow(ctx, x, y, r, c, opacity = 1) {
  if (r < 0.01 || opacity < 0.001) return;
  let map = textures.get(ctx);
  if (!map) {
    map = new Map();
    textures.set(ctx, map);
  }
  const key = c.join(",");
  let sprite = map.get(key);
  if (!sprite) {
    sprite = ctx.canvas.ownerDocument.createElement("canvas");
    sprite.width = sprite.height = 128;
    const s = sprite.getContext("2d");
    const g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, rgba(c, 1));
    g.addColorStop(0.12, rgba(c, 0.75));
    g.addColorStop(0.4, rgba(c, 0.18));
    g.addColorStop(1, rgba(c, 0));
    s.fillStyle = g;
    s.fillRect(0, 0, 128, 128);
    map.set(key, sprite);
  }
  ctx.globalAlpha = clamp(opacity);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
function line(ctx, points, c, width, alpha) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = rgba(c, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}
function filament(ctx, points, c, width = 1, alpha = 0.7) {
  line(ctx, points, c, width * 7, alpha * 0.035);
  line(ctx, points, c, width * 3, alpha * 0.14);
  line(ctx, points, c, width, alpha);
  line(ctx, points, [240, 245, 255], width * 0.35, alpha * 0.8);
}
function mist(ctx, t, c, cx, cy, s, alpha) {
  for (let i = 0; i < 15; i++) {
    const p = particles[i];
    glow(
      ctx,
      cx + Math.sin(t * 0.4 + p.a) * s * (0.2 + p.r * 0.4),
      cy + Math.cos(t * 0.3 + p.phase) * s * 0.24,
      s * (0.15 + p.z * 0.2),
      c,
      alpha * (0.04 + p.v * 0.06),
    );
  }
}
function drawCanvasFallback(
  ctx,
  {
    width,
    height,
    time = 0,
    kind = "arcane",
    mode = "aura",
    strength = 1,
    burstAt = 0.42,
    quality = 1,
  },
) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const c = palette[kind] ?? palette.arcane,
    s = Math.min(width, height),
    cx = width / 2,
    cy = height / 2;
  const t = Math.max(0, time),
    count = Math.round(
      (mode === "ambient" ? 100 : mode === "art" ? 74 : 240) * quality,
    );
  if (mode === "ambient") {
    for (let i = 0; i < count; i++) {
      const p = particles[i],
        x = (p.r * width + Math.sin(t * 0.2 + p.a) * 35 + width) % width,
        y = (p.v * height - t * (8 + p.z * 22) + height * 100) % height;
      const r = 0.8 + p.z * 1.8;
      if (i % 8 === 0) glow(ctx, x, y, 9 + p.z * 15, c, 0.08);
      else {
        glow(ctx, x, y, r * 4, c, 0.38);
        line(
          ctx,
          [
            [x, y + 4 + p.z * 7],
            [x + 0.5, y],
          ],
          [255, 225, 180],
          r * 0.5,
          0.32,
        );
      }
    }
    ctx.restore();
    return;
  }
  if (mode === "art") {
    // Preserve the native card's icon area and its name/rules; light inhabits art.
    ctx.beginPath();
    ctx.rect(width * 0.08, height * 0.12, width * 0.85, height * 0.45);
    ctx.clip();
    const ax = width * 0.53,
      ay = height * 0.3,
      rr = width * 0.27;
    mist(ctx, t, c, ax, ay, rr, 0.7 * strength);
    if (kind === "fire") {
      for (let i = 0; i < 13; i++) {
        const p = particles[i],
          a = p.a + t * (0.12 + p.v * 0.1),
          pts = [];
        for (let j = 0; j < 30; j++) {
          const u = j / 29,
            r =
              rr *
              (0.75 + u * 0.3 + Math.sin(u * 12 + t * 2 + p.phase) * 0.035),
            b = a + u * 0.95;
          pts.push([
            ax + Math.cos(b) * r,
            ay + Math.sin(b) * r * 0.85 - u * height * 0.035,
          ]);
        }
        filament(
          ctx,
          pts,
          i % 4 === 0 ? [255, 214, 135] : c,
          0.8 + width / 600,
          (0.25 + p.v * 0.3) * strength,
        );
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const p = particles[i],
          pts = [];
        for (let j = 0; j < 38; j++) {
          const u = j / 37,
            x = width * (-0.1 + u * 1.2),
            y =
              height * (0.34 - 0.17 * u) +
              Math.sin(u * 8 - t * 2.5 + p.phase) * height * 0.045 +
              (i - 3) * height * 0.016;
          pts.push([x, y]);
        }
        filament(ctx, pts, c, 0.7 + width / 800, (0.18 + p.v * 0.2) * strength);
      }
    }
    for (let i = 0; i < count; i++) {
      const p = particles[i],
        life = fract(t * (0.13 + p.v * 0.2) + p.r),
        x =
          ax +
          Math.cos(p.a + t * 0.2) * rr * (0.4 + p.z * 0.8) +
          Math.sin(life * 6 + p.phase) * width * 0.03,
        y = ay + rr * 0.8 - life * height * 0.48;
      glow(
        ctx,
        x,
        y,
        1 + p.z * 3,
        c,
        Math.sin(life * Math.PI) * 0.55 * strength,
      );
    }
    ctx.restore();
    return;
  }
  const age = t - burstAt,
    impact = age >= 0 ? Math.exp(-age * 3) : 0,
    build = clamp(t / burstAt);
  mist(ctx, t, c, cx, cy, s, 0.8 * strength);
  glow(ctx, cx, cy, s * 0.48, c, (0.12 + impact * 0.45) * strength);
  // Curved orbit ribbons, with a luminous moving head and a faint trailing wake.
  const radius = s * (mode === "token" ? 0.29 : 0.35);
  for (let i = 0; i < 5; i++) {
    const pts = [],
      head = t * (0.8 + i * 0.12) + i * 1.22,
      tilt = (i - 2) * 0.22;
    for (let j = 0; j < 65; j++) {
      const a = head - j * 0.018,
        rx = radius * (0.92 + i * 0.055),
        x = Math.cos(a) * rx,
        y = Math.sin(a) * rx * (0.34 + i * 0.055);
      pts.push([
        cx + x * Math.cos(tilt) - y * Math.sin(tilt),
        cy + x * Math.sin(tilt) + y * Math.cos(tilt),
      ]);
    }
    filament(ctx, pts, c, 1.2 + i * 0.18, 0.38 * strength);
    glow(ctx, pts[0][0], pts[0][1], 8, c, 0.7 * strength);
  }
  if (age >= 0) {
    // A decelerating blast: trails follow drag and curl, not straight spokes.
    for (let i = 0; i < count; i++) {
      const p = particles[i],
        delay = p.v * 0.13,
        a = Math.max(0, age - delay),
        life = clamp(a / (1.8 + p.r * 1.7));
      if (life >= 1) continue;
      const distance =
          s * (0.12 + p.r * 0.65) * (1 - Math.exp(-a * (1.3 + p.v))),
        theta = p.a + Math.sin(a * 1.5 + p.phase) * 0.12;
      const x = cx + Math.cos(theta) * distance,
        y = cy + Math.sin(theta) * distance * 0.72 + a * a * s * 0.035,
        fade = Math.pow(1 - life, 1.5) * strength;
      const tail = 3 + p.z * 18,
        tx = x - Math.cos(theta) * tail,
        ty = y - Math.sin(theta) * tail * 0.72;
      if (i % 9 === 0) glow(ctx, x, y, 9 + p.z * 14, c, fade * 0.15);
      else {
        glow(ctx, x, y, 3 + p.z * 5, c, fade * 0.55);
        filament(
          ctx,
          [
            [tx, ty],
            [x, y],
          ],
          c,
          0.6 + p.z * 0.9,
          fade * 0.7,
        );
      }
    }
    for (let k = 0; k < 3; k++) {
      const a = age - k * 0.12;
      if (a < 0) continue;
      const r = s * (0.08 + 0.5 * (1 - Math.exp(-a * 2))),
        alpha = Math.exp(-a * 2) * 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * (0.38 + k * 0.07), k * 0.3, 0, TAU);
      ctx.strokeStyle = rgba(c, alpha * strength);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  // Continuous sparks give an epic result a living edge after the impact.
  for (let i = 0; i < 56; i++) {
    const p = particles[i],
      a = p.a + t * (0.14 + p.v * 0.2),
      r = radius * (1.02 + p.z * 0.23);
    glow(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * 0.72,
      1 + p.z * 3,
      c,
      (0.15 + p.r * 0.45) * strength,
    );
  }
  if (mode === "token") {
    // Engraved medal, lit rim and orbiting coin flecks. Quantity stays in DOM text.
    const r = s * 0.225 * (0.85 + 0.15 * Math.min(1, build));
    const fill = ctx.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.4,
      r * 0.01,
      cx,
      cy,
      r,
    );
    fill.addColorStop(0, rgba(c, 0.24));
    fill.addColorStop(0.68, "rgba(8,10,20,.9)");
    fill.addColorStop(0.93, rgba(c, 0.18));
    fill.addColorStop(1, rgba(c, 0.55));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    for (const q of [0.88, 0.94, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * q, 0, TAU);
      ctx.strokeStyle = rgba(c, q === 1 ? 0.85 : 0.25);
      ctx.lineWidth = q === 1 ? 2 : 1;
      ctx.stroke();
    }
    for (let i = 0; i < 64; i++) {
      const a = (i * TAU) / 64;
      line(
        ctx,
        [
          [cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94],
          [cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98],
        ],
        c,
        1,
        0.5,
      );
    }
    for (let i = 0; i < 24; i++) {
      const p = particles[i],
        a = p.a + t * (0.4 + p.v * 0.3),
        rad = r * (1.45 + p.z * 0.7),
        x = cx + Math.cos(a) * rad,
        y = cy + Math.sin(a) * rad * 0.67;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.scale(0.25 + Math.abs(Math.sin(t * 2 + p.phase)) * 0.75, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3 + p.z * 4, 6 + p.z * 6, 0, 0, TAU);
      ctx.fillStyle = rgba(c, 0.45);
      ctx.fill();
      ctx.strokeStyle = rgba([255, 242, 204], 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawCinematicFX(ctx, options) {
  const { width, height } = options;
  const surface = renderGPU(ctx.canvas.ownerDocument, options);
  if (!surface) {
    ctx.canvas.dataset.renderer = "canvas-fallback";
    drawCanvasFallback(ctx, options);
    return;
  }
  ctx.canvas.dataset.renderer = surface.dataset.renderer;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(surface, 0, 0, width, height);
}
