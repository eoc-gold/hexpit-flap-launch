// Combat SFX routing - the audio parallel of the G7 VFX taxonomy.
//
// A card's sound tracks the same axes its particles do: the CAST whoosh is
// keyed by DELIVERY (how the spell presents) and the IMPACT is keyed by SCHOOL
// (the elemental flavour), so a Lightning bolt zaps and a Holy strike rings,
// matching schoolColor() + the VFX sheets. Reuses resolveCardVfx() so the two
// systems never drift. Pure data: card in, SfxName out.
import type { Card } from '$lib/data/cards';
import { deliveryFor, physicalWeapon } from '$lib/render3d/fx/effect-families';
import type { SfxName } from './sfx';

// (2026-06-09) Per-card cast REPLACEMENTS were retired: the bespoke cast clips
// (Pyroblast roar, Cinderstorm boom, the AoE-melee swing) are now ADDITIVE
// layers via UNIQUE_SFX below - they play ON TOP of the card's normal windup +
// body, not instead of the cast cue. Trap triggers stay routed separately, by
// the 'trap' resolution substep in the playback loop.

// Whether a status is positive (used only as the sting fallback split below).
const POSITIVE_STATUS = /Power|Ward|Armor|Shell|Shield|Immune|Bless|Regen|Heal/i;

// ===========================================================================
// G14 3-layer routing (windup / body / sting + epic). The richer successor to
// castSfxFor / impactSfxFor / statusSfxFor above, derived entirely from card
// data per docs/aaa-push/G13-av-canon.md. Three beats:
//   windup (launch)  - by family + magnitude tier
//   body   (impact)  - by school + force tier; Physical splits by weapon
//   sting  (status)  - one fixed cue per applied keyword
//   epic   (bed)     - a sub layer under Legendaries
// Force tiers and the weapon split mirror tools/scripts/fx-profile-gen.mjs so
// the audio and the spell-fx-profiles inventory never drift. Cosmetic only.
// ===========================================================================

export type Weight = 'light' | 'medium' | 'heavy';

// Force tier from the RUNTIME damage amount (G13 §4): light 1-2, medium 3-4,
// heavy 5+. Heavy is where the AAA combination fires, so a Power-doubled hit
// that crosses 5 lands in the heavy take live.
export function weightTier(maxHit: number): Weight {
  if (maxHit >= 5) return 'heavy';
  if (maxHit >= 3) return 'medium';
  return 'light';
}

// A "big finisher" reads heavier at windup. Rarity is the clean proxy: the pool
// is cost-driven (1class=Common, 1role=Rare, 2=Epic, 3=Legendary), so Epic+ are
// the 2-3 mana payoff cards that earn the heavy telegraph.
function isBig(card: Card): boolean {
  return card.rarity === 'Epic' || card.rarity === 'Legendary';
}

const BODY_SCHOOL: Record<string, string> = {
  Fire: 'fire',
  Lightning: 'lightning',
  Nature: 'nature',
  Magic: 'magic',
  Void: 'void',
  Holy: 'holy',
  Blood: 'blood'
};

// The cast/windup for a MAGIC damage spell. The windup folder is now only swings
// + movement, so ALL magic (elemental AND the generic arcane Magic school) charges
// from its OWN school body: the cast is the school's LIGHT body (a Fireball charges
// in fire, an arcane bolt in magic - never a separate generic whoosh) and the
// impact is its MEDIUM/HEAVY body. The cast tier sits one below the impact, so a
// big spell reads as medium-cast -> heavy-hit. `maxHit` (the eventual impact)
// picks the cast tier.
// Epic + Legendary cards are the marquee tier: a long 2s beat, the full
// light->medium->heavy build, and the VFX flourish - so they FEEL legendary.
export function isMarquee(card: Card | null | undefined): boolean {
  return card?.rarity === 'Epic' || card?.rarity === 'Legendary';
}

// The cast/windup for a MAGIC damage spell: the school's LIGHT body charges (a
// fireball charges in fire, a holy bolt in holy - the SAME school as its impact,
// never a generic whoosh), one tier below the impact. maxHit picks the tier.
function magicWindup(card: Card, maxHit: number): SfxName | null {
  const s = BODY_SCHOOL[card.school ?? ''];
  if (!s) return null; // no mappable school (e.g. Emblem): no cast
  const castTier = !isMarquee(card) && maxHit >= 5 ? 'medium' : 'light';
  return `body-${s}-${castTier}` as SfxName;
}

