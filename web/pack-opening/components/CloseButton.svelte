<script lang="ts">
  // Shared modal / window dismiss control. ONE source of truth for the close
  // affordance so every surface a player can close meets the same standard: a
  // >=44px touch target (48 on coarse pointers) with a clearly visible icon
  // (20px, 24px on touch) - mobile pass AND desktop pass. The hit area is
  // bigger than the glyph on purpose, so a near-miss tap still closes.
  //
  // Position-agnostic: it sits inline (a flex-header child) by default. A parent
  // that needs to place or nudge it targets the global class, e.g.
  //   .my-head :global(.close-btn) { position: absolute; top: 6px; right: 6px; }
  import { uiSfx } from '$lib/audio/ui-sfx';
  import type { SfxName } from '$lib/audio/sfx';

  interface Props {
    onClose: () => void;
    /** Accessible label. Defaults to "Close"; some callers say "Cancel match". */
    label?: string;
    /** Click sound (also gives the standard hover rollover). */
    sound?: SfxName;
    /** Optional extra class for caller-side spacing / overrides. */
    class?: string;
  }
  let { onClose, label = 'Close', sound = 'fail', class: extra = '' }: Props = $props();
</script>

<button
  type="button"
  class="close-btn {extra}"
  aria-label={label}
  title={label}
  use:uiSfx={sound}
  onclick={onClose}
>
  <img class="close-x" src="./pack-assets/icons/ui/close.png" alt="" />
</button>

<style>
  .close-btn {
    position: relative;
    flex-shrink: 0;
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    /* Pull the bigger hit box back so it doesn't bloat tight headers; the icon
       stays where a 18px close used to sit, but the tappable area is full-size. */
    margin: -10px -10px -10px 0;
    padding: 0;
    background: radial-gradient(circle, rgba(117, 24, 30, 0.09) 0%, rgba(37, 8, 13, 0.035) 45%, transparent 70%);
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .close-btn::before {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, rgba(255, 137, 95, 0.12), rgba(84, 12, 18, 0.09) 48%, transparent 72%);
    box-shadow: inset 0 1px 0 rgba(255, 209, 173, 0.05);
    opacity: 0.38;
    transform: scale(0.88);
    transition: opacity 140ms ease, transform 140ms ease, box-shadow 140ms ease;
    pointer-events: none;
  }
  .close-x {
    position: relative;
    z-index: 1;
    width: 22px;
    height: 22px;
    object-fit: contain;
    display: block;
    opacity: 0.86;
    filter: saturate(0.86) drop-shadow(0 -1px 0 rgba(255, 213, 167, 0.28)) drop-shadow(0 2px 2px rgba(17, 3, 6, 0.82));
    transition: opacity 140ms ease, transform 140ms cubic-bezier(0.2, 0.75, 0.3, 1), filter 140ms ease;
  }
  .close-btn:hover::before,
  .close-btn:focus-visible::before {
    opacity: 1;
    transform: scale(1);
    box-shadow: inset 0 1px 0 rgba(255, 209, 173, 0.1), 0 0 10px rgba(191, 39, 39, 0.12);
  }
  .close-btn:hover .close-x,
  .close-btn:focus-visible .close-x {
    opacity: 1;
    filter: saturate(1.02) brightness(1.06) drop-shadow(0 -1px 0 rgba(255, 222, 181, 0.35)) drop-shadow(0 3px 3px rgba(17, 3, 6, 0.86));
    transform: translateY(-1px) rotate(2deg) scale(1.06);
  }
  .close-btn:active .close-x {
    filter: saturate(0.9) brightness(0.9) drop-shadow(0 1px 1px rgba(17, 3, 6, 0.8));
    transform: translateY(1px) scale(0.92);
  }
  .close-btn:active::before {
    opacity: 0.66;
    transform: scale(0.84);
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.34);
  }
  .close-btn:focus-visible {
    outline: 2px solid rgba(206, 144, 240, 0.92);
    outline-offset: -5px;
    border-radius: 50%;
  }
  /* Touch / coarse pointer: bigger target, bigger glyph, more present at rest. */
  @media (hover: none), (pointer: coarse) {
    .close-btn {
      width: 48px;
      height: 48px;
      margin: -10px -8px -10px 0;
    }
    .close-x {
      width: 26px;
      height: 26px;
      opacity: 0.95;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .close-btn:hover .close-x,
    .close-btn:focus-visible .close-x,
    .close-btn:active .close-x {
      transform: none;
    }
    .close-btn::before { transition: opacity 140ms ease, box-shadow 140ms ease; }
    .close-btn:hover::before,
    .close-btn:focus-visible::before,
    .close-btn:active::before { transform: none; }
  }
</style>
