// DEXPit SFX pool (generalized from playtest/sfx.ts for AAA-push G9).
//
// Native Audio(), no deps. The registry is now a layered taxonomy that mirrors
// the G7 VFX system (see combat.ts): a FLOW layer for non-combat moments and a
// COMBAT layer keyed by delivery (cast whoosh) x school (impact) x status.
//
// Browser autoplay policy: playback needs a user gesture before the first
// .play(). Browsers retain that interaction permission for subsequent sounds;
// clips are therefore created only when requested instead of eagerly creating
// and downloading the entire library on the first pointer event.
//
// Channels: each clip has a small pool so rapid-fire events (a 3-target AoE)
// don't cut each other off; the oldest channel is reused when all are busy.
//
// A clip whose file is missing (a combat key not yet sourced) loads with
// a.error set; playSfx() skips it silently, so the registry can list keys ahead
// of their assets without spamming failed play() promises.
//
// Mute + master volume persist in localStorage across reloads.

import { SFX_VARIANTS } from './sfx-variants';

// Base for the `/sfx/...` clip srcs: local in DEV, CDN in PROD (R2 cutover).
const SFX_BASE = './pack-assets/sfx';

export type SfxName =
  // --- Flow / UI ---
  | 'card-pick'
  | 'card-hover'
  | 'card-draw'
  | 'card-discard-all'
  | 'confirm-target'
  | 'confirm-move'
  | 'move'
  | 'ready'
  | 'card-shuffle'
  | 'dominion-spawn'
  | 'dominion-pickup'
  | 'turn-start'
  | 'timer-low'
  | 'victory'
  | 'defeat'
  | 'hover'
  // --- Combat: shared beats (death cue + the failed-cast cue) ---
  | 'death'
  | 'fail'
  // --- G14 3-layer taxonomy (windup / body / sting + heal). combat.ts routes a
  // card to one windup (move + physical swings only; magic charges from its
  // school body), one body (by school + force tier, physical split by weapon) -
  // a Legendary plays all three tiers staggered for an epic build - one heal
  // sound (holy / nature, light / heavy) for healing, and one sting per applied
  // keyword. See docs/aaa-push/G13-av-canon.md + fx-staging/sfx/_TARGETS.md. ---
  | 'windup-move-magic'
  | 'windup-move-physical'
  | 'windup-physical-heavy'
  | 'windup-physical-light'
  | 'windup-physical-ranged'
  | 'body-blood-heavy'
  | 'body-blood-light'
  | 'body-blood-medium'
  | 'body-fire-heavy'
  | 'body-fire-light'
  | 'body-fire-medium'
  | 'body-holy-heavy'
  | 'body-holy-light'
  | 'body-holy-medium'
  | 'body-lightning-heavy'
  | 'body-lightning-light'
  | 'body-lightning-medium'
  | 'body-magic-heavy'
  | 'body-magic-light'
  | 'body-magic-medium'
  | 'body-nature-heavy'
  | 'body-nature-light'
  | 'body-nature-medium'
  | 'body-physical-blunt-heavy'
  | 'body-physical-blunt-light'
  | 'body-physical-blunt-medium'
  | 'body-physical-pierce-heavy'
  | 'body-physical-pierce-light'
  | 'body-physical-pierce-medium'
  | 'body-physical-slash-heavy'
  | 'body-physical-slash-light'
  | 'body-physical-slash-medium'
  | 'body-void-heavy'
  | 'body-void-light'
  | 'body-void-medium'
  | 'heal-holy-heavy'
  | 'heal-holy-light'
  | 'heal-nature-heavy'
  | 'heal-nature-light'
  | 'sting-armor'
  | 'sting-burn'
  | 'sting-cleanse'
  | 'sting-curse'
  | 'sting-death'
  | 'sting-emblem'
  | 'sting-expose'
  | 'sting-flank'
  | 'sting-hexbound'
  | 'sting-hound'
  | 'sting-immune'
  | 'sting-poison'
  | 'sting-power'
  | 'sting-push'
  | 'sting-retaliate'
  | 'sting-rot'
  | 'sting-shell'
  | 'sting-shield'
  | 'sting-shock'
  | 'sting-silence'
  | 'sting-stealth'
  | 'sting-stun'
  | 'sting-trap'
  | 'sting-twin-cast'
  | 'sting-ward'
  | 'sting-weak'
  // --- Combat: bespoke per-card / per-event signatures (combat.ts routes
  // specific cards here; trap fires on the trigger substep) ---
  | 'aoe-melee'
  | 'aoe-melee-vary'
  | 'spell-cinderstorm'
  | 'spell-pyroblast'
  | 'trap'
  // --- Per-card UNIQUE flavour (04-uniques): an EXTRA signature layered ON TOP
  // of a card's rule-based sounds (its stings / body still play). One per card,
  // grows over time. Routed by uniqueSfxFor() in combat.ts. ---
  | 'unique-warriors-cry'
  | 'unique-berserk'
  // --- Announcer VO (the VO pack: fight at deploy, power 1-10 as the Rampage
  // ramp climbs, dominion 1-5 as each objective spawns, time when the clock
  // runs out). Routed via voFight / voPower / voDominion / voTime below. ---
  | 'vo-fight'
  | 'vo-time'
  | 'vo-death-multi'
  | 'vo-power-1' | 'vo-power-2' | 'vo-power-3' | 'vo-power-4' | 'vo-power-5'
  | 'vo-power-6' | 'vo-power-7' | 'vo-power-8' | 'vo-power-9' | 'vo-power-10'
  | 'vo-dominion-1' | 'vo-dominion-2' | 'vo-dominion-3' | 'vo-dominion-4' | 'vo-dominion-5';