// Beat 1: the windup/telegraph clip. Only DAMAGE casts (a swing, a ranged shot,
// or a magic charge) and MOVEMENT have a windup; heals ride their heal sound,
// and buffs / debuffs / trap placements ride their stings (no windup folder).
// `maxHit` lets a magic cast pick its school-tier charge (see magicWindup).
// Null = silent cast (the caller plays nothing, or the emblem cue for Emblems).
// Gap-closers resolve as a melee / AoE hit (so the VFX slams), but their CAST is
// a charge across the board: they should whoosh in (move windup) and then slam,
// not wind up a stationary swing. The body still plays the impact hit.
const GAP_CLOSER = new Set([
  'warrior-charge',
  'warrior-bull-rush',
  'rogue-stalk',
  'druid-bestial-charge'
]);

// Per-card SFX overrides (the bespoke seam): a few cards read better with a
// hand-picked windup / body than their school+delivery produces.
//  - Volley Shot: a Magic card, but a HAIL OF ARROWS - looses from a bow + a
//    heavy pierce, not an arcane pop.
//  - Berserk: a self-cut empower - a light BLOOD body into the Power sting
//    (windup forced silent so it's just the cut + the buff).
//  - Hex Lock: heals the enemy as a downside, but it's a Magic control spell -
//    play a magic charge, no heal sound (noHeal).
// `windup: null` forces a silent cast; `noHeal` mutes the heal sound.
const SFX_OVERRIDE: Record<
  string,
  { windup?: SfxName | null; body?: SfxName; noHeal?: boolean }
> = {
  'ranger-volley-shot': { windup: 'windup-physical-ranged', body: 'body-physical-pierce-heavy' },
  // Poison Cloud is gas drifting in, NOT a piercing arrow shot - so it gets the
  // POISON cue at cast (a wet hiss), never the heavy bow/pierce windup.
  'ranger-poison-cloud': { windup: 'sting-poison' },
  // Fire Wall spawns a ground field (a summon, so it had no cast windup and was
  // silent on play). Give it a Fire light cast cue so it sounds like fire, not
  // the generic summon - the end-of-turn ticks fire on their own 'trap' beat.
  'mage-fire-wall': { windup: 'body-fire-light' },
  // Dragon Shot is a Ranger arrow that ROARS into a dragon's-breath beam: it
  // still draws + looses like a heavy bow (the arrow windup) but its impact is
  // the Fire body (school-routed), so the arrow + the fire both read.
  'ranger-dragon-shot': { windup: 'windup-physical-ranged' },
  'warrior-berserk': { windup: null, body: 'body-blood-light' },
  'mage-hex-lock': { windup: 'body-magic-light', noHeal: true },
  // Bramblethorns (Epic Nature) deals no damage, so it never reaches the body/
  // impact path and was silent on cast (you only heard the thorns terrain) -
  // deliveryFor reads "Spawn Thorns" as a summon, which has no windup. Give the
  // cast the Nature light charge (the canonical magic-cast clip, distinct from
  // the medium/heavy impact tiers) so the Epic actually sounds on cast.
  'druid-bramblethorns': { windup: 'body-nature-light' },

  // --- Silent-cast fix (2026-06-09 audit) -----------------------------------
  // These cards apply no damage / heal / status on PLAY, so they fell through
  // to a null windup AND had no sting to ride - inaudible at the moment you
  // play them (the gap the Devotion aura silence surfaced). Give each a
  // school-keyed LIGHT body as a cast cue so the play registers in its own
  // elemental voice (Devotion rings Holy, a Poison Rune hisses Nature, etc.).
  // LIGHT is the cast tier across the audio taxonomy (magicWindup + the
  // Bramblethorns precedent); medium/heavy are impacts, so a light cast can
  // never collide with the card's own impact stack (the cast != impact
  // invariant). The 6 Rune tokens override the type==='Rune' silent rule below
  // (the override is checked first). Their later effect stings (Armor/Shell
  // apply, Poison discard) still fire on their own beats, so there is no clash.
  'rune-devotion': { windup: 'body-holy-light' },
  'rune-poison': { windup: 'body-nature-light' },
  'rune-curse': { windup: 'body-void-light' },
  'rune-rot': { windup: 'body-nature-light' },
  'rune-resilience': { windup: 'body-holy-light' },
  'rune-petalveil': { windup: 'body-nature-light' },
  'paladin-devotion-aura': { windup: 'body-holy-light' },
  'priest-resilience': { windup: 'body-magic-light' },
  'druid-scarlet-petalveil': { windup: 'body-nature-light' },
  'priest-dispel': { windup: 'body-magic-light' },
  'druid-decompose': { windup: 'body-nature-light' }
};

