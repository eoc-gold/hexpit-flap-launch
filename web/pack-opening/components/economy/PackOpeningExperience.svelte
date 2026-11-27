<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import CloseButton from '$lib/components/CloseButton.svelte';
  import HexButton from '$lib/components/HexButton.svelte';
  import { modalFocus } from '$lib/actions/modalFocus';
  import {
    bodyPlanFor,
    healSfxFor,
    stingSfxFor,
    tempoRate,
    uniqueSfxFor,
    windupSfxFor,
    sfxJitter
  } from '$lib/audio/combat';
  import { playSfx, setupSfx, warmSfx, type SfxName } from '$lib/audio/sfx';
  import { schoolColor } from '$lib/theme/school-colors';
  import {
    bestPackRarity,
    maxCardNumber,
    PACK_RARITY_COLOR,
    shortChainValue,
    type PackOpeningCard,
    type PackRarity
  } from '$lib/economy/pack-opening';
  import PackAbilityBackdrop from './PackAbilityBackdrop.svelte';
  import PackBurst from './PackBurst.svelte';
  import PoolFunding from './PoolFunding.svelte';

  interface Props {
    cards: PackOpeningCard[];
    receipt: {
      game: string;
      player: string;
      packNumber: number;
      poolOpened: boolean;
      explorerUrl?: string;
    };
    replay: boolean;
    onclose: () => void;
    onagain: () => void;
  }

  let { cards, receipt, replay, onclose, onagain }: Props = $props();
  const formatGame = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format;
  const cardback = './pack-assets/textures/cardback-dexpit-official.png';

  type Phase = 'sealed' | 'tear' | 'funding' | 'cards' | 'summary';
  let phase = $state<Phase>('sealed');
  let currentIndex = $state(0);
  let faceUp = $state(false);
  let busy = $state(false);
  let burstId = $state(0);
  let burstKind = $state<'tear' | 'reveal'>('reveal');
  let showBurst = $state(false);
  let burstOriginX = $state('50vw');
  let burstOriginY = $state('50vh');
  let packElement = $state<HTMLElement | null>(null);
  let revealHeading = $state<HTMLHeadingElement>();
  let cardZoneElement = $state<HTMLElement | null>(null);
  let alive = true;
  const timers = new Set<number>();

  const current = $derived(cards[currentIndex] ?? null);
  const revealedCount = $derived(currentIndex + (faceUp ? 1 : 0));
  const bestRarity = $derived(bestPackRarity(cards));

  const REVEAL_STATUS_CUES = [
    'Stun',
    'Freeze',
    'Frozen',
    'Poison',
    'Rot',
    'Bleed',
    'Burn',
    'Shock',
    'Silence',
    'Hexbound',
    'Power',
    'Ward',
    'Shield',
    'Shell',
    'Immune',
    'Weak',
    'Curse',
    'Stealth',
    'Regen',
    'Retaliate',
    'Hound',
    'Cleanse',
    'Push',
    'Trap',
    'Armor',
    'Expose',
    'Flank'
  ] as const;

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, ms);
      timers.add(timer);
    });
  }

  function schedule(action: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (alive) action();
    }, delayMs);
    timers.add(timer);
  }

  function statusCuesFor(card: PackOpeningCard): string[] {
    const text = card.card?.text ?? '';
    return REVEAL_STATUS_CUES.filter((status) => new RegExp(`\\b${status}\\b`, 'i').test(text));
  }

  function statusCueFor(card: PackOpeningCard): string | null {
    return statusCuesFor(card)[0] ?? null;
  }

  function clipsFor(cardsToWarm: PackOpeningCard[]) {
    const names = new Set<SfxName>(['card-shuffle', 'card-draw', 'card-pick', 'ready', 'victory']);
    for (const item of cardsToWarm) {
      if (!item.card) continue;
      const hit = maxCardNumber(item.card.text, 'damage');
      const heal = maxCardNumber(item.card.text, 'heal');
      const windup = windupSfxFor(item.card, hit);
      const unique = uniqueSfxFor(item.card);
      const healClip = heal > 0 ? healSfxFor(item.card, heal) : null;
      const sting = stingSfxFor(statusCueFor(item));
      if (windup) names.add(windup);
      if (unique) names.add(unique);
      if (healClip) names.add(healClip);
      if (sting) names.add(sting);
      if (item.card.type === 'Emblem') names.add('sting-emblem');
      if (hit > 0) {
        for (const part of bodyPlanFor(item.card, hit)) names.add(part.name);
      }
    }
    return [...names];
  }

  onMount(() => {
    const teardown = setupSfx();
    const controller = new AbortController();
    const warmedImages = cards.flatMap((card) => {
      if (!card.image) return [];
      const image = new Image();
      image.referrerPolicy = 'no-referrer';
      image.src = card.image;
      return [image];
    });
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    void warmSfx(clipsFor(cards), { concurrency: 3, signal: controller.signal });
    return () => {
      controller.abort();
      teardown();
      for (const image of warmedImages) image.src = '';
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflowX = previousRootOverflowX;
    };
  });

  onDestroy(() => {
    alive = false;
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
  });

  function fireBurst(kind: 'tear' | 'reveal', origin?: HTMLElement | null) {
    if (origin) {
      const bounds = origin.getBoundingClientRect();
      burstOriginX = `${bounds.left + bounds.width / 2}px`;
      burstOriginY = `${bounds.top + bounds.height / 2}px`;
    } else {
      burstOriginX = '50vw';
      burstOriginY = '50vh';
    }
    burstKind = kind;
    burstId += 1;
    const activeBurst = burstId;
    showBurst = true;
    schedule(
      () => {
        if (burstId === activeBurst) showBurst = false;
      },
      kind === 'tear' ? 1_150 : 1_450
    );
  }

  async function breakSeal() {
    if (busy) return;
    busy = true;
    phase = 'tear';
    playSfx('card-shuffle', 0.92);
    schedule(() => playSfx('card-draw', 0.96), 230);
    fireBurst('tear', packElement);
    await sleep(820);
    if (!alive) return;
    phase = 'funding';
    busy = false;
  }

  async function showCards() {
    phase = 'cards';
    playSfx('ready');
    await tick();
    revealHeading?.focus({ preventScroll: true });
  }

  function playCardVoice(card: PackOpeningCard) {
    playSfx('card-pick', card.rarity === 'Legendary' ? 0.82 : 0.95);
    if (!card.card) return;
    const maxHit = maxCardNumber(card.card.text, 'damage');
    const maxHeal = maxCardNumber(card.card.text, 'heal');
    const rate = tempoRate(card.card) * sfxJitter();
    const unique = uniqueSfxFor(card.card);
    const heal = maxHeal > 0 ? healSfxFor(card.card, maxHeal) : null;
    const sting = stingSfxFor(statusCueFor(card));
    if (unique) playSfx(unique, rate);
    if (maxHit > 0) {
      for (const part of bodyPlanFor(card.card, maxHit)) {
        schedule(() => playSfx(part.name, rate), 100 + part.delayMs);
      }
    }
    if (heal) schedule(() => playSfx(heal, rate), 130);
    if (sting) schedule(() => playSfx(sting, rate), 260);
    if (card.card.type === 'Emblem') schedule(() => playSfx('sting-emblem', rate), 220);
  }

  async function revealCurrent() {
    const card = current;
    if (!card || busy) return;
    busy = true;
    if (card.card) {
      const windup = windupSfxFor(card.card, maxCardNumber(card.card.text, 'damage'));
      if (windup) playSfx(windup, tempoRate(card.card) * sfxJitter());
    }
    const suspense = card.rarity === 'Legendary' ? 880 : card.rarity === 'Epic' ? 470 : 100;
    await sleep(suspense);
    if (!alive) return;
    faceUp = true;
    fireBurst('reveal', cardZoneElement);
    playCardVoice(card);
    // Keep the control locked until the 3D flip and its impact audio have
    // landed. Without this dwell, a quick second click can replace the card
    // before its face is ever visible.
    await sleep(620);
    if (!alive) return;
    busy = false;
  }

  async function advance() {
    if (busy) return;
    if (!faceUp) {
      await revealCurrent();
      return;
    }
    if (currentIndex >= cards.length - 1) {
      phase = 'summary';
      playSfx(bestRarity === 'Legendary' ? 'victory' : 'ready');
      return;
    }
    busy = true;
    faceUp = false;
    // Let the current card rotate fully back before changing the payload.
    // Replacing it mid-transition can expose the next face through the turn.
    await sleep(620);
    if (!alive) return;
    currentIndex += 1;
    busy = false;
    await revealCurrent();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
  }

  function onBackdrop(event: MouseEvent) {
    if (event.currentTarget === event.target) onclose();
  }

  function fallbackToCardback(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    if (image.src === new URL(cardback, window.location.href).href) return;
    image.src = cardback;
  }