interface ClipConfig {
  // A single file, or several variants of the same beat. With an array, the
  // round-robin pool plays a different variant each time (true pool variety,
  // e.g. ~18 distinct sword swings for a melee impact) AND the variants double
  // as channels, so rapid-fire events never cut each other off.
  src: string | string[];
  volume?: number;
  channels?: number;
}

// Files live in static/sfx/. Mixed extensions are fine (Audio() plays ogg/wav/
// mp3). Picks anchor on the user's Shortlist/Shortlist2 vetted set; see
// docs/aaa-push/G9-audio-brief.md for the full source map.
const CLIPS: Record<SfxName, ClipConfig> = {
  // Flow / UI
  'card-pick': { src: '/sfx/card-pick.ogg', volume: 0.55, channels: 2 },
  // Soft rollover when the pointer lands on a hand card.
  'card-hover': { src: '/sfx/card-hover.mp3', volume: 0.4, channels: 3 },
  // Round START: one draw cue (a 4-riffle clip, "draw 4 cards"), played once.
  'card-draw': { src: '/sfx/card-draw.ogg', volume: 0.55, channels: 1 },
  // Round END: the "sweep the whole hand away" discard-all, played once.
  // (Trimmed to the loud whoosh - the source file had ~1.2s of low-level
  // lead-in noise that made the cue land late behind the hand-fly-out.)
  'card-discard-all': { src: '/sfx/card-discard-all.ogg', volume: 0.6, channels: 1 },
  'confirm-target': { src: '/sfx/confirm-target.ogg', volume: 0.7, channels: 2 },
  'confirm-move': { src: '/sfx/confirm-move.ogg', volume: 0.55, channels: 2 },
  move: { src: '/sfx/move.ogg', volume: 0.55, channels: 4 },
  ready: { src: '/sfx/ready.ogg', volume: 0.7, channels: 1 },
  // Deck shuffle: game start (before the first draw) + any reshuffle.
  'card-shuffle': { src: '/sfx/card-shuffle.ogg', volume: 0.6, channels: 1 },
  // Dominion objective cues (one-shot, single channel). spawn = the marker lands
  // on the board (before the round VO); pickup = a player collects it (a 2s clip
  // trimmed + faded from the source).
  'dominion-spawn': { src: '/sfx/dominion-spawn.mp3', volume: 0.9, channels: 1 },
  'dominion-pickup': { src: '/sfx/dominion-pickup.mp3', volume: 0.9, channels: 1 },
  'turn-start': { src: '/sfx/turn-start.mp3', volume: 0.55, channels: 1 },
  'timer-low': { src: '/sfx/timer-low.mp3', volume: 0.35, channels: 1 },
  // (game-found is the match-open clip, played through the ambient bus via
  // playMatchIntro in ambient.ts - not the SFX pool, so it can't be chopped.)
  victory: { src: '/sfx/victory.mp3', volume: 0.8, channels: 1 },
  defeat: { src: '/sfx/defeat.mp3', volume: 0.8, channels: 1 },
  hover: { src: '/sfx/hover.ogg', volume: 0.25, channels: 3 },

  // Combat shared beats. Every card routes through the 3-layer windup/body/sting
  // taxonomy below; these are the cross-card cues that aren't per-school. (The
  // old generic `damage`/`heal` fallbacks were retired - every hit/heal now has
  // a specific body/heal clip; the 2 unarmed cards just play their windup.)
  // Single-kill death uses the weighty 3s clip; a multi-kill (2+ deaths in one
  // round) swaps to the announcer VO callout (vo-death-multi, in the vo/ set).
  death: { src: '/sfx/sting-death-1.mp3', volume: 0.85, channels: 2 },
  // Failed cast (out of range / blocked / no target / dead caster). Named `fail`
  // (not `fizzle`) to avoid colliding with the in-game Fizzle term.
  fail: { src: '/sfx/fail.ogg', volume: 0.6, channels: 2 },

  // G14 3-layer taxonomy: windup (telegraph, by family+tier), body (the hit, by
  // school+force tier, physical split slash/blunt/pierce), sting (one fixed cue
  // per keyword). Multi-file entries are
  // round-robin pools that double as channels; combat.ts can also pick a
  // deterministic-by-card-id variant so each card keeps a fixed signature.
  // Generated from static/sfx by fx-profile-gen's bucket layout.
  'body-blood-heavy': { src: '/sfx/body-blood-heavy-1.mp3', volume: 0.85 },
  'body-blood-light': { src: '/sfx/body-blood-light-1.mp3', volume: 0.85 },
  'body-blood-medium': { src: '/sfx/body-blood-medium-1.mp3', volume: 0.85 },
  'body-fire-heavy': { src: ['/sfx/body-fire-heavy-1.mp3', '/sfx/body-fire-heavy-2.mp3'], volume: 0.85 },
  'body-fire-light': { src: ['/sfx/body-fire-light-1.mp3', '/sfx/body-fire-light-2.mp3'], volume: 0.85 },
  'body-fire-medium': { src: ['/sfx/body-fire-medium-1.mp3', '/sfx/body-fire-medium-2.mp3', '/sfx/body-fire-medium-3.mp3'], volume: 0.85 },
  'body-holy-heavy': { src: '/sfx/body-holy-heavy-1.mp3', volume: 0.85 },
  'body-holy-light': { src: '/sfx/body-holy-light-1.mp3', volume: 0.85 },
  'body-holy-medium': { src: '/sfx/body-holy-medium-1.mp3', volume: 0.85 },
  'body-lightning-heavy': { src: '/sfx/body-lightning-heavy-1.mp3', volume: 0.85 },
  'body-lightning-light': { src: '/sfx/body-lightning-light-1.mp3', volume: 0.85 },
  'body-lightning-medium': { src: '/sfx/body-lightning-medium-1.mp3', volume: 0.85 },
  'body-magic-heavy': { src: '/sfx/body-magic-heavy-1.mp3', volume: 0.85 },
  'body-magic-light': { src: '/sfx/body-magic-light-1.mp3', volume: 0.85 },
  'body-magic-medium': { src: '/sfx/body-magic-medium-1.mp3', volume: 0.85 },
  'body-nature-heavy': { src: '/sfx/body-nature-heavy-1.mp3', volume: 0.85 },
  'body-nature-light': { src: '/sfx/body-nature-light-1.mp3', volume: 0.85 },
  'body-nature-medium': { src: '/sfx/body-nature-medium-1.mp3', volume: 0.85 },
  'body-physical-blunt-heavy': { src: '/sfx/body-physical-blunt-heavy-2.mp3', volume: 0.85 },
  'body-physical-blunt-light': { src: ['/sfx/body-physical-blunt-light-1.mp3', '/sfx/body-physical-blunt-light-2.mp3'], volume: 0.85 },
  'body-physical-blunt-medium': { src: ['/sfx/body-physical-blunt-medium-1.mp3', '/sfx/body-physical-blunt-medium-2.mp3'], volume: 0.85 },
  'body-physical-pierce-heavy': { src: '/sfx/body-physical-pierce-heavy-1.mp3', volume: 0.85 },
  'body-physical-pierce-light': { src: ['/sfx/body-physical-pierce-light-1.mp3', '/sfx/body-physical-pierce-light-2.mp3'], volume: 0.85 },
  'body-physical-pierce-medium': { src: ['/sfx/body-physical-pierce-medium-1.mp3', '/sfx/body-physical-pierce-medium-2.mp3', '/sfx/body-physical-pierce-medium-3.mp3'], volume: 0.85 },
  'body-physical-slash-heavy': { src: ['/sfx/body-physical-slash-heavy-1.mp3', '/sfx/body-physical-slash-heavy-2.mp3'], volume: 0.85 },
  'body-physical-slash-light': { src: ['/sfx/body-physical-slash-light-1.mp3', '/sfx/body-physical-slash-light-2.mp3'], volume: 0.85 },
  'body-physical-slash-medium': { src: ['/sfx/body-physical-slash-medium-1.mp3', '/sfx/body-physical-slash-medium-2.mp3'], volume: 0.85 },
  'body-void-heavy': { src: '/sfx/body-void-heavy-1.mp3', volume: 0.85 },
  'body-void-light': { src: ['/sfx/body-void-light-1.mp3', '/sfx/body-void-light-2.mp3'], volume: 0.85 },
  'body-void-medium': { src: '/sfx/body-void-medium-1.mp3', volume: 0.85 },
  'heal-holy-heavy': { src: '/sfx/heal-holy-heavy.mp3', volume: 0.8 },
  'heal-holy-light': { src: '/sfx/heal-holy-light.mp3', volume: 0.8 },
  'heal-nature-heavy': { src: '/sfx/heal-nature-heavy.mp3', volume: 0.8 },
  'heal-nature-light': { src: '/sfx/heal-nature-light.mp3', volume: 0.8 },
  'sting-armor': { src: '/sfx/sting-armor-1.mp3', volume: 0.55 },
  'sting-burn': { src: '/sfx/sting-burn-1.mp3', volume: 0.55 },
  'sting-cleanse': { src: '/sfx/sting-cleanse-1.mp3', volume: 0.55 },
  'sting-curse': { src: '/sfx/sting-curse-1.mp3', volume: 0.55 },
  'sting-death': { src: '/sfx/sting-death-1.mp3', volume: 0.55 },
  'sting-emblem': { src: '/sfx/sting-emblem-1.mp3', volume: 0.55 },
  'sting-expose': { src: '/sfx/sting-expose-1.mp3', volume: 0.55 },
  'sting-flank': { src: '/sfx/sting-flank-1.mp3', volume: 0.55 },
  'sting-hexbound': { src: '/sfx/sting-hexbound-1.mp3', volume: 0.55 },
  'sting-hound': { src: '/sfx/sting-hound-1.mp3', volume: 0.55 },
  'sting-immune': { src: '/sfx/sting-immune-1.mp3', volume: 0.55 },
  'sting-poison': { src: '/sfx/sting-poison-1.mp3', volume: 0.55 },
  'sting-power': { src: '/sfx/sting-power-1.mp3', volume: 0.55 },
  'sting-push': { src: '/sfx/sting-push-1.mp3', volume: 0.55 },
  'sting-retaliate': { src: '/sfx/sting-retaliate-1.mp3', volume: 0.55 },
  'sting-rot': { src: '/sfx/sting-rot-1.mp3', volume: 0.55 },
  'sting-shell': { src: '/sfx/sting-shell-1.mp3', volume: 0.55 },
  'sting-shield': { src: '/sfx/sting-shield-1.mp3', volume: 0.55 },
  'sting-shock': { src: '/sfx/sting-shock-1.mp3', volume: 0.55 },
  'sting-silence': { src: '/sfx/sting-silence-1.mp3', volume: 0.55 },
  'sting-stealth': { src: '/sfx/sting-stealth-1.mp3', volume: 0.55 },
  'sting-stun': { src: '/sfx/sting-stun-1.mp3', volume: 0.55 },
  'sting-trap': { src: '/sfx/sting-trap-1.mp3', volume: 0.55 },
  'sting-twin-cast': { src: '/sfx/sting-twin-cast-1.mp3', volume: 0.55 },
  'sting-ward': { src: '/sfx/sting-ward-1.mp3', volume: 0.55 },
  'sting-weak': { src: '/sfx/sting-weak-1.mp3', volume: 0.55 },
  'windup-move-magic': { src: '/sfx/windup-move-magic-1.mp3', volume: 0.6 },
  'windup-move-physical': { src: '/sfx/windup-move-physical-1.mp3', volume: 0.6 },
  'windup-physical-heavy': { src: ['/sfx/windup-physical-heavy-1.mp3', '/sfx/windup-physical-heavy-2.mp3'], volume: 0.6 },
  'windup-physical-light': { src: ['/sfx/windup-physical-light-1.mp3', '/sfx/windup-physical-light-2.mp3'], volume: 0.6 },
  'windup-physical-ranged': { src: ['/sfx/windup-physical-ranged-1.mp3', '/sfx/windup-physical-ranged-2.mp3'], volume: 0.6 },

  // Combat: bespoke per-card / per-event signatures
  // Gorestorm + Bull Rush: the single AoE-swing signature (no varying).
  'aoe-melee': { src: '/sfx/aoe-melee.ogg', volume: 0.75, channels: 3 },
  // Stalk: alternates between the swing and the axe-throw whoosh-thunk.
  'aoe-melee-vary': { src: ['/sfx/aoe-melee.ogg', '/sfx/aoe-melee-1.wav'], volume: 0.75 },
  'spell-cinderstorm': { src: '/sfx/spell-cinderstorm.wav', volume: 0.8, channels: 2 },
  'spell-pyroblast': { src: '/sfx/spell-pyroblast.wav', volume: 0.8, channels: 2 },
  trap: { src: '/sfx/trap.wav', volume: 0.7, channels: 3 },

  // Per-card UNIQUE flavour (synced from fx-staging/sfx/04-uniques).
  'unique-warriors-cry': { src: '/sfx/sfx-unique-warriors-cry.mp3', volume: 0.85, channels: 2 },
  'unique-berserk': { src: '/sfx/sfx-unique-berserk.mp3', volume: 0.85, channels: 2 },

  // Announcer VO: a touch louder than combat beats (it is the herald voice over
  // the action) and single-channel (an announcement never overlaps itself).
  'vo-fight': { src: '/sfx/vo/fight.ogg', volume: 0.95, channels: 1 },
  'vo-death-multi': { src: '/sfx/vo/death-multi.ogg', volume: 0.95, channels: 1 },
  'vo-time': { src: '/sfx/vo/time.ogg', volume: 0.95, channels: 1 },
  'vo-power-1': { src: '/sfx/vo/power-1.ogg', volume: 0.92, channels: 1 },
  'vo-power-2': { src: '/sfx/vo/power-2.ogg', volume: 0.92, channels: 1 },
  'vo-power-3': { src: '/sfx/vo/power-3.ogg', volume: 0.92, channels: 1 },
  'vo-power-4': { src: '/sfx/vo/power-4.ogg', volume: 0.92, channels: 1 },
  'vo-power-5': { src: '/sfx/vo/power-5.ogg', volume: 0.92, channels: 1 },
  'vo-power-6': { src: '/sfx/vo/power-6.ogg', volume: 0.92, channels: 1 },
  'vo-power-7': { src: '/sfx/vo/power-7.ogg', volume: 0.92, channels: 1 },
  'vo-power-8': { src: '/sfx/vo/power-8.ogg', volume: 0.92, channels: 1 },
  'vo-power-9': { src: '/sfx/vo/power-9.ogg', volume: 0.92, channels: 1 },
  'vo-power-10': { src: '/sfx/vo/power-10.ogg', volume: 0.92, channels: 1 },
  'vo-dominion-1': { src: '/sfx/vo/dominion-1.ogg', volume: 0.95, channels: 1 },
  'vo-dominion-2': { src: '/sfx/vo/dominion-2.ogg', volume: 0.95, channels: 1 },
  'vo-dominion-3': { src: '/sfx/vo/dominion-3.ogg', volume: 0.95, channels: 1 },
  'vo-dominion-4': { src: '/sfx/vo/dominion-4.ogg', volume: 0.95, channels: 1 },
  'vo-dominion-5': { src: '/sfx/vo/dominion-5.ogg', volume: 0.95, channels: 1 }
};