// Bespoke MULTI-clip body plans: a card whose impact should be a quick combo of
// two takes rather than one hit. Keyed by card id; wins over the generic body.
const BODY_PLAN_OVERRIDE: Record<string, { name: SfxName; delayMs: number }[]> = {
  // Gorestorm is a spinning gore-swing that felt thin as a single blunt thud.
  // A slash sweep (the spin connecting) chased by a heavy blunt finish makes
  // the AoE read as a meaty two-beat combo.
  'warrior-gorestorm': [
    { name: 'body-physical-slash-medium', delayMs: 0 },
    { name: 'body-physical-blunt-heavy', delayMs: 130 }
  ]
};

// Per-card UNIQUE flavour cue (04-uniques): an EXTRA signature played ON TOP of
// the card's rule-based sounds at cast (its stings / body still fire) - e.g. a
// warrior's CRY over Fighter's Cry's shield, a berserker roar over Berserk. One
// per card; this map grows as more uniques are sourced. Plays at the cast beat.
const UNIQUE_SFX: Record<string, SfxName> = {
  'warrior-fighters-cry': 'unique-warriors-cry',
  'warrior-berserk': 'unique-berserk',
  // Former cast-replacements, now additive (layer on top of the normal cast).
  'mage-pyroblast': 'spell-pyroblast',
  'mage-cinderstorm': 'spell-cinderstorm',
  // Cluster: one melee swing shared across the spin / charge / lunge / kick cards.
  'warrior-gorestorm': 'aoe-melee',
  'warrior-bull-rush': 'aoe-melee',
  'rogue-stalk': 'aoe-melee-vary',
  'rogue-kick': 'aoe-melee'
};

export function uniqueSfxFor(card: Card | null | undefined): SfxName | null {
  if (!card?.id) return null;
  return UNIQUE_SFX[card.id] ?? null;
}

export function windupSfxFor(card: Card | null | undefined, maxHit = 0): SfxName | null {
  if (!card) return null;
  const ov = SFX_OVERRIDE[card.id];
  if (ov && 'windup' in ov) return ov.windup ?? null; // explicit override (incl. null = silent)
  if (card.type === 'Emblem' || card.type === 'Rune') return null;
  const phasing = /Phasing/i.test(card.text || '');
  if (GAP_CLOSER.has(card.id)) return phasing ? 'windup-move-magic' : 'windup-move-physical';
  const range = typeof card.range === 'number' ? card.range : 1;
  switch (deliveryFor(card)) {
    case 'dash':
      return phasing ? 'windup-move-magic' : 'windup-move-physical';
    case 'projectile':
      return card.school === 'Physical' ? 'windup-physical-ranged' : magicWindup(card, maxHit);
    case 'melee':
      if (card.school !== 'Physical') return magicWindup(card, maxHit);
      return isBig(card) || card.cls === 'Warrior' || card.cls === 'Paladin'
        ? 'windup-physical-heavy'
        : 'windup-physical-light';
    case 'ground-aoe':
      if (card.school === 'Physical')
        return range >= 2 ? 'windup-physical-ranged' : 'windup-physical-heavy';
      return magicWindup(card, maxHit);
    // heal / self-aura (buff) / debuff / summon (trap): no windup - the heal
    // sound or the applied sting carries the cast.
    default:
      return null;
  }
}

// The heal sound (G14): all healing in the pool is Holy or Nature, so a heal
// plays that school's light/heavy heal take by amount. Non-Holy heals default to
// Nature (the druid/regrowth flavour). Plays at the heal effect, not as a windup.
export function healSfxFor(card: Card | null | undefined, amount: number): SfxName | null {
  if (card && SFX_OVERRIDE[card.id]?.noHeal) return null; // e.g. Hex Lock: a magic spell, not a heal
  const school = card?.school === 'Holy' ? 'holy' : 'nature';
  const tier = amount >= 4 ? 'heavy' : 'light';
  return `heal-${school}-${tier}` as SfxName;
}

// The IMPACT force tier. Physical keeps the full light / medium / heavy by
// damage - its setup SWING is a separate pool, so the swing + a light slash
// never clash. Magic NEVER impacts on 'light': light is reserved for the
// projectile / cast (magicWindup), so a magic hit is medium or heavy and a card
// can never play the same school-tier clip as both its cast AND its impact.
function impactTier(card: Card, maxHit: number): Weight {
  const physical = !card.school || card.school === 'Physical';
  if (physical) return weightTier(maxHit);
  return maxHit >= 5 ? 'heavy' : 'medium';
}

// The body key for a card at an EXPLICIT tier (school body, or the physical
// weapon body). Null for fist (no asset) + Emblem / unmapped school.
function bodyKey(card: Card, tier: Weight): SfxName | null {
  if (!card.school || card.school === 'Physical') {
    const w = physicalWeapon(card);
    if (w === 'fist') return null; // unarmed: no metallic body; caller falls back
    return `body-physical-${w}-${tier}` as SfxName;
  }
  const s = BODY_SCHOOL[card.school];
  if (!s) return null; // Emblem / unmapped school: no body
  return `body-${s}-${tier}` as SfxName;
}

