<script lang="ts">
  // DEXPit's brand button: a true 60-degree pointy hexagon (flat top/bottom,
  // points left + right) with a blackened-steel finish. ONE component keeps
  // the silhouette and material consistent across the game.
  //
  // Rules (see project_hex_button_brand):
  //   - Shape = identity, colour = role. The silhouette never changes for state.
  //     role: primary (split-forge: scarlet face + violet halo) |
  //     neutral (gunmetal + silver) | destructive (deep crimson threat).
  //     Disabled goes flat + dead.
  //   - The 60-degree angle is locked: the point inset is derived from the height
  //     (height x 0.2887) via --hx-cut, so it holds at every size.
  //   - Forged finish: a bevelled silver rim (gradient wrapper) + a struck, top-lit
  //     face (layered sheen gradient + inset highlight/shadow) + an embossed
  //     label. Hover lifts + blooms with a light sheen sweep; press sinks.
  //   - Motion is transform/opacity/filter only. prefers-reduced-motion drops the
  //     sweep + lift; the low-power tier drops the glow + sweep (keeps it smooth).
  import type { Snippet } from 'svelte';

  type Role = 'primary' | 'neutral' | 'destructive';
  type Size = 'sm' | 'md' | 'lg';

  interface Props {
    role?: Role;
    /** Ember-gold action treatment. Legacy consumers retain their existing palette. */
    tone?: 'ember';
    size?: Size;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    /** Pulse the rim to draw the eye (a hero call-to-action only). */
    pulse?: boolean;
    /** Stretch to the container width. */
    full?: boolean;
    /** Focus on mount (confirm dialogs). */
    autofocus?: boolean;
    /** An arbitrary rim colour (CSS colour) - e.g. a class colour or provider brand. Recolours the bevel only; the face stays role-driven for legibility. */
    accent?: string;
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
    onclick?: (e: MouseEvent) => void;
    onpointerenter?: (e: PointerEvent) => void;
    onpointerdown?: (e: PointerEvent) => void;
    onfocus?: (e: FocusEvent) => void;
    /** Extra classes for positioning/layout from the consumer (shape stays ours). */
    class?: string;
    children: Snippet;
  }

  let {
    role = 'neutral',
    tone,
    size = 'md',
    disabled = false,
    type = 'button',
    pulse = false,
    full = false,
    autofocus = false,
    accent,
    title,
    ariaLabel,
    ariaPressed,
    onclick,
    onpointerenter,
    onpointerdown,
    onfocus,
    class: klass = '',
    children
  }: Props = $props();

  // The low-power render tier (auto-detected or forced in Settings) drops the
  // glow + sheen so weak devices stay smooth. Reactive to settings.quality.
  const lowFx = $derived(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
</script>

<!-- svelte-ignore a11y_autofocus -->
<button
  class="hexbtn {klass}"
  class:pulse={pulse && !disabled}
  class:lowfx={lowFx}
  class:full
  class:accented={!!accent}
  class:ember={tone === 'ember'}
  data-role={role}
  data-size={size}
  style:--hx-accent={accent}
  {type}
  {disabled}
  {title}
  autofocus={autofocus}
  aria-label={ariaLabel}
  aria-pressed={ariaPressed}
  onclick={onclick}
  onpointerenter={onpointerenter}
  onpointerdown={onpointerdown}
  onfocus={onfocus}
>
  <span class="face">
    <span class="sheen" aria-hidden="true"></span>
    <span class="label">{@render children()}</span>
  </span>
</button>

<style>
  /* The button element is the bevelled forged-silver rim, clipped to the
     hexagon, with a sliver of padding so the rim
     shows around the face. --hx-cut derives the 60-degree point from the height. */
  .hexbtn {
    --hx-h: 48px;
    --hx-focus: rgba(201, 121, 255, 0.96);
    --hx-cut: calc(var(--hx-h) * 0.2887);
    --hx-clip: polygon(
      var(--hx-cut) 0,
      calc(100% - var(--hx-cut)) 0,
      100% 50%,
      calc(100% - var(--hx-cut)) 100%,
      var(--hx-cut) 100%,
      0 50%
    );
    position: relative;
    isolation: isolate;
    display: inline-flex;
    box-sizing: border-box;
    height: var(--hx-h);
    padding: 2px;
    border: 0;
    background:
      linear-gradient(163deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 24%),
      linear-gradient(101deg, #312a36 0%, #d8d3dc 14%, #766d7d 39%, #eeeaf0 51%, #5a4e60 72%, #211a26 100%);
    clip-path: var(--hx-clip);
    cursor: pointer;
    filter: drop-shadow(0 2px 1px rgba(255, 255, 255, 0.08)) drop-shadow(0 4px 5px rgba(0, 0, 0, 0.72));
    transition: transform 0.16s cubic-bezier(0.2, 0.75, 0.3, 1), filter 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    /* Kill the 300ms tap delay + double-tap zoom so every button (menus, hub,
       in-match HUD) fires on first touch. A core mobile responsiveness fix. */
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
  }
  .hexbtn.full { display: flex; width: 100%; }
  .hexbtn.ember {
    --hx-focus: #ffcc80;
    --hx-primary-rim: linear-gradient(101deg, #2e1c06 0%, #ffe0a8 13%, #b2893f 31%, #fff6e2 50%, #a97a33 71%, #2a1705 100%);
    --hx-primary-sheen: rgba(255, 218, 145, 0.34);
    --hx-primary-face: linear-gradient(178deg, #ad661e 0%, #79400e 45%, #4d2609 72%, #241104 100%);
    --hx-primary-glow: rgba(230, 145, 43, 0.46);
    --hx-primary-hover: rgba(255, 184, 76, 0.68);
    --hx-pulse-low: rgba(230, 145, 43, 0.4);
    --hx-pulse-high: rgba(255, 184, 76, 0.72);
  }

  /* The struck, top-lit metal face. The first background layer is the top sheen;
     the second is the role body gradient. Inset shadows read as lit/concave. */
  .face {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0 calc(var(--hx-cut) + 6px);
    clip-path: var(--hx-clip);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.32),
      inset 0 8px 11px -9px rgba(255, 255, 255, 0.5),
      inset 0 -13px 14px -10px rgba(0, 0, 0, 0.72),
      inset 1px 0 0 rgba(255, 255, 255, 0.07),
      inset -1px 0 0 rgba(0, 0, 0, 0.34),
      inset 0 0 0 1px rgba(255, 255, 255, 0.045);
    transition: box-shadow 0.16s ease, filter 0.16s ease;
  }

  /* Uneven bloom and two shallow score marks keep the face from reading like
     a mathematically perfect UI gradient. They stay static and very faint. */
  .face::before {
    content: '';
    position: absolute;
    z-index: 0;
    inset: 1px;
    background:
      linear-gradient(108deg, transparent 0 17%, rgba(255, 255, 255, 0.12) 17.5%, transparent 18.3%),
      linear-gradient(73deg, transparent 0 72%, rgba(0, 0, 0, 0.2) 72.5%, transparent 73.2%),
      radial-gradient(ellipse at 19% 8%, rgba(255, 255, 255, 0.13), transparent 34%),
      radial-gradient(ellipse at 83% 91%, rgba(0, 0, 0, 0.24), transparent 39%);
    opacity: 0.62;
    mix-blend-mode: soft-light;
    pointer-events: none;
  }

  .face::after {
    content: '';
    position: absolute;
    z-index: 2;
    inset: 1px;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 8%, transparent 91%, rgba(0, 0, 0, 0.22)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 18%, transparent 76%, rgba(0, 0, 0, 0.22));
    clip-path: var(--hx-clip);
    pointer-events: none;
  }

  .label {
    position: relative;
    z-index: 3;
    display: inline-flex;
    font-family: var(--font-ui, 'Rajdhani', system-ui, sans-serif);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    line-height: 1;
    transition: transform 0.16s cubic-bezier(0.2, 0.75, 0.3, 1), text-shadow 0.16s ease;
  }

  /* A diagonal light band parked off the left edge; on hover it sweeps across. */
  .sheen {
    position: absolute;
    z-index: 1;
    top: -35%;
    left: -58%;
    width: 28%;
    height: 160%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1) 24%, rgba(255, 255, 255, 0.46) 50%, rgba(255, 255, 255, 0.08) 76%, transparent);
    transform: skewX(-14deg);
    transition: left 0.52s cubic-bezier(0.38, 0.08, 0.22, 1);
    pointer-events: none;
  }

  /* ---- sizes ---- */
  .hexbtn[data-size='sm'] { --hx-h: 36px; }
  .hexbtn[data-size='sm'] .label { font-size: 12px; }
  .hexbtn[data-size='md'] { --hx-h: 48px; }
  .hexbtn[data-size='md'] .label { font-size: 15px; }
  .hexbtn[data-size='lg'] { --hx-h: 60px; }
  .hexbtn[data-size='lg'] .label { font-size: 20px; }

  /* ---- roles ---- */
  /* Primary: the split-forge signature. A scarlet-heat face sits inside a rim
     that carries opposing scarlet and violet light across forged silver (the
     logo reference: silver DEX, scarlet Pit, violet arena core), haloed by a
     restrained Pit Violet glow. Destructive stays a far darker, violet-free
     crimson, so the two never read alike at a glance.
     Canon: brand-brief.md "Button & chip system" - Primary / CTA action colour
     = scarlet with a restrained violet edge/halo. */
  .hexbtn[data-role='primary'] {
    background:
      linear-gradient(164deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0) 23%),
      var(
        --hx-primary-rim,
        linear-gradient(101deg, #2a0f14 0%, #ffb9a8 13%, #b4707a 31%, #f6f2f8 50%, #8a6bbf 71%, #2b1040 100%)
      );
    filter: drop-shadow(0 4px 5px rgba(0, 0, 0, 0.72)) drop-shadow(0 0 14px var(--hx-primary-glow, rgba(118, 34, 216, 0.46)));
  }
  .hexbtn[data-role='primary'] .face {
    background:
      radial-gradient(ellipse at 24% 0%, var(--hx-primary-sheen, rgba(255, 190, 170, 0.3)), transparent 40%),
      var(--hx-primary-face, linear-gradient(178deg, #f0402f 0%, #a81520 34%, #560d15 66%, #1e060a 100%));
  }
  .hexbtn[data-role='primary'] .label {
    color: var(--steel-bright, #f5f5fa);
    text-shadow: 0 1px 2px rgba(26, 4, 7, 0.95), 0 0 4px rgba(74, 8, 16, 0.7);
  }

  /* Neutral: cool blackened iron, silver rim. */
  .hexbtn[data-role='neutral'] .face {
    background:
      radial-gradient(ellipse at 21% 0%, rgba(232, 229, 236, 0.16), transparent 42%),
      linear-gradient(178deg, #352641 0%, #21172b 47%, #130d19 73%, #07050a 100%);
  }
  .hexbtn[data-role='neutral'] .label {
    color: var(--steel, #d7d7e2);
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.8);
  }

  /* Destructive: a deep, grim crimson threat signal with no violet in it,
     reserved for irreversible actions. Darker and flatter than primary. */
  .hexbtn[data-role='destructive'] {
    background:
      linear-gradient(163deg, rgba(255, 218, 200, 0.58), transparent 25%),
      linear-gradient(102deg, #501014 0%, #f48666 15%, #a32329 43%, #e25c4b 53%, #77131c 76%, #2a090d 100%);
  }
  .hexbtn[data-role='destructive'] .face {
    background:
      radial-gradient(ellipse at 23% 0%, rgba(255, 113, 96, 0.24), transparent 40%),
      linear-gradient(178deg, #641019 0%, #390a11 48%, #1c070b 75%, #08060c 100%);
  }
  .hexbtn[data-role='destructive'] .label {
    color: #ffd0ca;
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.8);
  }

  /* Accent: recolour the bevelled rim from any colour (class colour, provider
     brand) while the face keeps its role fill/text for legibility. */
  .hexbtn.accented {
    --hx-focus: color-mix(in srgb, var(--hx-accent) 78%, #fff);
    background:
      linear-gradient(163deg, rgba(255, 255, 255, 0.54), transparent 25%),
      linear-gradient(
        101deg,
        color-mix(in srgb, var(--hx-accent) 42%, #111) 0%,
        color-mix(in srgb, var(--hx-accent) 66%, #fff) 15%,
        color-mix(in srgb, var(--hx-accent) 82%, #24202a) 40%,
        color-mix(in srgb, var(--hx-accent) 54%, #fff) 53%,
        color-mix(in srgb, var(--hx-accent) 70%, #09070b) 77%,
        color-mix(in srgb, var(--hx-accent) 30%, #050407) 100%
      );
  }
  .hexbtn.accented:hover:not(:disabled) {
    filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.7))
      drop-shadow(0 0 14px color-mix(in srgb, var(--hx-accent) 55%, transparent)) brightness(1.07);
  }

  /* ---- states ---- */
  .hexbtn:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.1)) drop-shadow(0 6px 7px rgba(0, 0, 0, 0.74)) brightness(1.07);
  }
  .hexbtn[data-role='primary']:hover:not(:disabled) {
    filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 22px var(--hx-primary-hover, rgba(182, 76, 255, 0.68))) brightness(1.08);
  }
  .hexbtn[data-role='destructive']:hover:not(:disabled) {
    filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 14px rgba(242, 58, 44, 0.6));
  }
  .hexbtn:hover:not(:disabled) .sheen { left: 130%; }
  .hexbtn:hover:not(:disabled) .face {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      inset 0 10px 12px -10px rgba(255, 255, 255, 0.58),
      inset 0 -13px 14px -10px rgba(0, 0, 0, 0.7),
      inset 1px 0 0 rgba(255, 255, 255, 0.08),
      inset -1px 0 0 rgba(0, 0, 0, 0.35),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .hexbtn:hover:not(:disabled) .label { transform: translateY(-0.5px); }
  .hexbtn:active:not(:disabled) {
    transform: translateY(1px);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.62)) brightness(0.94);
  }
  .hexbtn:active:not(:disabled) .face {
    box-shadow:
      inset 0 3px 6px rgba(0, 0, 0, 0.48),
      inset 0 -1px 0 rgba(255, 255, 255, 0.12),
      inset 1px 0 0 rgba(255, 255, 255, 0.04),
      inset -1px 0 0 rgba(0, 0, 0, 0.32);
  }
  .hexbtn:active:not(:disabled) .label { transform: translateY(1px); }

  .hexbtn:disabled {
    cursor: not-allowed;
    background: linear-gradient(180deg, #4b4550 0%, #2c2730 60%, #18151b 100%);
    filter: none;
  }
  .hexbtn:disabled .face {
    background: linear-gradient(180deg, #1c1820, #100e12 65%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
  }
  .hexbtn:disabled .label { color: #625d68; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.7); }
  .hexbtn:disabled .sheen { display: none; }

  /* Keyboard / controller focus: a violet energy ring. */
  .hexbtn:focus-visible {
    outline: none;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 1px var(--hx-focus)) drop-shadow(0 0 5px var(--hx-focus));
  }

  /* Hero pulse (opt-in): a slow, restrained rim breathe. */
  .hexbtn.pulse:not(:disabled) { animation: hx-pulse 2.6s ease-in-out infinite; }
  @keyframes hx-pulse {
    0%, 100% { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 10px var(--hx-pulse-low, rgba(118, 34, 216, 0.4))); }
    50% { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 20px var(--hx-pulse-high, rgba(182, 76, 255, 0.72))); }
  }

  /* Low-power tier: keep the shape + rim, drop the glow + sweep. */
  .hexbtn.lowfx { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6)); animation: none; }
  .hexbtn.lowfx:hover:not(:disabled) { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.6)) brightness(1.08); }
  .hexbtn.lowfx .sheen { display: none; }
  .hexbtn.lowfx .face::before { opacity: 0.34; }
  .hexbtn.lowfx:focus-visible {
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 1px var(--hx-focus)) drop-shadow(0 0 4px var(--hx-focus));
  }

  @media (prefers-reduced-motion: reduce) {
    .hexbtn { transition: filter 0.2s ease; }
    .hexbtn:hover:not(:disabled) { transform: none; }
    .hexbtn:active:not(:disabled) { transform: none; }
    .hexbtn.pulse { animation: none; }
    .sheen { display: none; }
    .hexbtn:hover:not(:disabled) .label,
    .hexbtn:active:not(:disabled) .label { transform: none; }
  }
</style>