const MUTE_KEY = 'hexpit.sfx.muted';
const VOLUME_KEY = 'hexpit.sfx.volume';
const DEFAULT_VOLUME = 0.7;

let pool: Partial<Record<SfxName, HTMLAudioElement[]>> = {};
let nextChannel: Partial<Record<SfxName, number>> = {};
let muted = false;
let masterVolume = DEFAULT_VOLUME;
let initialized = false;
let armed = false;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_VOLUME;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function loadMutePref(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMutePref(v: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    // ignore (private mode etc.)
  }
}

function loadVolumePref(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_VOLUME;
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return DEFAULT_VOLUME;
    return clamp01(parseFloat(raw));
  } catch {
    return DEFAULT_VOLUME;
  }
}

function saveVolumePref(v: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    // ignore (private mode etc.)
  }
}

function applyVolumeToPool(): void {
  for (const name of Object.keys(CLIPS) as SfxName[]) {
    const els = pool[name];
    if (!els) continue;
    const base = CLIPS[name].volume ?? 0.7;
    const eff = clamp01(base * masterVolume);
    for (const a of els) a.volume = eff;
  }
}

function initPool(): void {
  if (initialized || typeof Audio === 'undefined') return;
  initialized = true;
  muted = loadMutePref();
  masterVolume = loadVolumePref();
}

