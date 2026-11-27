<script lang="ts">
  import { onMount } from 'svelte';
  import type { Card } from '$lib/data/cards';
  import { maxCardNumber } from '$lib/economy/pack-opening';
  import {
    SHEETS,
    SPRITES,
    beatLayers,
    cardProjectileProfile,
    hasAreaShape,
    projectileSheetFor,
    resolveCardVfx,
    type FlipbookLayer,
    type Layer,
    type ProjectileSheet,
    type SprayLayer
  } from '$lib/render3d/fx/effect-families';
  import { schoolColor } from '$lib/theme/school-colors';

  interface Props {
    card: Card;
    statuses?: readonly string[];
    sequence?: number;
  }

  let { card, statuses = [], sequence = 0 }: Props = $props();

  const vfxUrl = new URL('./pack-assets/vfx/', document.baseURI).href;
  const LAUNCH_AT = 420;
  let elapsedMs = $state(0);
  let compact = $state(false);
  let viewportWidth = $state(1_440);
  let viewportHeight = $state(900);

  const vfx = $derived(resolveCardVfx(card));
  const damage = $derived(maxCardNumber(card.text, 'damage'));
  const healing = $derived(maxCardNumber(card.text, 'heal'));
  const intensity = $derived(Math.max(1, damage, healing));
  const accent = $derived(schoolColor(vfx.school));
  const profile = $derived(cardProjectileProfile(card));
  const ground = $derived(vfx.delivery === 'ground-aoe' || vfx.delivery === 'summon');
  const travelMs = $derived(Math.max(300, profile.flightMs));
  const impactAt = $derived(LAUNCH_AT + travelMs);
  const cycleMs = $derived(Math.max(3_400, impactAt + 1_900 + statuses.length * 120));
  const cycle = $derived(elapsedMs % cycleMs);
  const shotProgress = $derived(clamp((cycle - LAUNCH_AT) / travelMs, 0, 1));

  const castLayers = $derived(
    beatLayers(vfx.delivery, vfx.school, 'cast', {
      intensity,
      weapon: vfx.weapon
    })
  );
  const marqueeLayers = $derived(
    vfx.marquee
      ? beatLayers(vfx.delivery, vfx.school, 'marquee', {
          intensity,
          weapon: vfx.weapon
        })
      : []
  );
  const impactLayers = $derived(
    damage > 0
      ? beatLayers(vfx.delivery, vfx.school, 'impact', {
          intensity: damage,
          weapon: vfx.weapon
        })
      : healing > 0
        ? beatLayers(vfx.delivery, vfx.school, 'heal', {
            intensity: healing,
            weapon: vfx.weapon
          })
        : statuses.length > 0
          ? []
          : beatLayers(vfx.delivery, vfx.school, vfx.delivery === 'dash' ? 'dash' : 'impact', {
              intensity: 1,
              weapon: vfx.weapon
            })
  );
  const healingLayers = $derived(
    healing > 0 && damage > 0
      ? beatLayers(vfx.delivery, vfx.school, 'heal', {
          intensity: healing,
          weapon: vfx.weapon
        })
      : []
  );
  const statusLayerGroups = $derived(
    statuses.slice(0, 4).map((status) => ({
      status,
      layers: beatLayers(vfx.delivery, vfx.school, 'apply', {
        intensity,
        weapon: vfx.weapon,
        status
      })
    }))
  );

  const castFlipbooks = $derived(flipbooks(castLayers));
  const marqueeFlipbooks = $derived(flipbooks(marqueeLayers));
  const impactFlipbooks = $derived(flipbooks(impactLayers));
  const healingFlipbooks = $derived(flipbooks(healingLayers));
  const statusFlipbooks = $derived(
    statusLayerGroups.flatMap(({ status, layers }, statusIndex) =>
      flipbooks(layers).map((layer, layerIndex) => ({
        status,
        statusIndex,
        layerIndex,
        layer
      }))
    )
  );

  const sprayLayers = $derived.by(() => {
    const layers = [
      ...castLayers,
      ...marqueeLayers,
      ...impactLayers,
      ...healingLayers,
      ...statusLayerGroups.flatMap((group) => group.layers)
    ];
    return layers.filter((layer): layer is SprayLayer => layer.kind === 'spray');
  });

  const projectileAtlas = $derived(projectileSheetFor(vfx.school, vfx.weapon));
  const travels = $derived(
    vfx.delivery === 'projectile' ||
      (vfx.delivery === 'ground-aoe' && (card.range ?? 0) > 0) ||
      (vfx.school === 'Nature' &&
        !hasAreaShape(card) &&
        (vfx.delivery === 'heal' || vfx.delivery === 'debuff'))
  );

  const motes = $derived.by(() => {
    const count = Math.min(
      30,
      Math.max(
        12,
        Math.round(sprayLayers.reduce((sum, layer) => sum + Math.min(layer.count, 10), 0) * 0.42) +
          Math.round(vfx.scale * 4) +
          (vfx.marquee ? 4 : 0)
      )
    );
    const seedBase = stringSeed(card.id) + sequence * 97;
    return Array.from({ length: count }, (_, index) => {
      const layer = sprayLayers.length > 0 ? sprayLayers[index % sprayLayers.length] : undefined;
      const tint = !layer || layer.tint === 'school' ? accent : layer.tint;
      return {
        id: `${sequence}-${index}`,
        sprite: SPRITES[layer?.sprite ?? 'star'],
        tint,
        blend: layer?.blend ?? 'additive',
        bright: layer?.bright ?? 1,
        left: 43 + random(seedBase + index * 11) * 54,
        top: 17 + random(seedBase + index * 13) * 68,
        driftX: -70 + random(seedBase + index * 17) * 140,
        driftY: -55 - random(seedBase + index * 19) * 130,
        size: 12 + random(seedBase + index * 23) * (vfx.marquee ? 42 : 30),
        duration: 1_350 + random(seedBase + index * 29) * 1_700,
        delay: -random(seedBase + index * 31) * 2_600,
        rotate: Math.round(-150 + random(seedBase + index * 37) * 300)
      };
    });
  });

  onMount(() => {
    const layoutQuery = window.matchMedia('(max-width: 680px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    let lastPaint = 0;
    let startedAt = performance.now();

    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        elapsedMs = now - startedAt;
        lastPaint = now;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const stopAnimation = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const startAnimation = () => {
      stopAnimation();
      elapsedMs = 0;
      lastPaint = 0;
      startedAt = performance.now();
      animationFrame = window.requestAnimationFrame(tick);
    };

    const updateViewport = () => {
      compact = layoutQuery.matches;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
    };

    const updateMotion = () => {
      if (motionQuery.matches) {
        stopAnimation();
        elapsedMs = impactAt + 520;
      } else {
        startAnimation();
      }
    };

    updateViewport();
    updateMotion();
    layoutQuery.addEventListener('change', updateViewport);
    motionQuery.addEventListener('change', updateMotion);
    window.addEventListener('resize', updateViewport);

    return () => {
      stopAnimation();
      layoutQuery.removeEventListener('change', updateViewport);
      motionQuery.removeEventListener('change', updateMotion);
      window.removeEventListener('resize', updateViewport);
    };
  });

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function random(seed: number) {
    const value = Math.sin(seed * 83.117) * 43_758.5453;
    return value - Math.floor(value);
  }

  function stringSeed(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function flipbooks(layers: readonly Layer[]): FlipbookLayer[] {
    return layers.filter((layer): layer is FlipbookLayer => layer.kind === 'flipbook');
  }

  function layerTint(layer: FlipbookLayer) {
    return layer.tint === 'school' ? accent : layer.tint;
  }

  function layerLifeMs(layer: FlipbookLayer, layerIntensity = 1) {
    const intensityGain = Math.min(1.5, 1 + 0.05 * Math.max(0, layerIntensity - 1));
    return Math.max(160, layer.life * intensityGain * 1_000);
  }

  function atlasFrameStyle(
    atlas: { file: string; cols: number; rows: number; frames: number },
    progress: number,
    tint: string | null = null
  ) {
    const frame = Math.min(
      atlas.frames - 1,
      Math.floor(clamp(progress, 0, 0.999_999) * atlas.frames)
    );
    const column = frame % atlas.cols;
    const row = Math.floor(frame / atlas.cols);
    const x = atlas.cols <= 1 ? 0 : (column / (atlas.cols - 1)) * 100;
    const y = atlas.rows <= 1 ? 0 : (row / (atlas.rows - 1)) * 100;
    const image = `url('${vfxUrl}sheets/${atlas.file}')`;
    const size = `${atlas.cols * 100}% ${atlas.rows * 100}%`;

    if (tint) {
      return [
        `background-color:${tint}`,
        `-webkit-mask-image:${image}`,
        `mask-image:${image}`,
        `-webkit-mask-size:${size}`,
        `mask-size:${size}`,
        `-webkit-mask-position:${x}% ${y}%`,
        `mask-position:${x}% ${y}%`,
        '-webkit-mask-repeat:no-repeat',
        'mask-repeat:no-repeat'
      ].join(';');
    }

    return [
      `background-image:${image}`,
      `background-size:${size}`,
      `background-position:${x}% ${y}%`
    ].join(';');
  }

  type EffectRole = 'cast' | 'marquee' | 'impact' | 'healing' | 'status';

  function effectWidth(layer: FlipbookLayer, role: EffectRole, layerIntensity = 1) {
    const base = {
      cast: 330,
      marquee: 390,
      impact: 390,
      healing: 260,
      status: 170
    }[role];
    const worldSize =
      (layer.size + (layer.growth ?? 0) * Math.max(0, layerIntensity - 1)) * vfx.scale;
    const multiplier = clamp(worldSize / 2.1, 0.52, 1.85);
    return `min(${Math.round(base * multiplier)}px,var(--${role}-max))`;
  }

  function flipbookStyle(
    layer: FlipbookLayer,
    start: number,
    role: EffectRole,
    layerIntensity = 1
  ) {
    const sheet = SHEETS[layer.sheet];
    const life = layerLifeMs(layer, layerIntensity);
    const localMs = cycle - start;
    const tint = layerTint(layer);
    const frameStyle = atlasFrameStyle(sheet, localMs / life, layer.native ? null : tint);
    const glow = layer.native ? 'rgba(255,255,255,0.68)' : tint;
    return [
      frameStyle,
      `opacity:${windowOpacity(cycle, start, start + life * 0.76, start + life + 150)}`,
      `width:${effectWidth(layer, role, layerIntensity)}`,
      `--layer-glow:${glow}`,
      `--layer-bright:${clamp(layer.bright ?? 1, 0.7, 2.5)}`
    ].join(';');
  }

  function projectileFrameStyle(atlas: ProjectileSheet | null, progress: number) {
    if (!atlas) return '';
    return atlasFrameStyle(atlas, progress);
  }

  function windowOpacity(time: number, start: number, holdUntil: number, end: number) {
    if (time < start || time > end) return 0;
    if (time < start + 120) return clamp((time - start) / 120, 0, 1);
    if (time > holdUntil) return clamp((end - time) / Math.max(1, end - holdUntil), 0, 1);
    return 1;
  }

  function flightPoints() {
    const start = compact ? { x: 20, y: 74 } : { x: 35, y: 70 };
    const end = ground
      ? compact
        ? { x: 82, y: 68 }
        : { x: 78, y: 64 }
      : compact
        ? { x: 88, y: 44 }
        : { x: 82, y: 30 };
    return { start, end };
  }

  function shotPosition(progress: number) {
    const { start, end } = flightPoints();
    if (profile.motion === 'drop') {
      return {
        x: end.x,
        y: -8 + progress * (end.y + 8),
        angle: 90
      };
    }
    const arcStrength = compact
      ? ground
        ? -14
        : 18 + profile.arc * 3
      : profile.arc * 4.2;
    const arc = Math.sin(progress * Math.PI) * arcStrength;
    const pixelDx = ((end.x - start.x) / 100) * viewportWidth;
    const pixelDy = ((end.y - start.y) / 100) * viewportHeight;
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress - arc,
      angle: Math.atan2(pixelDy, pixelDx) * (180 / Math.PI)
    };
  }

  function projectileStyle() {
    const position = shotPosition(shotProgress);
    return [
      projectileFrameStyle(projectileAtlas, shotProgress),
      `left:${position.x}%`,
      `top:${position.y}%`,
      `opacity:${windowOpacity(cycle, LAUNCH_AT - 70, impactAt - 60, impactAt + 80)}`,
      `transform:translate(-50%,-50%) rotate(${position.angle}deg) scale(${0.82 + vfx.scale * 0.18})`
    ].join(';');
  }

  function beamStyle() {
    const { start, end } = flightPoints();
    const pixelDx = ((end.x - start.x) / 100) * viewportWidth;
    const pixelDy = ((end.y - start.y) / 100) * viewportHeight;
    const length = Math.hypot(pixelDx, pixelDy);
    const angle = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI);
    return [
      `left:${start.x}%`,
      `top:${start.y}%`,
      `width:${length}px`,
      `opacity:${windowOpacity(cycle, LAUNCH_AT, impactAt + 120, impactAt + 360)}`,
      `transform:translateY(-50%) rotate(${angle}deg)`
    ].join(';');
  }

  function statusPosition(statusIndex: number) {
    const { end } = flightPoints();
    const count = Math.max(1, Math.min(statuses.length, 4));
    const offset = statusIndex - (count - 1) / 2;
    if (compact) {
      return {
        x: clamp(end.x - 9, 12, 88),
        y: clamp(end.y + offset * 12, 13, 88)
      };
    }
    return {
      x: clamp(end.x + offset * 10, 50, 95),
      y: clamp(end.y - (ground ? 9 : 5), 12, 82)
    };
  }

  function statusStyle(layer: FlipbookLayer, statusIndex: number, layerIndex: number) {
    const position = statusPosition(statusIndex);
    const start = impactAt + 180 + statusIndex * 120 + layerIndex * 25;
    return [
      flipbookStyle(layer, start, 'status', 1),
      `left:${position.x}%`,
      `top:${position.y}%`
    ].join(';');
  }
