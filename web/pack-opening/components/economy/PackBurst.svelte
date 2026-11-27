<script lang="ts">
  const particleUrl = new URL('./pack-assets/vfx/particles/', document.baseURI).href;

  import { schoolColor } from '$lib/theme/school-colors';
  import { PACK_RARITY_COLOR, PACK_RARITY_RANK, type PackRarity } from '$lib/economy/pack-opening';

  interface Props {
    burstId: number;
    rarity?: PackRarity;
    school?: string | null;
    kind?: 'tear' | 'reveal';
    originX?: string;
    originY?: string;
  }

  let {
    burstId,
    rarity = 'Common',
    school = 'Physical',
    kind = 'reveal',
    originX = '50vw',
    originY = '50vh'
  }: Props = $props();

  function random(seed: number) {
    const x = Math.sin(seed * 91.773 + burstId * 13.117) * 43758.5453;
    return x - Math.floor(x);
  }

  const particles = $derived.by(() => {
    const count = kind === 'tear' ? 30 : 24 + PACK_RARITY_RANK[rarity] * 14;
    const distance = kind === 'tear' ? 300 : 190 + PACK_RARITY_RANK[rarity] * 65;
    const sprites = ['spark', 'ember', 'star', 'magic', 'light', 'smoke'];
    return Array.from({ length: count }, (_, index) => {
      const angle = random(index + 1) * Math.PI * 2;
      const reach = distance * (0.46 + random(index + 31) * 0.62);
      return {
        id: index,
        x: Math.cos(angle) * reach,
        y: Math.sin(angle) * reach,
        delay: random(index + 67) * 170,
        duration: 620 + random(index + 89) * 700,
        size: 8 + random(index + 113) * (rarity === 'Legendary' ? 32 : 22),
        rotate: Math.round(random(index + 151) * 320 - 160),
        sprite: sprites[Math.floor(random(index + 197) * sprites.length)]
      };
    });
  });

  const accent = $derived(schoolColor(school));
  const rarityAccent = $derived(PACK_RARITY_COLOR[rarity]);
</script>

{#key burstId}
  <div
    class="burst"
    class:tear={kind === 'tear'}
    class:legendary={rarity === 'Legendary'}
    style:--burst-accent={accent}
    style:--rarity-accent={rarityAccent}
    style:--burst-x={originX}
    style:--burst-y={originY}
    aria-hidden="true"
  >
    <span class="flash"></span>
    <span class="ring ring-one"></span>
    <span class="ring ring-two"></span>
    {#if rarity === 'Epic' || rarity === 'Legendary'}
      <span class="ray ray-one"></span>
      <span class="ray ray-two"></span>
      <span class="ray ray-three"></span>
    {/if}
    {#each particles as particle (particle.id)}
      <span
        class="particle"
        style={`--px:${particle.x}px;--py:${particle.y}px;--delay:${particle.delay}ms;--duration:${particle.duration}ms;--size:${particle.size}px;--spin:${particle.rotate}deg;--sprite:url('${particleUrl}${particle.sprite}.png')`}
      ></span>
    {/each}
  </div>
{/key}

<style>
  .burst {
    position: fixed;
    z-index: 2;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .flash,
  .ring,
  .ray,
  .particle {
    position: absolute;
    top: var(--burst-y);
    left: var(--burst-x);
  }

  .flash {
    width: min(66vw, 720px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--burst-accent) 70%, white) 0%,
      color-mix(in srgb, var(--rarity-accent) 54%, transparent) 18%,
      transparent 67%
    );
    mix-blend-mode: screen;
    transform: translate(-50%, -50%);
    animation: flash 720ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  .tear .flash {
    width: min(88vw, 980px);
    background: radial-gradient(
      circle,
      rgba(255, 239, 196, 0.78),
      rgba(232, 102, 63, 0.2) 26%,
      transparent 68%
    );
  }

  .ring {
    width: min(48vw, 480px);
    aspect-ratio: 1;
    border: 2px solid color-mix(in srgb, var(--rarity-accent) 84%, white);
    border-radius: 50%;
    box-shadow:
      0 0 35px var(--rarity-accent),
      inset 0 0 35px var(--burst-accent);
    transform: translate(-50%, -50%) scale(0.08);
    animation: ring 900ms cubic-bezier(0.1, 0.65, 0.16, 1) both;
  }

  .ring-two {
    animation-delay: 110ms;
  }

  .ray {
    width: min(74vw, 850px);
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--rarity-accent),
      white,
      var(--rarity-accent),
      transparent
    );
    box-shadow: 0 0 20px var(--rarity-accent);
    opacity: 0;
    transform: translate(-50%, -50%) rotate(0);
    animation: ray 760ms ease-out 80ms both;
  }

  .ray-two {
    transform: translate(-50%, -50%) rotate(60deg);
    animation-delay: 130ms;
  }

  .ray-three {
    transform: translate(-50%, -50%) rotate(120deg);
    animation-delay: 180ms;
  }

  .particle {
    width: var(--size);
    height: var(--size);
    background-image: var(--sprite);
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    filter: sepia(0.2) saturate(1.8) drop-shadow(0 0 8px var(--burst-accent));
    mix-blend-mode: screen;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.15);
    animation: particle var(--duration) cubic-bezier(0.08, 0.52, 0.22, 1) var(--delay) both;
  }

  .legendary .particle {
    filter: sepia(0.35) saturate(2.1) drop-shadow(0 0 11px #f4c96f);
  }

  @keyframes flash {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.05);
    }
    15% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.22);
    }
  }

  @keyframes ring {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.08);
    }
    20% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.65);
    }
  }

  @keyframes ray {
    0% {
      opacity: 0;
      scale: 0.08 1;
    }
    20% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      scale: 1 1;
    }
  }

  @keyframes particle {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.15) rotate(0);
    }
    14% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(1.1)
        rotate(var(--spin));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .particle,
    .ray,
    .ring-two {
      display: none;
    }
    .flash,
    .ring-one {
      animation-duration: 180ms;
    }
  }
</style>