// Materialize one sound pool on first use. `preload = 'none'` is deliberate:
// variant elements retain the existing overlap/round-robin behaviour, while
// only a variant that is actually played consumes bandwidth and decoder work.
// Previously setup created ~200 elements and queued the complete SFX library.
function ensurePool(name: SfxName): HTMLAudioElement[] {
  const existing = pool[name];
  if (existing) return existing;

  const cfg = CLIPS[name];
  const base = cfg.volume ?? 0.7;
  const mk = (source: string): HTMLAudioElement => {
    const a = new Audio();
    a.preload = 'none';
    // R2 cutover: CLIPS are authored as `/sfx/...`; rewrite at one chokepoint.
    a.src = source.replace(/^\/sfx\//, `${SFX_BASE}/`);
    a.volume = clamp01(base * masterVolume);
    return a;
  };
  const sources = resolveSources(cfg.src);
  const els =
    // Multi-variant: one element per variant (round-robin = variety + channels).
    // Single-src: `channels` copies so an AoE's rapid hits don't cut off.
    sources.length > 1
      ? sources.map(mk)
      : Array.from({ length: cfg.channels ?? 2 }, () => mk(sources[0]));
  pool[name] = els;
  nextChannel[name] = 0;
  return els;
}

// Resolve a clip's playable sources. Any numbered src (`.../foo-2.mp3`), whether
// a single string OR the first item of an array, defers to the generated variant
// manifest for the FULL `<stem>-N` pool - so dropping a new take and running the
// sync makes it alternate with no registry edit (the `-N` convention, enforced).
// A bare / mixed src (e.g. `aoe-melee.ogg`, or the aoe-melee-vary pool) has no
// numbered stem and passes through unchanged.
function resolveSources(src: string | string[]): string[] {
  const first = Array.isArray(src) ? src[0] : src;
  const m = first.replace(/^\/sfx\//, '').match(/^(.*)-\d+\.(?:mp3|ogg|wav)$/i);
  const variants = m ? SFX_VARIANTS[m[1]] : undefined;
  if (variants && variants.length > 1) return variants.map((v) => `/sfx/${v}`);
  return Array.isArray(src) ? src : [src];
}

function armOnce(): void {
  if (armed) return;
  armed = true;
  // Touch every clip once so iOS / Safari unlocks playback. Pause
  // immediately; we just need the user-gesture credit on each element.
  for (const name of Object.keys(pool) as SfxName[]) {
    const els = pool[name];
    if (!els) continue;
    for (const a of els) {
      if (a.error) continue;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
        }).catch(() => {
          // Some browsers reject before gesture; harmless.
        });
      }
    }
  }
}