</script>

<div class="ability-backdrop" class:ground style:--ability-color={accent} aria-hidden="true">
  <span class="ability-wash"></span>

  {#each motes as mote (mote.id)}
    <span
      class="mote"
      class:normal-blend={mote.blend === 'normal'}
      style={`--mote-left:${mote.left}%;--mote-top:${mote.top}%;--mote-x:${mote.driftX}px;--mote-y:${mote.driftY}px;--mote-size:${mote.size}px;--mote-duration:${mote.duration}ms;--mote-delay:${mote.delay}ms;--mote-rotate:${mote.rotate}deg;--mote-tint:${mote.tint};--mote-bright:${mote.bright};--mote-sprite:url('${vfxUrl}particles/${mote.sprite}')`}
    ></span>
  {/each}

  {#each marqueeFlipbooks as layer, index (`marquee-${layer.sheet}-${index}`)}
    <span
      class="flipbook marquee"
      class:normal-blend={layer.blend === 'normal'}
      style={flipbookStyle(layer, index * 25, 'marquee', 1)}
    ></span>
  {/each}

  {#each castFlipbooks as layer, index (`cast-${layer.sheet}-${index}`)}
    <span
      class="flipbook cast"
      class:normal-blend={layer.blend === 'normal'}
      style={flipbookStyle(layer, index * 25, 'cast', 1)}
    ></span>
  {/each}

  {#if travels && profile.motion === 'beam'}
    <span class="ability-beam" style={beamStyle()}></span>
  {:else if travels}
    <span class:soft-bolt={!projectileAtlas} class="projectile" style={projectileStyle()}></span>
  {/if}

  {#each impactFlipbooks as layer, index (`impact-${layer.sheet}-${index}`)}
    <span
      class="flipbook impact"
      class:flat={layer.ground}
      class:normal-blend={layer.blend === 'normal'}
      style={flipbookStyle(layer, impactAt + index * 35, 'impact', intensity)}
    ></span>
  {/each}

  {#if vfx.repeat > 1}
    {#each impactFlipbooks as layer, index (`echo-${layer.sheet}-${index}`)}
      <span
        class="flipbook impact echo"
        class:flat={layer.ground}
        class:normal-blend={layer.blend === 'normal'}
        style={flipbookStyle(layer, impactAt + 180 + index * 35, 'impact', intensity)}
      ></span>
    {/each}
  {/if}

  {#each healingFlipbooks as layer, index (`healing-${layer.sheet}-${index}`)}
    <span
      class="flipbook healing"
      class:normal-blend={layer.blend === 'normal'}
      style={flipbookStyle(layer, impactAt + 130 + index * 30, 'healing', healing)}
    ></span>
  {/each}

  {#each statusFlipbooks as item (`${item.status}-${item.layer.sheet}-${item.layerIndex}`)}
    <span
      class="flipbook status"
      class:normal-blend={item.layer.blend === 'normal'}
      style={statusStyle(item.layer, item.statusIndex, item.layerIndex)}
    ></span>
  {/each}

  <span
    class="shockwave"
    style:opacity={windowOpacity(cycle, impactAt - 30, impactAt + 310, impactAt + 650)}
  ></span>
</div>

<style>
  .ability-backdrop {
    --cast-x: 35%;
    --cast-y: 70%;
    --impact-x: 82%;
    --impact-y: 30%;
    --echo-x: 77%;
    --echo-y: 38%;
    --healing-x: 74%;
    --healing-y: 35%;
    --cast-max: 38vw;
    --marquee-max: 44vw;
    --impact-max: 48vw;
    --healing-max: 29vw;
    --status-max: 12vw;
    position: fixed;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .ability-wash {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        circle at var(--impact-x) var(--impact-y),
        color-mix(in srgb, var(--ability-color) 24%, transparent),
        transparent 34%
      ),
      linear-gradient(
        132deg,
        transparent 35%,
        color-mix(in srgb, var(--ability-color) 8%, transparent) 66%,
        transparent 85%
      );
    mix-blend-mode: screen;
    opacity: 0.82;
  }

  .flipbook,
  .projectile {
    position: absolute;
    display: block;
    aspect-ratio: 1;
    background-repeat: no-repeat;
    filter: brightness(var(--layer-bright, 1))
      drop-shadow(0 0 24px var(--layer-glow, var(--ability-color)));
    mix-blend-mode: screen;
    will-change: background-position, opacity, transform;
  }

  .normal-blend {
    mix-blend-mode: normal;
  }

  .cast {
    top: var(--cast-y);
    left: var(--cast-x);
    transform: translate(-50%, -50%);
  }

  .marquee {
    top: var(--cast-y);
    left: var(--cast-x);
    transform: translate(-50%, -50%);
  }

  .impact {
    top: var(--impact-y);
    left: var(--impact-x);
    transform: translate(-50%, -50%);
  }

  .impact.flat {
    transform: translate(-50%, -50%) rotateX(48deg) scaleY(0.82);
  }

  .impact.echo {
    top: var(--echo-y);
    left: var(--echo-x);
    filter: brightness(var(--layer-bright, 1))
      drop-shadow(0 0 32px var(--layer-glow, var(--ability-color)));
  }

  .impact.echo.flat {
    transform: translate(-50%, -50%) rotateX(48deg) scaleY(0.82);
  }

  .healing {
    top: var(--healing-y);
    left: var(--healing-x);
    transform: translate(-50%, -50%);
  }

  .status {
    transform: translate(-50%, -50%);
  }

  .projectile {
    width: min(175px, 19vw);
    transition: opacity 30ms linear;
  }

  .projectile.soft-bolt {
    width: min(82px, 10vw);
    border-radius: 50%;
    background:
      radial-gradient(circle, white 0 9%, var(--ability-color) 24%, transparent 70%),
      url('../../../pack-assets/vfx/particles/orb.png') center / contain no-repeat;
    box-shadow:
      0 0 24px var(--ability-color),
      0 0 70px color-mix(in srgb, var(--ability-color) 60%, transparent);
  }

  .ability-beam {
    position: absolute;
    height: clamp(8px, 1.6vw, 22px);
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--ability-color) 65%, white),
      white 62%,
      var(--ability-color),
      transparent
    );
    box-shadow:
      0 0 18px white,
      0 0 44px var(--ability-color),
      0 0 90px color-mix(in srgb, var(--ability-color) 72%, transparent);
    mix-blend-mode: screen;
    transform-origin: left center;
  }

  .shockwave {
    position: absolute;
    top: var(--impact-y);
    left: var(--impact-x);
    width: min(440px, 44vw);
    aspect-ratio: 1;
    border: 2px solid color-mix(in srgb, var(--ability-color) 82%, white);
    border-radius: 50%;
    box-shadow:
      0 0 30px var(--ability-color),
      inset 0 0 34px color-mix(in srgb, var(--ability-color) 64%, transparent);
    mix-blend-mode: screen;
    transform: translate(-50%, -50%) scale(0.86);
  }

  .ground .shockwave {
    transform: translate(-50%, -50%) scaleY(0.38);
  }

  .ground {
    --impact-x: 78%;
    --impact-y: 64%;
    --echo-x: 72%;
    --echo-y: 59%;
    --healing-x: 72%;
    --healing-y: 58%;
  }

  .mote {
    position: absolute;
    top: var(--mote-top);
    left: var(--mote-left);
    width: var(--mote-size);
    height: var(--mote-size);
    background: var(--mote-tint);
    -webkit-mask: var(--mote-sprite) center / contain no-repeat;
    mask: var(--mote-sprite) center / contain no-repeat;
    filter: brightness(var(--mote-bright, 1)) drop-shadow(0 0 10px var(--mote-tint));
    mix-blend-mode: screen;
    opacity: 0;
    animation: ability-mote var(--mote-duration) ease-out var(--mote-delay) infinite;
  }

  .mote.normal-blend {
    mix-blend-mode: normal;
  }

  @keyframes ability-mote {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.2) rotate(0);
    }
    18% {
      opacity: 0.72;
    }
    70% {
      opacity: 0.42;
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--mote-x)), calc(-50% + var(--mote-y))) scale(1.16)
        rotate(var(--mote-rotate));
    }
  }

  @media (max-width: 680px) {
    .ability-backdrop {
      --cast-x: 20%;
      --cast-y: 74%;
      --impact-x: 88%;
      --impact-y: 44%;
      --echo-x: 82%;
      --echo-y: 51%;
      --healing-x: 80%;
      --healing-y: 48%;
      --cast-max: 54vw;
      --marquee-max: 62vw;
      --impact-max: 64vw;
      --healing-max: 46vw;
      --status-max: 29vw;
      opacity: 0.62;
    }

    .ability-backdrop.ground {
      --impact-x: 82%;
      --impact-y: 68%;
      --echo-x: 76%;
      --echo-y: 63%;
      --healing-x: 77%;
      --healing-y: 64%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mote,
    .projectile,
    .ability-beam,
    .shockwave,
    .marquee {
      display: none;
    }

    .ability-backdrop {
      opacity: 0.46;
    }
  }
</style>