</script>

<div
  class="opening"
  class:summary={phase === 'summary'}
  role="dialog"
  aria-modal="true"
  aria-labelledby="opening-title"
  tabindex="-1"
  use:modalFocus
  onclick={onBackdrop}
  onkeydown={onKeydown}
>
  <div class="atmosphere" aria-hidden="true">
    <span class="fog fog-a"></span>
    <span class="fog fog-b"></span>
    <span class="embers"></span>
  </div>

  <header class="opening-head">
    <div>
      <p>{replay ? 'Pack receipt replay' : 'Mint confirmed'}</p>
      <span>{phase === 'cards' || phase === 'summary'
        ? receipt.poolOpened
          ? 'GAME/USD pool opened'
          : 'Pack ' + receipt.packNumber + ' of 12 · ' + (receipt.packNumber * 5) + ' / 60 test USD collected'
        : 'DEXPit · Flap Pool Launch'}</span>
    </div>
    <CloseButton onClose={onclose} label="Close pack opening" />
  </header>

  {#if phase === 'cards' && faceUp && current?.card}
    {#key `${current.tokenId}-${burstId}`}
      <PackAbilityBackdrop
        card={current.card}
        statuses={statusCuesFor(current)}
        sequence={burstId}
      />
    {/key}
  {/if}

  {#if showBurst}
    <PackBurst
      {burstId}
      rarity={current?.rarity ?? 'Legendary'}
      school={current?.card?.school ?? 'Fire'}
      kind={burstKind}
      originX={burstOriginX}
      originY={burstOriginY}
    />
  {/if}

  {#if phase === 'sealed' || phase === 'tear'}
    <section class="seal-stage" class:tearing={phase === 'tear'}>
      <div class="pack" bind:this={packElement} aria-hidden="true">
        <div class="pack-crimp top"></div>
        <div class="pack-face">
          <span class="pack-kicker">DEXPIT CARD PVP</span>
          <img class="pack-logo" src="./pack-assets/images/dexpit-logo-transparent-384.png" alt="" />
          <span class="pack-sub">Five-card Founding Pack</span>
          <i>DEXPit · BSC Testnet</i>
        </div>
        <div class="pack-crimp bottom"></div>
        <span class="tear-line"></span>
      </div>
      <div class="stage-copy">
        <p class="eyebrow">{replay ? 'Recorded pack' : 'Confirmed pack'}</p>
        <h1 id="opening-title">{phase === 'tear' ? 'Cracking the seal' : 'Your pack is ready.'}</h1>
        <p>{replay ? 'Replay the five cards from this receipt.' : 'Reveal the five cards from your confirmed transaction.'}</p>
        <HexButton
          role="primary"
          size="lg"
          pulse={phase === 'sealed'}
          disabled={busy}
          onclick={breakSeal}
        >
          {phase === 'tear' ? 'Opening' : 'Break the seal'}
        </HexButton>
      </div>
    </section>
  {:else if phase === 'funding'}
    <PoolFunding packNumber={receipt.packNumber} poolOpened={receipt.poolOpened} oncontinue={showCards} />
  {:else if phase === 'cards' && current}
    <section
      class="reveal-stage"
      style:--rarity={PACK_RARITY_COLOR[current.rarity]}
      style:--school={schoolColor(current.card?.school)}
    >
      <div class="reveal-copy" aria-live="polite" aria-atomic="true">
        <p class="eyebrow">Card {currentIndex + 1} of {cards.length}</p>
        <h1 id="opening-title" tabindex="-1" bind:this={revealHeading}>{faceUp ? current.name : 'Your next pull is ready.'}</h1>
        {#if faceUp}
          <div class="pull-meta">
            <span class="rarity">{current.rarity}</span>
            <span>{current.card?.cls ?? 'Onchain card'}</span>
            <span>{current.card?.school ?? 'Token'}</span>
          </div>
          {#if current.card?.text}
            <div class="card-description">
              <span>Ability</span>
              <p>{current.card.text}</p>
            </div>
          {/if}
          <p class="chain-note">Card #{current.tokenId}</p>
        {:else}
          <p>Every flip reveals the next card from the pack receipt.</p>
        {/if}
      </div>

      <div class="card-zone" bind:this={cardZoneElement}>
        <div class="stack" aria-hidden="true">
          <img src={cardback} alt="" />
          <img src={cardback} alt="" />
        </div>
        <div class="flipper" class:face-up={faceUp}>
          <div class="card-side card-back" aria-hidden={faceUp}>
            <img src={cardback} alt="Face-down DEXPIT card" />
            {#if current.rarity === 'Epic' || current.rarity === 'Legendary'}
              <span class="rare-tell" aria-hidden="true"></span>
            {/if}
          </div>
          <div class="card-side card-front" aria-hidden={!faceUp}>
            {#if current.image}
              <img
                src={current.image}
                alt={current.name}
                referrerpolicy="no-referrer"
                onerror={fallbackToCardback}
              />
            {:else}
              <div class="fallback-card">
                <span>{current.rarity}</span>
                <strong>{current.name}</strong>
                <small>Token #{current.tokenId}</small>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="reveal-controls">
        <div
          class="progress"
          role="progressbar"
          aria-label="Cards revealed"
          aria-valuemin="0"
          aria-valuemax={cards.length}
          aria-valuenow={revealedCount}
        >
          {#each cards as card, index}
            <span class:seen={index < revealedCount} style:--dot={PACK_RARITY_COLOR[card.rarity]}
            ></span>
          {/each}
        </div>
        <HexButton
          role="primary"
          size="lg"
          pulse={!faceUp}
          disabled={busy}
          accent={faceUp ? PACK_RARITY_COLOR[current.rarity] : undefined}
          onclick={advance}
        >
          {#if busy}
            Drawing
          {:else if !faceUp}
            Reveal card
          {:else if currentIndex === cards.length - 1}
            See the full pack
          {:else}
            Reveal next
          {/if}
        </HexButton>
      </div>
    </section>
  {:else}
    <section class="summary-stage">
      <div class="summary-title">
        <p class="eyebrow">Pack revealed</p>
        <h1 id="opening-title">{bestRarity === 'Legendary' ? 'A legendary pull.' : 'Five cards revealed.'}</h1>
      </div>

      <div class="summary-grid" aria-label="Pack contents">
        {#each cards as card}
          <article style:--rarity={PACK_RARITY_COLOR[card.rarity]}>
            <div class="thumb">
              {#if card.image}
                <img
                  src={card.image}
                  alt={card.name}
                  referrerpolicy="no-referrer"
                  onerror={fallbackToCardback}
                />
              {:else}
                <img src={cardback} alt="" />
              {/if}
            </div>
            <strong>{card.name}</strong>
            <span>{card.rarity} · #{card.tokenId}</span>
          </article>
        {/each}
      </div>

      <div class="receipt">
        <div>
          <span>Best pull</span>
          <strong style:color={PACK_RARITY_COLOR[bestRarity]}>{bestRarity}</strong>
        </div>
        <div>
          <span>GAME allocation</span>
          <strong title={receipt.game + " GAME"}>{formatGame(receipt.game)} GAME</strong>
        </div>
        <div>
          <span>Original buyer</span>
          <strong title={receipt.player}>{shortChainValue(receipt.player)}</strong>
        </div>
        {#if receipt.explorerUrl}
          <a href={receipt.explorerUrl} target="_blank" rel="noreferrer">View transaction ↗</a>
        {/if}
      </div>

      <div class="summary-actions">
        <HexButton role="primary" size="lg" onclick={onagain}>Replay this pack</HexButton>
        <HexButton role="neutral" size="lg" onclick={onclose}>Back to launch</HexButton>
      </div>
    </section>
  {/if}
</div>

<style>
  .opening {
    --font-ui: 'Rajdhani', sans-serif;
    --font-display: 'Cinzel', serif;
    font-family: var(--font-ui);
    --panel: rgba(12, 8, 11, 0.92);
    position: fixed;
    z-index: 1200;
    inset: 0;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background:
      radial-gradient(circle at 50% 44%, rgba(91, 32, 118, 0.2), transparent 37%),
      radial-gradient(circle at 50% 110%, rgba(232, 102, 63, 0.18), transparent 42%), #070507;
    color: #f5eee2;
    isolation: isolate;
  }

  .opening::before {
    position: fixed;
    z-index: -1;
    inset: 0;
    background:
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.014) 1px, transparent 1px);
    background-size: 54px 54px;
    mask-image: radial-gradient(circle, black, transparent 78%);
    content: '';
  }

  .atmosphere,
  .fog,
  .embers {
    position: fixed;
    z-index: -1;
    inset: 0;
    pointer-events: none;
  }

  .fog {
    inset: auto -12vw -20vh;
    height: 62vh;
    background: url('../../../pack-assets/vfx/particles/smoke.png') center / min(850px, 95vw) auto repeat-x;
    opacity: 0.09;
    filter: blur(12px);
    animation: fog 18s ease-in-out infinite alternate;
  }

  .fog-b {
    bottom: -30vh;
    opacity: 0.055;
    transform: scaleX(-1);
    animation-duration: 25s;
  }

  .embers {
    background:
      radial-gradient(circle at 14% 78%, rgba(232, 102, 63, 0.8) 0 1px, transparent 2px),
      radial-gradient(circle at 78% 66%, rgba(216, 174, 98, 0.7) 0 1px, transparent 2px),
      radial-gradient(circle at 64% 88%, rgba(232, 102, 63, 0.7) 0 1px, transparent 2px);
    background-size:
      170px 220px,
      230px 260px,
      290px 300px;
    opacity: 0.38;
    animation: embers 15s linear infinite;
  }

  .opening-head {
    position: fixed;
    z-index: 20;
    top: 0;
    right: 0;
    left: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: max(18px, env(safe-area-inset-top)) clamp(18px, 4vw, 52px) 12px;
    pointer-events: none;
  }

  .opening-head > * {
    pointer-events: auto;
  }

  .opening-head p,
  .opening-head span {
    margin: 0;
    font: 800 10px/1.3 var(--font-ui, sans-serif);
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .opening-head p {
    color: #d8ae62;
  }

  .opening-head span {
    color: #6f666f;
    letter-spacing: 0.08em;
  }

  .opening-head :global(.close-btn) {
    margin: 0;
  }

  .seal-stage,
  .reveal-stage,
  .summary-stage {
    position: relative;
    z-index: 1;
  }

  .seal-stage,
  .reveal-stage {
    display: grid;
    grid-template-columns: minmax(260px, 460px) minmax(320px, 520px);
    align-items: center;
    justify-content: center;
    gap: clamp(42px, 8vw, 120px);
    width: min(1160px, calc(100% - 48px));
    min-height: 100dvh;
    margin: 0 auto;
    padding: 92px 0 58px;
  }

  .seal-stage {
    grid-template-columns: minmax(270px, 390px) minmax(320px, 540px);
  }

  .pack {
    position: relative;
    width: min(78vw, 350px);
    aspect-ratio: 0.69;
    margin: auto;
    filter: drop-shadow(0 34px 38px rgba(0, 0, 0, 0.58))
      drop-shadow(0 0 28px rgba(232, 102, 63, 0.13));
    transform: rotate(-2deg);
    animation: pack-float 4s ease-in-out infinite;
  }

  .pack-face {
    position: absolute;
    inset: 5% 0;
    display: grid;
    place-content: center;
    overflow: hidden;
    border: 1px solid rgba(216, 174, 98, 0.62);
    background:
      radial-gradient(circle at 50% 33%, rgba(232, 102, 63, 0.25), transparent 31%),
      linear-gradient(145deg, #2a1b1a, #110b0d 65%, #2a1724);
    clip-path: polygon(8% 0, 92% 0, 100% 7%, 100% 93%, 92% 100%, 8% 100%, 0 93%, 0 7%);
    text-align: center;
  }

  .pack-face::before,
  .pack-face::after {
    position: absolute;
    inset: 14% -25%;
    border: 1px solid rgba(216, 174, 98, 0.1);
    content: '';
    transform: rotate(28deg);
  }

  .pack-face::after {
    inset: 23% -12%;
    transform: rotate(-28deg);
  }

  .pack-kicker,
  .pack-sub,
  .pack-face i {
    position: relative;
    z-index: 1;
    color: #b8aaa4;
    font: 800 10px/1 var(--font-ui, sans-serif);
    font-style: normal;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .pack-logo {
    position: relative;
    z-index: 1;
    width: min(72%, 240px);
    height: auto;
    margin: 18px auto 10px;
    filter: drop-shadow(0 0 28px rgba(232, 102, 63, 0.35));
  }

  .pack-face i {
    margin-top: 48px;
    color: #e8663f;
    font-size: 8px;
  }

  .pack-crimp {
    position: absolute;
    z-index: 2;
    right: 2%;
    left: 2%;
    height: 7%;
    border: 1px solid rgba(216, 174, 98, 0.45);
    background: repeating-linear-gradient(90deg, #2b211f 0 4px, #110d0e 4px 8px);
    clip-path: polygon(3% 0, 97% 0, 100% 100%, 0 100%);
  }

  .pack-crimp.top {
    top: 0;
  }

  .pack-crimp.bottom {
    bottom: 0;
    transform: rotate(180deg);
  }

  .tear-line {
    position: absolute;
    z-index: 4;
    top: 11%;
    right: -5%;
    left: -5%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ffd995, white, #ffd995, transparent);
    box-shadow: 0 0 18px #e8663f;
    opacity: 0;
  }

  .tearing .tear-line {
    animation: tear-line 520ms ease-out both;
  }

  .tearing .pack {
    animation: tear-pack 820ms cubic-bezier(0.5, 0, 0.4, 1) both;
  }

  .stage-copy .eyebrow,
  .reveal-copy .eyebrow,
  .summary-title .eyebrow {
    margin: 0 0 12px;
    color: #e8663f;
    font: 800 10px/1.2 var(--font-ui, sans-serif);
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .stage-copy h1,
  .reveal-copy h1,
  .summary-title h1 {
    margin: 0;
    font: 800 clamp(42px, 6.4vw, 82px)/0.95 var(--font-display, serif);
    letter-spacing: -0.035em;
  }

  .stage-copy > p:not(.eyebrow),
  .reveal-copy > p:not(.eyebrow) {
    max-width: 590px;
    margin: 22px 0 30px;
    color: #a99fa6;
    font-size: clamp(15px, 1.6vw, 18px);
    line-height: 1.6;
  }

  .reveal-stage {
    grid-template-columns: minmax(260px, 0.8fr) minmax(280px, 430px);
    grid-template-areas:
      'copy card'
      'controls card';
    gap: 22px clamp(45px, 8vw, 120px);
  }

  .reveal-copy {
    grid-area: copy;
    align-self: end;
  }

  .reveal-copy h1 {
    font-size: clamp(38px, 5.2vw, 70px);
  }

  .pull-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 18px;
    color: #aaa0a8;
    font: 800 11px/1 var(--font-ui, sans-serif);
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .pull-meta .rarity {
    color: var(--rarity);
    text-shadow: 0 0 14px var(--rarity);
  }

  .card-description {
    max-width: 560px;
    margin-top: 19px;
    padding: 15px 18px 17px;
    border: 1px solid color-mix(in srgb, var(--school) 30%, rgba(255, 255, 255, 0.08));
    border-left: 3px solid var(--school);
    background:
      linear-gradient(105deg, color-mix(in srgb, var(--school) 13%, transparent), transparent 72%),
      rgba(10, 7, 10, 0.68);
    box-shadow:
      0 15px 38px rgba(0, 0, 0, 0.26),
      inset 0 0 28px color-mix(in srgb, var(--school) 5%, transparent);
    backdrop-filter: blur(8px);
  }

  .card-description > span {
    color: var(--school);
    font: 900 9px/1 var(--font-ui, sans-serif);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-shadow: 0 0 14px color-mix(in srgb, var(--school) 72%, transparent);
  }

  .card-description p {
    margin: 8px 0 0;
    color: #ede5e4;
    font: 650 clamp(14px, 1.32vw, 17px)/1.5 var(--font-ui, sans-serif);
    letter-spacing: 0.005em;
    white-space: pre-line;
  }

  .reveal-copy .chain-note {
    margin: 15px 0 0;
    color: #786f76;
    font: 700 11px/1.5 var(--font-ui, sans-serif);
  }

  .card-zone {
    position: relative;
    grid-area: card;
    align-self: center;
    width: min(62vw, 390px);
    aspect-ratio: 0.715;
    perspective: 1600px;
  }

  .stack,
  .flipper,
  .card-side {
    position: absolute;
    inset: 0;
  }

  .stack img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: brightness(0.45) saturate(0.75);
  }

  .stack img:first-child {
    transform: translate(15px, 8px) rotate(3deg);
  }

  .stack img:last-child {
    transform: translate(-12px, 6px) rotate(-3deg);
  }

  .flipper {
    transform-style: preserve-3d;
    transition: transform 720ms cubic-bezier(0.2, 0.72, 0.12, 1);
  }

  .flipper.face-up {
    transform: rotateY(180deg) translateY(-5px) scale(1.025);
  }

  .card-side {
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    box-shadow: 0 34px 38px rgba(0, 0, 0, 0.65);
    transition: box-shadow 420ms ease;
  }

  .card-side > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .card-front {
    transform: rotateY(180deg) translateZ(1px);
  }

  .card-back {
    transform: translateZ(1px);
  }

  .face-up .card-front {
    box-shadow:
      0 32px 42px rgba(0, 0, 0, 0.66),
      0 0 24px color-mix(in srgb, var(--rarity) 55%, transparent);
  }

  .rare-tell {
    position: absolute;
    inset: 17% 13%;
    border: 1px solid color-mix(in srgb, var(--rarity) 70%, white);
    box-shadow:
      inset 0 0 35px var(--rarity),
      0 0 25px var(--rarity);
    opacity: 0.22;
    animation: tell 1.5s ease-in-out infinite;
  }

  .fallback-card {
    display: grid;
    width: 88%;
    height: 90%;
    margin: 5% auto;
    place-content: center;
    gap: 16px;
    border: 2px solid var(--rarity);
    background:
      radial-gradient(circle, color-mix(in srgb, var(--school) 20%, transparent), transparent 55%),
      #130e15;
    box-shadow: inset 0 0 45px color-mix(in srgb, var(--rarity) 22%, transparent);
    text-align: center;
  }

  .fallback-card span,
  .fallback-card small {
    color: var(--rarity);
    font: 800 10px/1 var(--font-ui, sans-serif);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .fallback-card strong {
    padding: 0 22px;
    font: 800 32px/1 var(--font-display, serif);
  }

  .fallback-card small {
    color: #766d75;
    letter-spacing: 0.08em;
  }

  .reveal-controls {
    grid-area: controls;
    align-self: start;
  }

  .progress {
    display: flex;
    gap: 7px;
    margin-bottom: 22px;
  }

  .progress span {
    width: 25px;
    height: 3px;
    background: #302a30;
    transition:
      background 300ms ease,
      box-shadow 300ms ease;
  }

  .progress span.seen {
    background: var(--dot);
    box-shadow: 0 0 8px var(--dot);
  }

  .summary-stage {
    width: min(1220px, calc(100% - 48px));
    min-height: 100dvh;
    margin: 0 auto;
    padding: 100px 0 72px;
  }

  .summary-title {
    text-align: center;
  }

  .summary-title h1 {
    font-size: clamp(42px, 6vw, 76px);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    max-width: 920px;
    margin: 36px auto 0;
  }

  .summary-grid article {
    min-width: 0;
    text-align: center;
  }

  @media (max-width: 600px) {
    .summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px 8px;
    }
  }

  .thumb {
    aspect-ratio: 0.715;
    overflow: hidden;
    border-bottom: 2px solid var(--rarity);
    background: #110d12;
    box-shadow:
      0 14px 22px rgba(0, 0, 0, 0.4),
      0 0 12px color-mix(in srgb, var(--rarity) 20%, transparent);
    transition:
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  .summary-grid article:hover .thumb {
    box-shadow:
      0 18px 28px rgba(0, 0, 0, 0.5),
      0 0 20px color-mix(in srgb, var(--rarity) 34%, transparent);
    transform: translateY(-5px);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .summary-grid strong,
  .summary-grid span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-grid strong {
    margin-top: 11px;
    color: #d9d0d8;
    font: 800 11px/1.2 var(--font-ui, sans-serif);
  }

  .summary-grid span {
    margin-top: 5px;
    color: var(--rarity);
    font: 700 8px/1.2 var(--font-ui, sans-serif);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .receipt {
    display: grid;
    grid-template-columns: repeat(3, 1fr) auto;
    align-items: center;
    gap: 1px;
    margin: 44px auto 0;
    background: rgba(216, 174, 98, 0.14);
  }

  .receipt > div,
  .receipt > a {
    display: grid;
    min-height: 72px;
    align-content: center;
    padding: 0 22px;
    background: rgba(14, 10, 14, 0.96);
  }

  .receipt span {
    color: #766c75;
    font: 700 8px/1 var(--font-ui, sans-serif);
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .receipt strong {
    margin-top: 7px;
    color: #d9d0d8;
    font: 800 14px/1 var(--font-ui, sans-serif);
  }

  .receipt a {
    color: #d8ae62;
    font: 800 10px/1.3 var(--font-ui, sans-serif);
    letter-spacing: 0.1em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .summary-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 34px;
  }

  @keyframes pack-float {
    0%,
    100% {
      transform: rotate(-2deg) translateY(0);
    }
    50% {
      transform: rotate(1deg) translateY(-10px);
    }
  }

  @keyframes tear-line {
    0% {
      opacity: 0;
      transform: scaleX(0);
    }
    25% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes tear-pack {
    0% {
      opacity: 1;
      transform: rotate(-2deg) scale(1);
    }
    42% {
      opacity: 1;
      transform: rotate(1deg) scale(1.05);
    }
    100% {
      opacity: 0;
      transform: rotate(-4deg) scale(1.18);
      filter: blur(9px);
    }
  }

  @keyframes tell {
    0%,
    100% {
      opacity: 0.12;
      transform: scale(0.96);
    }
    50% {
      opacity: 0.32;
      transform: scale(1.02);
    }
  }

  @keyframes fog {
    from {
      transform: translateX(-4%) scale(1);
    }
    to {
      transform: translateX(4%) scale(1.12);
    }
  }

  @keyframes embers {
    from {
      background-position:
        0 0,
        0 0,
        0 0;
    }
    to {
      background-position:
        25px -220px,
        -40px -260px,
        18px -300px;
    }
  }

  @media (max-width: 900px) {
    .seal-stage,
    .reveal-stage {
      grid-template-columns: minmax(240px, 350px) minmax(280px, 1fr);
      gap: 40px;
    }

    .summary-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .summary-grid article:nth-child(n + 6) {
      transform: translateX(50%);
    }
  }

  @media (max-width: 680px) {
    .opening-head {
      align-items: center;
      padding-right: 14px;
      padding-left: 18px;
    }

    .seal-stage,
    .reveal-stage {
      display: flex;
      width: calc(100% - 30px);
      min-height: 100dvh;
      flex-direction: column;
      justify-content: center;
      gap: 26px;
      padding: 82px 0 34px;
    }

    .seal-stage {
      flex-direction: column-reverse;
    }

    .pack {
      width: min(58vw, 260px);
    }

    .pack-face i {
      margin-top: 46px;
    }

    .stage-copy,
    .reveal-copy {
      text-align: center;
    }

    .stage-copy > p:not(.eyebrow),
    .reveal-copy > p:not(.eyebrow) {
      margin: 13px auto 18px;
      font-size: 14px;
    }

    .stage-copy h1,
    .reveal-copy h1 {
      font-size: clamp(34px, 11vw, 51px);
    }

    .reveal-stage {
      gap: 16px;
    }

    .reveal-copy {
      width: 100%;
      min-height: 122px;
    }

    .pull-meta,
    .progress {
      justify-content: center;
    }

    .card-description {
      margin: 14px auto 0;
      padding: 12px 14px 14px;
      text-align: left;
    }

    .card-description p {
      font-size: 13px;
      line-height: 1.42;
    }

    .card-zone {
      width: min(59vw, 300px);
      flex: 0 0 auto;
    }

    .reveal-controls {
      display: grid;
      justify-items: center;
    }

    .summary-stage {
      width: calc(100% - 28px);
      padding-top: 90px;
    }

    .summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px 7px;
      margin-top: 26px;
    }

    .summary-grid article:nth-child(n + 6) {
      transform: none;
    }

    .summary-grid strong {
      font-size: 9px;
    }

    .receipt {
      grid-template-columns: 1fr;
      margin-top: 30px;
    }

    .receipt > div,
    .receipt > a {
      min-height: 59px;
    }
  }

  @media (max-height: 620px) and (orientation: landscape) {
    .opening-head {
      padding-top: 8px;
    }

    .seal-stage,
    .reveal-stage {
      min-height: 620px;
      padding-top: 58px;
    }

    .pack {
      width: 235px;
    }

    .card-zone {
      width: 260px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pack,
    .fog,
    .embers,
    .rare-tell {
      animation: none;
    }

    .tearing .pack,
    .tearing .tear-line {
      animation: none;
    }

    .flipper {
      transition-duration: 120ms;
    }

    .summary-grid article:hover .thumb {
      transform: none;
    }
  }
</style>