export interface WarmSfxOptions {
  /** Maximum number of distinct source URLs loading at once. */
  concurrency?: number;
  /** Stops queued work. Sources already handed to the browser may finish. */
  signal?: AbortSignal;
  /** Release a stalled slot so one missing asset cannot block the queue. */
  timeoutMs?: number;
}

// Audio elements used only to warm the HTTP/media cache. They are intentionally
// separate from playback pools: warming one URL must not allocate every overlap
// channel or every logical clip that happens to share that source.
const warmedSources = new Set<string>();
const warmingSources = new Map<string, Promise<boolean>>();
const warmingElements = new Map<string, HTMLAudioElement>();

function assetSource(source: string): string {
  return source.replace(/^\/sfx\//, `${SFX_BASE}/`);
}

function warmSource(source: string, timeoutMs: number): Promise<boolean> {
  if (warmedSources.has(source)) return Promise.resolve(true);
  const existing = warmingSources.get(source);
  if (existing) return existing;

  const pending = new Promise<boolean>((resolve) => {
    const audio = new Audio();
    warmingElements.set(source, audio);
    audio.preload = 'auto';
    audio.src = source;

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      audio.removeEventListener('loadeddata', onLoaded);
      audio.removeEventListener('canplaythrough', onLoaded);
      audio.removeEventListener('error', onError);
      warmingSources.delete(source);
      warmingElements.delete(source);
      if (loaded) warmedSources.add(source);
      resolve(loaded);
    };
    const onLoaded = () => finish(true);
    const onError = () => finish(false);

    audio.addEventListener('loadeddata', onLoaded, { once: true });
    audio.addEventListener('canplaythrough', onLoaded, { once: true });
    audio.addEventListener('error', onError, { once: true });
    timeout = setTimeout(onError, timeoutMs);
    // Defer load by one microtask so the shared-promise map is populated even
    // in a test double or browser implementation that fires synchronously.
    void Promise.resolve()
      .then(() => audio.load())
      .catch(() => finish(false));
  });
  warmingSources.set(source, pending);
  return pending;
}