// Beat 2: the body/impact clip, by school + force tier; Physical splits by
// weapon. `maxHit` is the heaviest single hit of the event (runtime). Null for
// Emblem / unknown-school and for fist (no body asset yet, an open gap) so the
// caller can play a soft generic hit instead.
export function bodySfxFor(card: Card | null | undefined, maxHit: number): SfxName | null {
  if (!card) return null;
  return SFX_OVERRIDE[card.id]?.body ?? bodyKey(card, impactTier(card, maxHit));
}

// The full IMPACT body plan (G14): a list of body clips with stagger delays.
//  - A normal card hits with one clip at its force tier.
//  - A LEGENDARY (epic) plays a rising stack of its own school across the long
//    2s beat so it feels big: a magic Legendary already charged LIGHT at cast,
//    so its body builds MEDIUM -> HEAVY; a physical Legendary cast a swing, so
//    its body plays the full LIGHT -> MEDIUM -> HEAVY weapon climb. Each clip
//    keeps its deterministic-by-id variant; the caller staggers + rate-jitters.
export function bodyPlanFor(
  card: Card | null | undefined,
  maxHit: number
): { name: SfxName; delayMs: number }[] {
  if (!card) return [];
  // A bespoke MULTI-clip combo (e.g. Gorestorm = slash sweep + heavy blunt)
  // wins outright.
  const plan = BODY_PLAN_OVERRIDE[card.id];
  if (plan) return plan;
  // A bespoke single-body override (e.g. Volley = a heavy arrow pierce) wins next.
  const ov = SFX_OVERRIDE[card.id];
  if (ov?.body) return [{ name: ov.body, delayMs: 0 }];
  if (isMarquee(card)) {
    const physical = !card.school || card.school === 'Physical';
    const tiers: { t: Weight; delayMs: number }[] = physical
      ? [
          { t: 'light', delayMs: 0 },
          { t: 'medium', delayMs: 170 },
          { t: 'heavy', delayMs: 340 }
        ]
      : [
          { t: 'medium', delayMs: 0 },
          { t: 'heavy', delayMs: 220 }
        ];
    return tiers
      .map(({ t, delayMs }) => ({ name: bodyKey(card, t), delayMs }))
      .filter((p): p is { name: SfxName; delayMs: number } => p.name != null);
  }
  const name = bodyKey(card, impactTier(card, maxHit));
  return name ? [{ name, delayMs: 0 }] : [];
}

// Beat 3: the status sting, one fixed cue per applied keyword. Buckets the
// engine's status strings into the 28 sting folders; unmapped positives fall to
// ward, negatives to curse, truly unknown -> null (the float still renders).
const STING_SFX: Record<string, SfxName> = {
  Stun: 'sting-stun',
  Freeze: 'sting-stun',
  Frozen: 'sting-stun',
  Poison: 'sting-poison',
  Rot: 'sting-rot',
  Burn: 'sting-burn',
  Shock: 'sting-shock',
  Silence: 'sting-silence',
  Hexbound: 'sting-hexbound',
  Power: 'sting-power',
  Ward: 'sting-ward',
  Armor: 'sting-armor',
  Shell: 'sting-shell',
  Shield: 'sting-shield',
  Immune: 'sting-immune',
  Expose: 'sting-expose',
  Weak: 'sting-weak',
  Curse: 'sting-curse',
  Stealth: 'sting-stealth',
  Retaliate: 'sting-retaliate',
  Flank: 'sting-flank',
  Hound: 'sting-hound',
  Cleanse: 'sting-cleanse',
  Push: 'sting-push',
  Trap: 'sting-trap'
  // Regen / heal-over-time has no sting: it rides the heal sound (holy / nature).
};

export function stingSfxFor(status: string | null | undefined): SfxName | null {
  if (!status) return null;
  const direct = STING_SFX[status];
  if (direct) return direct;
  return POSITIVE_STATUS.test(status) ? 'sting-ward' : 'sting-curse';
}

// Playback-rate TEMPO by card speed (G14): an Instant snaps faster, a Channel
// spell stretches slower, everything else plays at its natural rate. Multiply by
// sfxJitter() for the per-cast variance.
export function tempoRate(card: Card | null | undefined): number {
  if (!card) return 1;
  if (card.channel) return 0.9;
  if (/\bInstant\b/.test(card.text || '')) return 1.14;
  return 1;
}

// A small per-cast playback-rate jitter (+/-8%) so a repeated card doesn't sound
// mechanically identical. Cosmetic + UI-only (never touches engine state), so a
// non-deterministic source is fine here.
export function sfxJitter(): number {
  return 0.92 + Math.random() * 0.16;
}
