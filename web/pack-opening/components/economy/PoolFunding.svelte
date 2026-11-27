<script lang="ts">
  import { onMount } from 'svelte';
  import HexButton from '../HexButton.svelte';

  let { packNumber, poolOpened, oncontinue }: {
    packNumber: number;
    poolOpened: boolean;
    oncontinue: () => void;
  } = $props();

  const packPrice = 5;
  const packTarget = 12;
  const target = packTarget * packPrice;
  const before = $derived((packNumber - 1) * packPrice);
  const after = $derived(packNumber * packPrice);
  let stage = $state<'transfer' | 'funded' | 'pooled'>('transfer');
  let heading: HTMLHeadingElement;
  const collected = $derived(stage === 'transfer' ? before : after);

  onMount(() => {
    heading.focus({ preventScroll: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage = poolOpened ? 'pooled' : 'funded';
      return;
    }
    const transfer = window.setTimeout(() => { stage = 'funded'; }, 1150);
    const opening = poolOpened
      ? window.setTimeout(() => { stage = 'pooled'; }, 2100)
      : undefined;
    return () => {
      window.clearTimeout(transfer);
      window.clearTimeout(opening);
    };
  });
</script>

<section class="funding" aria-labelledby="opening-title">
  <p class="eyebrow">Pack {packNumber} of {packTarget}</p>
  <h1 id="opening-title" tabindex="-1" bind:this={heading}>Fund the first market</h1>

  <div class="route" class:pooled={stage === 'pooled'}>
    <div class="mint">
      <div class="stack" aria-hidden="true">
        <img src="./pack-assets/textures/cardback-dexpit-official.png" alt="" />
        <img src="./pack-assets/textures/cardback-dexpit-official.png" alt="" />
        <img src="./pack-assets/textures/cardback-dexpit-official.png" alt="" />
      </div>
      <strong>5 cards minted</strong>
    </div>

    <div class="payment">
      <strong>+5 test USD</strong>
      <div class="payment-line" aria-hidden="true">
        <i style:--delay="0ms"></i>
        <i style:--delay="80ms"></i>
        <i style:--delay="160ms"></i>
        <span></span>
      </div>
    </div>

    <div class="destination">
      <div
        class="tank"
        role="meter"
        aria-label={stage === 'pooled' ? 'USD seeded into the pool' : 'USD collected in the launcher'}
        aria-valuemin="0"
        aria-valuemax={target}
        aria-valuenow={collected}
        aria-valuetext={collected + ' of ' + target + ' test USD'}
        style:--before={(100 * before / target) + '%'}
        style:--after={(100 * after / target) + '%'}
      >
        <div class="liquid" aria-hidden="true"></div>
        <div class="tank-readout" aria-hidden="true">
          <strong>{collected} / {target}</strong>
          <span>test USD</span>
        </div>
      </div>
      <strong>{stage === 'pooled' ? 'GAME/USD pool' : 'Launcher reserve'}</strong>
    </div>
  </div>

  <p class="result" aria-live="polite">
    {#if stage === 'pooled'}
      Pool opened with 60 test USD and 500,000 GAME.
    {:else if stage === 'funded' && poolOpened}
      Funding target reached. Seeding the pool.
    {:else if stage === 'funded'}
      {after} test USD collected. The pool opens when all 12 packs are minted.
    {:else}
      Adding this pack’s payment to the launch reserve.
    {/if}
  </p>
  <HexButton
    role="primary"
    size="lg"
    disabled={stage === 'transfer' || (poolOpened && stage !== 'pooled')}
    onclick={oncontinue}
  >Reveal the cards</HexButton>
</section>

<style>
  .funding {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 100dvh;
    width: min(760px, calc(100% - 36px));
    margin: auto;
    padding: 85px 0 40px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .eyebrow {
    margin: 0 0 12px;
    color: #e99370;
    font: 800 11px/1.2 var(--font-ui);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font: 800 clamp(33px, 6vw, 62px)/1 var(--font-display);
    text-wrap: balance;
  }

  h1:focus { outline: none; }

  .route {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(74px, 1fr) minmax(68px, 0.8fr) minmax(118px, 1.2fr);
    gap: clamp(8px, 3vw, 28px);
    align-items: center;
    margin: 32px 0 20px;
    padding: clamp(16px, 4vw, 34px);
    border: 1px solid #644337;
    background: linear-gradient(125deg, #1b131d, #130f15 48%, #231717);
    box-shadow: 0 20px 44px #0009;
  }

  .mint,
  .destination {
    display: grid;
    gap: 12px;
    justify-items: center;
    align-self: end;
    line-height: 1;
  }

  .stack {
    position: relative;
    width: min(85%, 96px);
    aspect-ratio: 0.71;
  }

  .stack img {
    position: absolute;
    inset: 0;
    width: 100%;
    border: 1px solid #735453;
    border-radius: 5px;
    box-shadow: 0 6px 16px #0009;
  }

  .stack img:first-child { transform: translateX(-10%) rotate(-13deg); }
  .stack img:nth-child(2) { transform: translateX(10%) rotate(13deg); }

  .payment {
    display: grid;
    align-self: center;
    gap: 12px;
    color: #ffcc86;
    line-height: 1;
  }

  .payment-line {
    position: relative;
    height: 2px;
    margin-right: 7px;
    background: #8d613e;
  }

  .payment-line span {
    position: absolute;
    inset: -3px -4px auto auto;
    width: 8px;
    height: 8px;
    border: solid #c58a51;
    border-width: 1px 1px 0 0;
    transform: rotate(45deg);
  }

  .payment-line i {
    position: absolute;
    top: -4px;
    left: 0;
    width: 10px;
    height: 10px;
    border: 1px solid #ffedae;
    border-radius: 50%;
    background: #f5bc60;
    box-shadow: 0 0 14px #f5a962;
    animation: move-payment 650ms ease-in var(--delay) both;
  }

  .tank {
    position: relative;
    display: grid;
    width: 100%;
    min-height: clamp(112px, 21vw, 176px);
    overflow: hidden;
    place-items: center;
    border: 1px solid #956b53;
    border-radius: 6px 6px 12px 12px;
    background: repeating-linear-gradient(to top, transparent 0 calc(25% - 1px), #d7a27a22 calc(25% - 1px) 25%), #100d13;
    box-shadow: inset 0 0 22px #090408;
    transition: border-color 450ms ease, box-shadow 450ms ease;
  }

  .liquid {
    position: absolute;
    inset: auto 0 0;
    height: var(--after);
    background: linear-gradient(0deg, #a14c32cc, #f0a358a6);
    box-shadow: inset 0 2px 0 #f9cc8d;
    animation: fill-reserve 800ms cubic-bezier(0.22, 0.61, 0.36, 1) 280ms both;
  }

  .tank-readout {
    z-index: 1;
    display: grid;
    padding: 7px 12px;
    border: 1px solid #d7a27a44;
    border-radius: 4px;
    background: #130e17dc;
    line-height: 1.1;
  }

  .tank-readout strong {
    font-size: clamp(20px, 4vw, 38px);
    font-variant-numeric: tabular-nums;
  }

  .tank-readout span { color: #efc7a3; }

  .pooled .tank {
    border-color: #a99af8;
    box-shadow: 0 0 28px #8971f363;
  }

  .pooled .liquid::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(#8c73e9, #4a3d98);
    animation: pair-game 450ms ease-out both;
    content: '';
  }

  .result {
    min-height: 2.5em;
    margin: 0 0 17px;
    color: #e1c9bc;
    font-size: clamp(15px, 2vw, 19px);
  }

  @keyframes move-payment {
    0% { left: 0; opacity: 0; }
    12% { opacity: 1; }
    86% { opacity: 1; }
    100% { left: 100%; opacity: 0; }
  }

  @keyframes fill-reserve {
    from { height: var(--before); }
    to { height: var(--after); }
  }

  @keyframes pair-game {
    from { opacity: 0; transform: translateY(-100%); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .payment-line i { display: none; }
    .liquid, .pooled .liquid::after { animation: none; }
    .tank { transition: none; }
  }
</style>