/**
 * Warm selected logical clips without materializing their playback channels.
 *
 * Sources are deduplicated both within this call and globally, so aliases such
 * as `death` and `sting-death` cause one network request. Work is bounded and
 * cancellable at queue boundaries; playback still has its on-demand fallback.
 */
export async function warmSfx(
  names: readonly SfxName[],
  { concurrency = 2, signal, timeoutMs = 12_000 }: WarmSfxOptions = {}
): Promise<void> {
  if (typeof Audio === 'undefined' || signal?.aborted) return;

  const sources: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const config = CLIPS[name];
    if (!config) continue;
    for (const source of resolveSources(config.src)) {
      const url = assetSource(source);
      if (seen.has(url) || warmedSources.has(url)) continue;
      seen.add(url);
      sources.push(url);
    }
  }

  let cursor = 0;
  const worker = async () => {
    while (!signal?.aborted) {
      const index = cursor++;
      if (index >= sources.length) return;
      await warmSource(sources[index], timeoutMs);
    }
  };
  const workerCount = Math.min(sources.length, Math.max(1, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, worker));
}

// Compatibility entry point for older match callers. Unlike the old
// implementation, this does not allocate ~200 playback elements or start the
// complete library at once. New match startup code should prefer warmSfx() with
// the clips it can actually need.
let poolWarmed = false;
export function warmSfxPool(): void {
  if (poolWarmed || !initialized) return;
  poolWarmed = true;
  void warmSfx(Object.keys(CLIPS) as SfxName[], { concurrency: 2 });
}

export function setupSfx(): () => void {
  if (typeof window === 'undefined') return () => {};
  initPool();
  if (
    typeof window.addEventListener !== 'function' ||
    typeof window.removeEventListener !== 'function'
  )
    return () => {};
  const onGesture = () => armOnce();
  window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
  window.addEventListener('keydown', onGesture, { once: true, capture: true });
  return () => {
    window.removeEventListener('pointerdown', onGesture, { capture: true });
    window.removeEventListener('keydown', onGesture, { capture: true });
  };
}

// Play a clip. The pool ROUND-ROBINS through its variants each call, so a card
// played back-to-back (melee after melee) lands on a different take and stays
// fresh; the variants also double as channels so rapid-fire events never cut
// each other off. `rate` sets the playback speed (G14): tempo (instant = faster,
// channel = slower) + a small per-cast jitter, so even a single-variant clip
// feels alive instead of mechanically identical.
// `ignoreMute` plays even when the SFX bus is muted - used ONLY for the
// match-found alert, which intentionally rides past the mute-on-blur gate so a
// queued player hears it with the tab in the background. It still respects an
// EXPLICIT Sound-off (the user's mute drives the bus VOLUME to 0 separately), so
// someone who turned sound off stays silent.
export function playSfx(name: SfxName, rate = 1, opts?: { ignoreMute?: boolean }): void {
  if ((muted && !opts?.ignoreMute) || !initialized) return;
  const els = ensurePool(name);
  if (els.length === 0) return;
  // G15 cut-off fix: prefer a channel that is FREE (never started, finished, or
  // paused) over one mid-clip. The old pure round-robin would wrap back onto a
  // still-playing element and `currentTime = 0` chopped it audibly when a card
  // fired the same pooled clip faster than it could finish (an AoE's repeated
  // hits, a windup + body + sting landing close together). We only reuse a
  // live channel as a last resort, and then the OLDEST-started one.
  const start = (nextChannel[name] ?? 0) % els.length;
  let chosen = -1;
  let oldest = -1;
  let oldestTime = -Infinity;
  for (let off = 0; off < els.length; off++) {
    const i = (start + off) % els.length;
    const el = els[i];
    if (el.error) continue;
    // play() sets paused=false synchronously, so a channel started earlier this
    // tick reads as busy (not stolen); a never-started / armed / finished
    // channel reads paused. duration may be NaN pre-load - the comparison is
    // simply false then, which is fine (paused still covers those).
    const free = el.paused || el.ended || el.currentTime >= el.duration;
    if (free) {
      chosen = i;
      break;
    }
    // Track the element nearest the end of its clip as the fallback to steal.
    if (el.currentTime > oldestTime) {
      oldestTime = el.currentTime;
      oldest = i;
    }
  }
  if (chosen < 0) chosen = oldest;
  if (chosen < 0) return; // every channel errored
  // Advance the round-robin cursor past the chosen channel so the next call
  // spreads out (keeps variant variety across back-to-back plays).
  nextChannel[name] = chosen + 1;
  const a = els[chosen];
  try {
    cancelFade(a); // drop any pending tail-fade from a prior play of this element
    const baseVol = clamp01((CLIPS[name].volume ?? 0.7) * masterVolume);
    a.volume = baseVol; // a prior fade may have left it low - restore for this play
    a.currentTime = 0;
    // Clamp to a sane range; 1 resets a previously-rated element.
    a.playbackRate = rate < 0.5 ? 0.5 : rate > 2 ? 2 : rate;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    // Fade the tail out so the clip never ends on a hard edge ("stops in the wall").
    scheduleFade(a, baseVol);
  } catch {
    // Element busy or autoplay blocked; skip silently.
  }
}

// --- Tail fade-out ---------------------------------------------------------
// Every clip ramps its last ~85ms to silence so it never cuts off abruptly. The
// fade state is per-element; the next play of that element cancels a pending fade
// and restores full volume first (see playSfx).
const FADE_MS = 85;
interface FadeState {
  to?: ReturnType<typeof setTimeout>;
  raf?: number;
}
const fadeState = new WeakMap<HTMLAudioElement, FadeState>();
const metadataFadeWait = new WeakMap<HTMLAudioElement, EventListener>();
const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function cancelFade(a: HTMLAudioElement): void {
  const metadataListener = metadataFadeWait.get(a);
  if (metadataListener) {
    a.removeEventListener('loadedmetadata', metadataListener);
    metadataFadeWait.delete(a);
  }
  const f = fadeState.get(a);
  if (!f) return;
  if (f.to) clearTimeout(f.to);
  if (f.raf != null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(f.raf);
  fadeState.delete(a);
}

function scheduleFade(a: HTMLAudioElement, baseVol: number): void {
  const dur = a.duration;
  if (!Number.isFinite(dur) || dur <= 0) {
    // Lazy clips have no metadata on their first play. Schedule the same smooth
    // tail as soon as it arrives so on-demand loading does not change the sound.
    const onMetadata: EventListener = () => {
      metadataFadeWait.delete(a);
      if (!a.paused) scheduleFade(a, baseVol);
    };
    metadataFadeWait.set(a, onMetadata);
    a.addEventListener('loadedmetadata', onMetadata, { once: true });
    return;
  }
  const rate = a.playbackRate || 1;
  const startMs = ((dur - a.currentTime) / rate) * 1000 - FADE_MS;
  if (startMs <= 0) return; // clip shorter than the fade window
  const f: FadeState = {};
  fadeState.set(a, f);
  f.to = setTimeout(() => {
    const t0 = nowMs();
    const step = () => {
      const k = Math.min(1, (nowMs() - t0) / FADE_MS);
      a.volume = clamp01(baseVol * (1 - k));
      if (k < 1 && !a.paused && typeof requestAnimationFrame !== 'undefined') {
        f.raf = requestAnimationFrame(step);
      } else {
        fadeState.delete(a);
      }
    };
    step();
  }, startMs);
}

// --- Announcer VO helpers --------------------------------------------------
// Thin wrappers that clamp the dynamic index to the clips that actually exist
// and route through the same pool (so VO follows the SFX mute + volume bus).
export function voFight(): void {
  playSfx('vo-fight');
}
export function voTime(): void {
  playSfx('vo-time');
}
export function voPower(level: number): void {
  const n = Math.max(1, Math.min(10, Math.round(level)));
  playSfx(`vo-power-${n}` as SfxName);
}
export function voDominion(spawnNumber: number): void {
  const n = Math.max(1, Math.min(5, Math.round(spawnNumber)));
  playSfx(`vo-dominion-${n}` as SfxName);
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(v: boolean): void {
  muted = v;
  saveMutePref(v);
  if (v) {
    for (const name of Object.keys(pool) as SfxName[]) {
      const els = pool[name];
      if (!els) continue;
      for (const a of els) {
        if (!a.paused) {
          a.pause();
          a.currentTime = 0;
        }
      }
    }
  }
}

export function toggleSfxMuted(): boolean {
  setSfxMuted(!muted);
  return muted;
}

export function getSfxVolume(): number {
  return masterVolume;
}

export function setSfxVolume(v: number): void {
  masterVolume = clamp01(v);
  saveVolumePref(masterVolume);
  applyVolumeToPool();
}
