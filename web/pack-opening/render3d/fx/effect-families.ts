// Per-card VFX taxonomy for the 3D board (AAA-push G7).
//
// Every one of the 117 cards resolves to a VFX descriptor via resolveCardVfx():
// a DELIVERY (how the spell presents) + a SCHOOL (the elemental flavour/tint) +
// per-card scale/repeat knobs. The delivery is the load-bearing axis the lead
// asked for:
//   projectile  - ranged single-target damage: a focused billboard impact
//   melee       - range<=1 damage: a swing/slam at the target
//   ground-aoe  - area shapes: a FLAT ground hero (scorch + ring) with rising
//                 flame/embers, so AoEs read as ground-focused, not mid-air
//   self-aura   - r0 self/ally buffs: a ground ring + rising sparkle column
//   heal        - heal sparkle + ground ring (school-tinted: Holy gold, ...)
//   debuff      - enemy modifier, no damage: a swirl at the target
//   summon      - trap/cloud placement: a settling ground ring
//   dash        - movement: a dust puff at the landing hex
//   emblem      - class sigil burst at the caster
//   rune        - minimal (rune ticks ride the impact of their damage)
// schoolColor() stays the dominant tint, so VFX track the board's colour-coding.
//
// This is the foundation for eventual PER-CARD bespoke VFX: CARD_OVERRIDES is
// the seam (drop a card id in with scale/repeat/delivery/school tweaks). A card
// with no override still gets full coverage from its delivery+school, and an
// unknown school falls back to the Physical kit (the catch-all). Pure data +
// pure resolution: no THREE, fully unit-testable.
import type { Card } from '$lib/data/cards';

export type EffectBeat =
  | 'cast'
  | 'marquee'
  | 'impact'
  | 'aoe-tile'
  | 'apply'
  | 'heal'
  | 'leaf-swirl'
  | 'death'
  | 'dash'
  | 'fizzle'
  | 'cloud';

export type Delivery =
  | 'projectile'
  | 'melee'
  | 'ground-aoe'
  | 'self-aura'
  | 'heal'
  | 'debuff'
  | 'summon'
  | 'dash'
  | 'emblem'
  | 'rune';

// --- Asset registries -------------------------------------------------
export interface SheetDef {
  file: string;
  cols: number;
  rows: number;
  frames: number;
}

// Animated flipbook sheets served from /vfx/sheets/.
//
// Two generations live here:
//   - the original Brackeys bundle (white sheets, tinted per school) - kept for
//     the heavy-combo starburst, the hex-shield dome, fizzle smoke, blood/dirt
//     grit, and as the fallback kit; and
//   - the G15 PURPOSE-BUILT packs (`elements/`, `weapons/`, `status/`): COLOURED
//     per-element cast/projectile/impact sheets, per-weapon swings + bursts, and
//     one glyph per status keyword. These read as their element ALREADY, so they
//     render UNtinted (a layer marks itself `native`); see beatLayers/elemHero.
//
// Grids (cols x rows / frames) were computed per asset from its pixel dims +
// the pack's FrameNB note: element projectiles are 6x8/48, most impacts 6x6/32,
// most casts 6x6/32 (Fire cast 6x4/24, Ice impact 4x4/16, Water cast 8x4/32),
// status glyphs all 4x4/16, weapons per their Readme.
export const SHEETS: Record<string, SheetDef> = {
  fire_ring: { file: 'fire_ring.png', cols: 6, rows: 5, frames: 30 },
  fire_point: { file: 'fire_point.png', cols: 6, rows: 5, frames: 30 },
  dithered_fire: { file: 'dithered_fire.png', cols: 6, rows: 5, frames: 30 },
  electric_ring: { file: 'electric_ring.png', cols: 6, rows: 5, frames: 30 },
  blood_impact: { file: 'blood_impact.png', cols: 6, rows: 5, frames: 30 },
  explosion: { file: 'explosion.png', cols: 6, rows: 5, frames: 30 },
  star_explosion: { file: 'star_explosion.png', cols: 6, rows: 5, frames: 30 },
  vortex: { file: 'vortex.png', cols: 6, rows: 5, frames: 30 },
  wavy_purple: { file: 'wavy_purple.png', cols: 6, rows: 5, frames: 30 },
  wavy_blue: { file: 'wavy_blue.png', cols: 6, rows: 5, frames: 30 },
  lightstreaks: { file: 'lightstreaks.png', cols: 6, rows: 5, frames: 30 },
  big_hit: { file: 'big_hit.png', cols: 6, rows: 5, frames: 30 },
  impact_white: { file: 'impact_white.png', cols: 6, rows: 4, frames: 24 },
  charge: { file: 'charge.png', cols: 7, rows: 6, frames: 42 },
  // G14: per-weapon physical impacts (white -> tint per school) + the heavy
  // combination starburst, and the shield/ward glyph.
  slash_white: { file: 'slash_white_3x3.png', cols: 3, rows: 3, frames: 9 },
  blunt_white: { file: 'blunt_white_3x3.png', cols: 3, rows: 3, frames: 9 },
  warrior_burst: { file: 'warrior-burst_white_4x2.png', cols: 4, rows: 2, frames: 8 },
  gore_slash: { file: 'gore-slash_red_7x1.png', cols: 7, rows: 1, frames: 7 },
  hexshield: { file: 'shield_5x4.png', cols: 5, rows: 4, frames: 20 },
  // A WHITE/greyscale hex-shield dome (max-channel desaturation of shield_5x4),
  // so a per-status tint multiplies TRUE (the cyan original turned every tint
  // green/blue). Used by the protective-dome cluster.
  hexshield_white: { file: 'shield_white_5x4.png', cols: 5, rows: 4, frames: 20 },

  // --- G15 element packs: cast windup / impact (the projectile sheets fly in
  // Projectiles.svelte, registered there). Coloured -> rendered native. ---
  'fire-cast': { file: 'elements/fire-cast.png', cols: 6, rows: 4, frames: 24 },
  'fire-impact': { file: 'elements/fire-impact.png', cols: 6, rows: 6, frames: 32 },
  'lightning-cast': { file: 'elements/lightning-cast.png', cols: 6, rows: 6, frames: 32 },
  'lightning-impact': { file: 'elements/lightning-impact.png', cols: 6, rows: 6, frames: 32 },
  'nature-cast': { file: 'elements/nature-cast.png', cols: 6, rows: 6, frames: 32 },
  'nature-impact': { file: 'elements/nature-impact.png', cols: 6, rows: 6, frames: 32 },
  'holy-cast': { file: 'elements/holy-cast.png', cols: 6, rows: 6, frames: 30 },
  'holy-impact': { file: 'elements/holy-impact.png', cols: 6, rows: 6, frames: 32 },
  'arcane-cast': { file: 'elements/arcane-cast.png', cols: 6, rows: 6, frames: 32 },
  'arcane-impact': { file: 'elements/arcane-impact.png', cols: 6, rows: 6, frames: 32 },
  'ice-cast': { file: 'elements/ice-cast.png', cols: 6, rows: 6, frames: 32 },
  'ice-impact': { file: 'elements/ice-impact.png', cols: 4, rows: 4, frames: 16 },
  'water-cast': { file: 'elements/water-cast.png', cols: 8, rows: 4, frames: 32 },
  'water-impact': { file: 'elements/water-impact.png', cols: 6, rows: 6, frames: 32 },
  'air-cast': { file: 'elements/air-cast.png', cols: 6, rows: 6, frames: 32 },
  'air-impact': { file: 'elements/air-impact.png', cols: 6, rows: 6, frames: 32 },
  'acid-cast': { file: 'elements/acid-cast.png', cols: 6, rows: 6, frames: 36 },
  'acid-impact': { file: 'elements/acid-impact.png', cols: 6, rows: 6, frames: 32 },

  // --- G15 weapon packs: the directional SWING (melee hero) + the IMPACT burst
  // (lands the hit). The ranged beams (sonic-beam / thunder-needle /
  // void-singularity) fly in Projectiles.svelte. Coloured -> native. ---
  'sonic-slash': { file: 'weapons/sonic-slash.png', cols: 10, rows: 2, frames: 20 },
  'sonic-impact': { file: 'weapons/sonic-impact.png', cols: 10, rows: 2, frames: 16 },
  'thunder-thrust': { file: 'weapons/thunder-thrust.png', cols: 10, rows: 2, frames: 20 },
  'thunder-impact': { file: 'weapons/thunder-impact.png', cols: 8, rows: 2, frames: 16 },
  'void-scythe': { file: 'weapons/void-scythe.png', cols: 10, rows: 3, frames: 24 },
  'void-impact': { file: 'weapons/void-impact.png', cols: 4, rows: 6, frames: 24 },

  // --- G15 status glyphs: one 4x4/16 sheet per keyword, fired on the 'apply'
  // beat over the affected fighter. Coloured -> native. ---
  'glyph-armor': { file: 'status/armor.png', cols: 4, rows: 4, frames: 16 },
  'glyph-bleed': { file: 'status/bleed.png', cols: 4, rows: 4, frames: 16 },
  'glyph-blessed': { file: 'status/blessed.png', cols: 4, rows: 4, frames: 16 },
  'glyph-burn': { file: 'status/burn.png', cols: 4, rows: 4, frames: 16 },
  'glyph-charm': { file: 'status/charm.png', cols: 4, rows: 4, frames: 16 },
  'glyph-confusion': { file: 'status/confusion.png', cols: 4, rows: 4, frames: 16 },
  'glyph-curse': { file: 'status/curse.png', cols: 4, rows: 4, frames: 16 },
  'glyph-fear': { file: 'status/fear.png', cols: 4, rows: 4, frames: 16 },
  'glyph-freeze': { file: 'status/freeze.png', cols: 4, rows: 4, frames: 16 },
  'glyph-haste': { file: 'status/haste.png', cols: 4, rows: 4, frames: 16 },
  'glyph-heal': { file: 'status/heal.png', cols: 4, rows: 4, frames: 16 },
  'glyph-invisibility': { file: 'status/invisibility.png', cols: 4, rows: 4, frames: 16 },
  'glyph-poison': { file: 'status/poison.png', cols: 4, rows: 4, frames: 16 },
  'glyph-rage': { file: 'status/rage.png', cols: 4, rows: 4, frames: 16 },
  'glyph-regen': { file: 'status/regen.png', cols: 4, rows: 4, frames: 16 },
  'glyph-shield': { file: 'status/shield.png', cols: 4, rows: 4, frames: 16 },
  'glyph-shock': { file: 'status/shock.png', cols: 4, rows: 4, frames: 16 },
  'glyph-silence': { file: 'status/silence.png', cols: 4, rows: 4, frames: 16 },
  'glyph-sleep': { file: 'status/sleep.png', cols: 4, rows: 4, frames: 16 },
  'glyph-slow': { file: 'status/slow.png', cols: 4, rows: 4, frames: 16 },
  'glyph-stun': { file: 'status/stun.png', cols: 4, rows: 4, frames: 16 },
  'glyph-weaken': { file: 'status/weaken.png', cols: 4, rows: 4, frames: 16 }
};

// Soft detail sprites served from /vfx/particles/.
export const SPRITES: Record<string, string> = {
  spark: 'spark.png',
  ember: 'ember.png',
  star: 'star.png',
  light: 'light.png',
  magic: 'magic.png',
  smoke: 'smoke.png',
  dirt: 'dirt.png',
  flame: 'flame.png',
  glow: 'glow.png',
  ring: 'ring.png',
  scorch: 'scorch.png',
  slash: 'slash.png',
  orb: 'orb.png',
  // G14: the unarmed (fist) bone-grey poof + the blood splat.
  fist_dust: 'fist-dust.png',
  fist_poof: 'fist-poof.png',
  blood_splat: 'blood_splat.png'
};

export type Tint = 'school' | string;
export type Blend = 'additive' | 'normal';

export interface FlipbookLayer {
  kind: 'flipbook';
  sheet: keyof typeof SHEETS;
  size: number;
  life: number;
  tint: Tint;
  blend: Blend;
  growth?: number; // world-unit growth per damage point above 1
  y?: number;
  bright?: number;
  ground?: boolean; // lay flat on the ground (HorizontalBillBoard)
  // G15: a purpose-built COLOURED sheet (element / weapon / status glyph). It
  // already reads as its element, so the renderer shows it at its native colour
  // (a near-white tint) instead of multiplying by the school colour.
  native?: boolean;
  // Spin the sheet a touch over its life (radians) so a flat ring / glyph reads
  // as energy, not a decal. Cosmetic; renderer applies it as material rotation.
  spin?: number;
}

export interface SprayLayer {
  kind: 'spray';
  sprite: keyof typeof SPRITES;
  count: number;
  perIntensity?: number;
  maxCount?: number;
  life: [number, number];
  speed: [number, number];
  size: [number, number];
  sizeOverLife: 'shrink' | 'grow' | 'pulse' | 'flat';
  gravity: number; // +Y rises, -Y falls
  tint: Tint;
  blend: Blend;
  radius: number;
  y?: number;
  bright?: number;
  ground?: boolean;
}

export type Layer = FlipbookLayer | SprayLayer;

// --- School kits ------------------------------------------------------
// G15: each school's purpose-built CAST windup + IMPACT hero (coloured element
// art, rendered native) plus its grit sprites. `cast`/`impact` are the new
// per-element sheets; `native` flags them so the renderer doesn't tint them.
// Schools without a bespoke pack (Blood, Physical, Emblem) keep tinted Brackeys
// sheets and `native: false`. Physical resolves its hero per WEAPON (see
// WEAPON_KIT) so its `impact` here is only the fallback when no weapon is known.
interface SchoolKit {
  cast: keyof typeof SHEETS; // cast-beat windup at the caster
  impact: keyof typeof SHEETS; // the hero burst at the target (also laid flat for AoE)
  spark: keyof typeof SPRITES;
  rise: keyof typeof SPRITES;
  native: boolean; // cast + impact are coloured element art (render untinted)
}

export const SCHOOL_KIT: Record<string, SchoolKit> = {
  Fire: { cast: 'fire-cast', impact: 'fire-impact', spark: 'ember', rise: 'flame', native: true },
  Lightning: { cast: 'lightning-cast', impact: 'lightning-impact', spark: 'spark', rise: 'spark', native: true },
  Nature: { cast: 'nature-cast', impact: 'nature-impact', spark: 'star', rise: 'star', native: true },
  Holy: { cast: 'holy-cast', impact: 'holy-impact', spark: 'light', rise: 'light', native: true },
  Magic: { cast: 'arcane-cast', impact: 'arcane-impact', spark: 'magic', rise: 'magic', native: true },
  // Void has no element pack of its own; it reaps with the Void Scythe burst and
  // charges with the arcane windup (close enough in hue, reads as dark energy).
  Void: { cast: 'arcane-cast', impact: 'void-impact', spark: 'magic', rise: 'magic', native: true },
  // Blood: no element pack. Keep the red Brackeys impact + ember/smoke grit; the
  // Bleed glyph rides the apply beat. Tinted (native:false) so schoolColor reds it.
  Blood: { cast: 'charge', impact: 'blood_impact', spark: 'ember', rise: 'smoke', native: false },
  // Physical resolves per-weapon; this is only the no-weapon fallback.
  Physical: { cast: 'charge', impact: 'big_hit', spark: 'dirt', rise: 'dirt', native: false },
  Emblem: { cast: 'charge', impact: 'charge', spark: 'light', rise: 'star', native: false }
};

function kit(school: string): SchoolKit {
  return SCHOOL_KIT[school] ?? SCHOOL_KIT.Physical;
}

// --- Physical weapon (G13 §3) ----------------------------------------
// The weapon a Physical hit LANDS with: shape, not colour. Shared by the VFX
// impact sheet here and the audio body bucket (combat.ts imports this), so the
// two never drift. Mirrors fx-profile-gen.mjs OVERRIDES.
export type Weapon = 'slash' | 'blunt' | 'pierce' | 'fist';

const WEAPON_OVERRIDE: Record<string, Weapon> = {
  // Kick stays unarmed (fist VFX, no body clip) - its hit is carried by the
  // windup + the aoe-melee cluster swing (see UNIQUE_SFX in combat.ts). Pummel
  // reads as a light blunt slam (real blunt body).
  'rogue-kick': 'fist',
  'warrior-pummel': 'blunt'
};

export function physicalWeapon(card: Card | null | undefined): Weapon {
  if (!card) return 'blunt';
  const o = WEAPON_OVERRIDE[card.id];
  if (o) return o;
  const range = typeof card.range === 'number' ? card.range : 1;
  if (card.cls === 'Rogue') return 'slash';
  if (card.cls === 'Ranger') return range >= 2 ? 'pierce' : 'slash';
  // Warriors are the heavy-blunt class: their blows always LAND blunt (slam /
  // shoulder charge / hammer), never a thrust-pierce - even at range 2 (Charge).
  // The old range>=2 fallback made Charge read as a piercing thrust, wrong for
  // a warrior.
  if (card.cls === 'Warrior') return 'blunt';
  return range >= 2 ? 'pierce' : 'blunt';
}

// G15 per-weapon art: the directional SWING (the melee hero - a sonic crescent,
// a void scythe sweep, a thunder thrust) + the IMPACT burst that lands the hit.
// Coloured, so they render native. fist has no pack (keeps its bone-grey poof).
//   slash  (Rogue / light melee) -> Sonicwind sword
//   pierce (Ranger / ranged stab) -> Thunder Rapier
//   blunt  (Warrior / Paladin heavy) -> Void Reaper scythe
interface WeaponKit {
  swing: keyof typeof SHEETS | null; // the melee swing hero
  impact: keyof typeof SHEETS | null; // the burst where the blow / shot lands
}
const WEAPON_KIT: Record<Weapon, WeaponKit> = {
  slash: { swing: 'sonic-slash', impact: 'sonic-impact' },
  pierce: { swing: 'thunder-thrust', impact: 'thunder-impact' },
  blunt: { swing: 'void-scythe', impact: 'void-impact' },
  fist: { swing: null, impact: null }
};

// --- Status glyphs (G15) ---------------------------------------------
// One coloured 4x4/16 glyph sheet per engine status keyword, fired over the
// affected fighter on the 'apply' beat. Keys map our keyword vocabulary onto
// the 22 sourced sheets; unmapped keywords fall through to no glyph (the status
// float + the supporting aura still render). Bleed covers Blood damage flavour.
export const STATUS_GLYPH: Record<string, keyof typeof SHEETS> = {
  Stun: 'glyph-stun',
  Freeze: 'glyph-freeze',
  Frozen: 'glyph-freeze',
  Silence: 'glyph-silence',
  Hexbound: 'glyph-slow',
  Burn: 'glyph-burn',
  Shock: 'glyph-shock',
  Poison: 'glyph-poison',
  Rot: 'glyph-curse',
  Curse: 'glyph-curse',
  Weak: 'glyph-weaken',
  Expose: 'glyph-fear',
  Power: 'glyph-rage',
  Ward: 'glyph-shield',
  Shield: 'glyph-shield',
  Shell: 'glyph-shield',
  Armor: 'glyph-armor',
  Immune: 'glyph-blessed',
  Cleanse: 'glyph-blessed',
  Stealth: 'glyph-invisibility',
  Regen: 'glyph-regen',
  Bleed: 'glyph-bleed'
};

export function statusGlyphFor(status: string | null | undefined): keyof typeof SHEETS | null {
  if (!status) return null;
  return STATUS_GLYPH[status] ?? null;
}

// --- The PROTECTIVE-SHIELD cluster (G16) -----------------------------
// Cohesion: ONLY these five protective barriers raise the hex-shield dome, each
// in a DISTINCT colour + its own sound (sting-shield / -shell / -armor / -ward /
// -immune), so the player learns the cluster at a glance. Every OTHER buff/debuff
// uses its own glyph instead (see STATUS_GLYPH). Colours per the lead (the dome
// art is now WHITE so these multiply true):
//   Armor -> physical white   Immune -> holy gold   Shell -> magic
//   Shield -> void purple     Ward -> magic (default; later scoped to what it
//   wards against). Shell + Ward share the magic hue but have separate sounds.
export const PROTECTIVE_DOME_COLOR: Record<string, string> = {
  Armor: '#E6E0D2', // physical white
  Immune: '#F0C13C', // Holy gold
  Shell: '#7A6FE8', // Magic
  Shield: '#A05BD6', // Void purple
  Ward: '#7A6FE8' // Magic (default for un-scoped Ward)
};

// The "appropriate school" colour for every OTHER status, so its glyph + aura
// read with a consistent hue (a colour MIX with the school): a Burn glows fire,
// a Poison nature-green, a Stun lightning-yellow, etc. Falls back to a neutral.
export const STATUS_AURA_COLOR: Record<string, string> = {
  Stun: '#EEF23A', // lightning
  Freeze: '#5FD0FF', // ice
  Frozen: '#5FD0FF',
  Burn: '#f23a2c', // fire
  Shock: '#EEF23A', // lightning
  Silence: '#9A6FE8', // muted arcane
  Hexbound: '#7A6FE8', // magic
  Poison: '#5BA83C', // nature
  Rot: '#7FA83C', // sickly nature
  Curse: '#A05BD6', // void
  Weak: '#A05BD6', // void
  Expose: '#E0742A', // vulnerable orange
  Power: '#E03B2A', // rage red
  Regen: '#5BA83C', // nature
  Stealth: '#8A7FB0', // shadow
  Cleanse: '#F0C13C', // holy
  Retaliate: '#ff4f3d', // blood
  Flank: '#C7C0B2', // physical
  Hound: '#C7C0B2',
  Push: '#C7C0B2'
};

export function statusColor(status: string | null | undefined): string {
  return (status && STATUS_AURA_COLOR[status]) || '#C7C0B2';
}

// --- Flying projectile sheets (G15) ----------------------------------
// The animated flipbook a ranged cast FLIES (caster -> target), so a fire bolt
// flies as fire, a holy shot as a light comet, a void shot as a collapsing
// singularity, a Ranger's stab as a voltaic needle. Consumed by
// Projectiles.svelte (it advances the sheet cell over the flight). Schools /
// weapons without a sheet fall back to the soft school-tinted ball.
export interface ProjectileSheet {
  file: string;
  cols: number;
  rows: number;
  frames: number;
}
const ELEMENT_PROJECTILE: Record<string, ProjectileSheet> = {
  Fire: { file: 'elements/fire-bolt.png', cols: 6, rows: 8, frames: 48 },
  Lightning: { file: 'elements/lightning-bolt.png', cols: 6, rows: 8, frames: 48 },
  Nature: { file: 'elements/nature-bolt.png', cols: 6, rows: 8, frames: 48 },
  Holy: { file: 'elements/holy-bolt.png', cols: 6, rows: 8, frames: 48 },
  Magic: { file: 'elements/arcane-bolt.png', cols: 6, rows: 8, frames: 48 },
  Void: { file: 'weapons/void-singularity.png', cols: 10, rows: 3, frames: 30 }
};
export function projectileSheetFor(
  school: string | null | undefined,
  _weapon?: Weapon | null
): ProjectileSheet | null {
  // Physical shots (arrows / bolts) are a SMALL FAST WHITE bead, not an element
  // flipbook - so they fly via the profile's whiteBolt path (no sheet here).
  if (school === 'Physical') return null;
  return ELEMENT_PROJECTILE[school ?? ''] ?? null;
}

// --- Per-school projectile MOTION character (G16) --------------------
// Each school's spell carries itself differently in flight (the lead's brief):
//   Holy    - falls from the sky, smites straight DOWN onto the target (drop)
//   Fire    - a slow, near-straight bolt caster -> enemy (fly, low arc)
//   Lightning - fast + jittery (sparks X/Z/Y), blinks (fly, jitter, flicker)
//   Void    - a lazy high lob, slow (fly, big arc)
//   Nature  - channels a green BEAM the whole distance, held up (beam) - heal too
//   Magic   - a steady medium arc (fly)
//   Physical - a small fast WHITE bolt + a white muzzle puff (fly, whiteBolt)
//   Blood   - a random mash of void/lightning/nature, splattering (fly, random)
// flightMs = when the head ARRIVES (the impact VFX/SFX ride this); despawnMs =
// when the bead/beam clears. Beam holds longer than its arrival so it reads as
// a sustained channel. Cosmetic only (never touches resolution).
export type ProjectileMotion = 'fly' | 'drop' | 'beam';
export interface ProjectileProfile {
  motion: ProjectileMotion;
  flightMs: number;
  despawnMs: number;
  arc: number; // lift in world units (fly mode)
  jitter: number; // path-noise amplitude (Lightning / Blood)
  flicker: boolean; // blink opacity (Lightning / Blood-sometimes)
  dropHeight: number; // start height above target (drop mode)
  whiteBolt: boolean; // Physical: small fast white core (no element sheet)
  muzzle: boolean; // white puff at the shooter (Physical ranged)
  splatter: boolean; // red splatter along the path (Blood)
  speedScale: number; // core size multiplier
  // Beam mode palette + a "molten fire inside" flag (Dragon Shot's breath). Null
  // beam colours fall back to the school colour (Nature green).
  beamCore?: string;
  beamGlow?: string;
  beamFireInside?: boolean;
}

const BASE_PROFILE: ProjectileProfile = {
  motion: 'fly',
  flightMs: 500,
  despawnMs: 680,
  arc: 0.9,
  jitter: 0,
  flicker: false,
  dropHeight: 7,
  whiteBolt: false,
  muzzle: false,
  splatter: false,
  speedScale: 1
};

// Per-CARD projectile overrides (bespoke seam). Dragon Shot is a Ranger arrow
// that ROARS into a dragon's-breath beam down its pierced line: a fire-orange
// molten core inside a magenta/arcane glow (the lead's "magic colours + fire
// inside"), with an arrow windup (combat.ts SFX_OVERRIDE).
const CARD_PROJECTILE: Record<string, Partial<ProjectileProfile>> = {
  'ranger-dragon-shot': {
    motion: 'beam',
    flightMs: 280,
    despawnMs: 1000,
    beamCore: '#ffb24d',
    beamGlow: '#c64bff',
    beamFireInside: true
  }
};

const PROJECTILE_PROFILE: Record<string, Partial<ProjectileProfile>> = {
  // Slow, near-straight bolt.
  Fire: { flightMs: 760, despawnMs: 940, arc: 0.35 },
  // Fast, jittery, blinking.
  Lightning: { flightMs: 300, despawnMs: 470, arc: 0.5, jitter: 0.55, flicker: true },
  // Smite from the heavens: a steep vertical drop onto the target.
  Holy: { motion: 'drop', flightMs: 540, despawnMs: 720, arc: 0, dropHeight: 7.5 },
  // Lazy high lob.
  Void: { flightMs: 840, despawnMs: 1020, arc: 2.3, jitter: 0.12 },
  // Channeled green beam (heal + damage); arrives fast, then the beam lingers.
  Nature: { motion: 'beam', flightMs: 260, despawnMs: 900, arc: 0 },
  // Steady arcane arc.
  Magic: { flightMs: 520, despawnMs: 700, arc: 0.95 },
  // A small fast white bolt + a muzzle puff.
  Physical: { flightMs: 300, despawnMs: 460, arc: 0.2, whiteBolt: true, muzzle: true, speedScale: 0.7 },
  // A random mash - arc/jitter vary per cast, splattering red.
  Blood: { flightMs: 620, despawnMs: 820, arc: 1.4, jitter: 0.4, flicker: true, splatter: true }
};

export function projectileProfile(
  school: string | null | undefined,
  delivery?: Delivery
): ProjectileProfile {
  const p = { ...BASE_PROFILE, ...(PROJECTILE_PROFILE[school ?? ''] ?? {}) };
  // A Nature AREA spell isn't a single beam - it lobs a seed bead to the cluster
  // like any other AoE. Only single-target Nature channels the beam.
  if (school === 'Nature' && delivery === 'ground-aoe') {
    p.motion = 'fly';
    p.flightMs = 520;
    p.despawnMs = 700;
    p.arc = 0.9;
  }
  return p;
}

// The resolved profile for a CARD (respects the VFX-school override, e.g. Dragon
// Shot fires Fire). Single source for the renderer + the impact-on-arrival delay
// + the bead despawn, so the bolt's flight time and its impact never drift.
export function cardProjectileProfile(card: Card | null | undefined): ProjectileProfile {
  const vfx = resolveCardVfx(card);
  const base = projectileProfile(vfx.school, vfx.delivery);
  const ov = card ? CARD_PROJECTILE[card.id] : undefined;
  return ov ? { ...base, ...ov } : base;
}
export function projectileFlightMs(card: Card | null | undefined): number {
  return cardProjectileProfile(card).flightMs;
}
export function projectileDespawnMs(card: Card | null | undefined): number {
  return cardProjectileProfile(card).despawnMs;
}

// --- Layer builders ---------------------------------------------------
// A TINTED white-sheet hero (Brackeys): multiplied by the school colour.
function hero(sheet: keyof typeof SHEETS, size: number, life: number, extra: Partial<FlipbookLayer> = {}): FlipbookLayer {
  return { kind: 'flipbook', sheet, size, life, tint: 'school', blend: 'additive', bright: 1.6, ...extra };
}

// A NATIVE-colour hero (G15 element / weapon / status art): rendered at its own
// hue (white tint), only gently brightened to clear the bloom threshold.
function elemHero(sheet: keyof typeof SHEETS, size: number, life: number, extra: Partial<FlipbookLayer> = {}): FlipbookLayer {
  return { kind: 'flipbook', sheet, size, life, tint: '#ffffff', blend: 'additive', bright: 1.15, native: true, ...extra };
}

function spray(sprite: keyof typeof SPRITES, over: Partial<SprayLayer> & { count: number }): SprayLayer {
  return {
    kind: 'spray',
    sprite,
    perIntensity: 2,
    maxCount: 48,
    life: [0.3, 0.6],
    speed: [3, 6],
    size: [0.18, 0.4],
    sizeOverLife: 'shrink',
    gravity: -3,
    tint: 'school',
    blend: 'additive',
    radius: 0.18,
    y: 0.5,
    bright: 1.6,
    ...over
  };
}

// A lingering flat ground scorch under an AoE / summon / impact footprint. Holds
// on the board a good beat (G14: the burning ground should smoulder, not blink)
// then fades, so the spell leaves a mark you can read.
function scorch(tint: Tint = '#1a1a1e'): SprayLayer {
  return {
    kind: 'spray',
    sprite: 'scorch',
    count: 1,
    life: [1.6, 2.1],
    speed: [0, 0],
    size: [2.5, 2.9],
    sizeOverLife: 'flat',
    gravity: 0,
    tint,
    blend: 'normal',
    radius: 0.05,
    y: 0.05,
    ground: true
  };
}

// A fast-expanding flat ground SHOCKWAVE ring on impact: starts tight under the
// hit and blows outward as it fades, so a blow reads as energy slamming into the
// ground (the "explosion into ground" the combo wants). Short-lived + additive
// so it bloom-glows and clears before the next beat.
function shockwave(size = 1.5): SprayLayer {
  return {
    kind: 'spray',
    sprite: 'ring',
    count: 1,
    perIntensity: 0,
    life: [0.26, 0.36],
    speed: [0, 0],
    size: [size, size + 0.3],
    sizeOverLife: 'grow',
    gravity: 0,
    tint: 'school',
    blend: 'additive',
    radius: 0.04,
    y: 0.07,
    bright: 1.9,
    ground: true
  };
}

// --- AoE VOLUME (G17): the billowing 3D-reading body of an area spell ---------
// Big, soft, LINGERING puffs that rise + spread to fill the footprint - a green
// gas CLOUD (Nature/Poison, the look the lead loves from the poison-cloud zones),
// roiling FLAME for Fire, drifting energy for the rest. Layered ON TOP of the flat
// element burst so an AoE reads as a real volume of fire/gas, not just a flash.
// Each school's area-spell body has its OWN character, NOT one-size-fits-all:
// Fire roils, Nature gas-clouds drift, Holy beams down a radiant column, Void
// writhes with dark tendrils, Lightning crackles erratically, Physical kicks dust,
// Blood splatters. Tuned via sprite + blend + motion (rise / speed / size / life /
// spread). `sizeOverLife` defaults to grow (billow) unless overridden.
interface VolumeKit {
  sprite: keyof typeof SPRITES;
  blend: Blend;
  count: number; // base puff count (big tiles get +50%)
  rise: number; // upward gravity (+up, -fall)
  size: [number, number];
  speed: [number, number];
  life: [number, number];
  radius: number; // horizontal spread
  bright: number;
  y?: number; // spawn height (low = hugs the ground)
  sizeOverLife?: SprayLayer['sizeOverLife'];
}
const VOLUME: Record<string, VolumeKit> = {
  // Burning ground: low, dense, flickery flames that hug the tile + spread out
  // (NOT a floaty column - keeps the fire on the ground).
  Fire: { sprite: 'flame', blend: 'additive', count: 11, rise: 0.5, size: [0.8, 1.7], speed: [0.4, 1.4], life: [0.5, 0.95], radius: 0.78, bright: 1.7, y: 0.16 },
  // Blood mist: red embers spraying out + drifting down.
  Blood: { sprite: 'ember', blend: 'additive', count: 7, rise: 0.6, size: [0.7, 1.6], speed: [1.4, 3.4], life: [0.7, 1.2], radius: 0.7, bright: 1.5, y: 0.25 },
  // Green GAS CLOUD: big, slow, lingering, wide (the poison-cloud look).
  Nature: { sprite: 'smoke', blend: 'normal', count: 6, rise: 0.85, size: [1.7, 2.9], speed: [0.3, 0.95], life: [1.4, 2.0], radius: 0.95, bright: 1.05 },
  // Crackling sparks: fast, erratic, short-lived.
  Lightning: { sprite: 'spark', blend: 'additive', count: 12, rise: 3.6, size: [0.4, 1.1], speed: [2.2, 4.8], life: [0.35, 0.7], radius: 0.75, bright: 1.7 },
  // Radiant LIGHT column from above: tight, tall, bright, rising fast.
  Holy: { sprite: 'light', blend: 'additive', count: 7, rise: 3.0, size: [0.9, 1.9], speed: [1.4, 3.0], life: [0.8, 1.3], radius: 0.34, bright: 1.7 },
  // Arcane motes: sparkly stars swirling upward.
  Magic: { sprite: 'star', blend: 'additive', count: 9, rise: 2.0, size: [0.7, 1.5], speed: [0.9, 2.2], life: [0.8, 1.35], radius: 0.7, bright: 1.4 },
  // Void TENDRILS: dark wisps writhing slowly up + clawing out (magic sprite,
  // dim, wide, long-lived - reads as grasping void, not a clean cloud).
  Void: { sprite: 'magic', blend: 'additive', count: 8, rise: 1.5, size: [1.1, 2.4], speed: [0.5, 1.6], life: [1.1, 1.7], radius: 0.8, bright: 1.25 },
  // Dust + grit kicked up then settling back down.
  Physical: { sprite: 'dirt', blend: 'normal', count: 8, rise: -1.4, size: [0.6, 1.4], speed: [1.4, 3.2], life: [0.6, 1.1], radius: 0.65, bright: 1 },
  Emblem: { sprite: 'glow', blend: 'additive', count: 6, rise: 2.0, size: [1.0, 2.0], speed: [0.8, 1.8], life: [0.9, 1.4], radius: 0.6, bright: 1.4 }
};

// A column of volume rising off a footprint tile, in the school's own character.
// `big` (the AoE centre) gets more + larger puffs than an outer tile.
function volume(school: string, big = false, over: Partial<SprayLayer> = {}): SprayLayer {
  const v = VOLUME[school] ?? VOLUME.Physical;
  const grow = big ? 1.25 : 1;
  return {
    kind: 'spray',
    sprite: v.sprite,
    count: Math.round(v.count * (big ? 1.5 : 1)),
    perIntensity: 2,
    maxCount: big ? 28 : 18,
    life: v.life,
    speed: v.speed,
    size: [v.size[0] * grow, v.size[1] * grow],
    sizeOverLife: v.sizeOverLife ?? 'grow',
    gravity: v.rise,
    tint: 'school',
    blend: v.blend,
    radius: v.radius,
    y: v.y ?? 0.35,
    bright: v.bright,
    ...over
  };
}

// Chunky DEBRIS kicked up off the ground by a hit, then pulled back down by
// gravity (normal-blend so it reads as dirt/rock, not light). The second half of
// "explosion into ground particles": grit thrown out of the impact crater.
function debris(over: Partial<SprayLayer> = {}): SprayLayer {
  return {
    kind: 'spray',
    sprite: 'dirt',
    count: 5,
    perIntensity: 1.5,
    maxCount: 22,
    life: [0.35, 0.6],
    speed: [2.2, 4.6],
    size: [0.16, 0.4],
    sizeOverLife: 'shrink',
    gravity: -5.5, // thrown up, then falls back to the ground
    tint: '#3a342e',
    blend: 'normal',
    radius: 0.24,
    y: 0.12,
    bright: 1,
    ...over
  };
}

// A flat expanding ground ring (aura / heal / summon).
function ring(size: number, grow: boolean, y = 0.08): SprayLayer {
  return {
    kind: 'spray',
    sprite: 'ring',
    count: 1,
    life: [0.5, 0.7],
    speed: [0, 0],
    size: [size, size + 0.2],
    sizeOverLife: grow ? 'grow' : 'shrink',
    gravity: 0,
    tint: 'school',
    blend: 'additive',
    radius: 0.05,
    y,
    bright: 1.5,
    ground: true
  };
}

// The "5+ damage" heavy threshold (G13 §4): at or above this a hit fires the
// AAA combination - a school-tinted starburst, a wider shockwave, and a heavier
// debris spray on top of the normal impact stack. Runtime: a Power-doubled hit
// that crosses 5 combines live.
export const HEAVY_DMG = 5;

// The extra layers the heavy combination stacks onto any impact: the white
// starburst (tinted to school) + a broad ground shockwave + a heavy debris
// spray. Camera shake / hitstop / flash ride alongside in choreography.ts.
function heavyCombo(): Layer[] {
  return [
    hero('warrior_burst', 3.1, 0.52, { growth: 0.16, bright: 2.4, y: 0.4 }),
    shockwave(2.9),
    shockwave(1.6), // a second tight inner ring for a double-punch read
    debris({ count: 14, perIntensity: 1.8, speed: [3.2, 7.4], radius: 0.55 })
  ];
}

export interface BeatOpts {
  // The hit amount, so the impact can fire the heavy combination at >= HEAVY_DMG.
  intensity?: number;
  // The Physical weapon, so a melee/ranged hit lands with its weapon sheet.
  weapon?: Weapon;
  // The status keyword being applied (the 'apply' beat fires its glyph).
  status?: string;
}

// --- Beat -> layers, by delivery -------------------------------------
export function beatLayers(
  delivery: Delivery,
  school: string,
  beat: EffectBeat,
  opts: BeatOpts = {}
): Layer[] {
  const k = kit(school);
  const { intensity = 0, weapon, status } = opts;
  const heavy = intensity >= HEAVY_DMG;
  // The Physical weapon's art (slash/pierce/blunt have purpose-built swing +
  // burst sheets); fist has none. Non-physical schools use the element impact.
  const wk = school === 'Physical' && weapon ? WEAPON_KIT[weapon] : null;
  // The hero burst sheet at the target: a weapon burst for Physical, else the
  // element impact. `heroIsNative` decides tint (coloured packs render native).
  const heroSheet = wk?.impact ?? k.impact;
  const heroIsNative = wk ? wk.impact != null : k.native;
  // Build the impact hero with the right tinting (native packs untinted).
  const impactHero = (size: number, life: number, extra: Partial<FlipbookLayer> = {}) =>
    heroIsNative ? elemHero(heroSheet, size, life, extra) : hero(heroSheet, size, life, extra);
  switch (beat) {
    case 'cast':
      // No wind-up on melee / dash / rune (the hit IS the moment).
      if (delivery === 'melee' || delivery === 'dash' || delivery === 'rune') return [];
      if (delivery === 'emblem') {
        return [hero('charge', 2.3, 0.65, { bright: 1.9 }), spray(k.spark, { count: 12, speed: [0.5, 1.6], gravity: 1.6, life: [0.5, 0.9] })];
      }
      // The element CAST windup gathers at the caster: a coloured swirl-in for
      // schools with a pack (Fireball gathers fire), the generic charge for the
      // rest. A faint spark column rises so the cast reads as power building.
      return k.native
        ? [
            elemHero(k.cast, 1.9, 0.6, { bright: 1.25, y: 0.55 }),
            spray(k.spark, { count: 8, speed: [0.4, 1.4], gravity: 1.8, life: [0.4, 0.8], radius: 0.3, y: 0.45 })
          ]
        : [hero('charge', 1.4, 0.45, { bright: 1.5 })];

    case 'marquee':
      // Epic + Legendary flourish at the caster: a grand charge sigil + a
      // school-tinted starburst + an expanding ground ring + a tall column of
      // rising motes, so a marquee card announces itself - even a non-damage
      // buff/emblem feels big. Layered UNDER the card's own cast/impact.
      return [
        hero('charge', 2.7, 0.72, { bright: 2.0, y: 0.42 }),
        hero('warrior_burst', 2.5, 0.55, { bright: 2.3, y: 0.5 }),
        ring(2.6, true, 0.08),
        spray(k.rise, { count: 18, perIntensity: 2, speed: [1, 3], gravity: 2.6, life: [0.7, 1.25], radius: 0.65, y: 0.4 }),
        spray(k.spark, { count: 14, speed: [1.6, 3.6], gravity: 2, life: [0.6, 1.05], radius: 0.55, y: 0.5, bright: 1.8 })
      ];

    case 'impact':
      if (delivery === 'ground-aoe') {
        // A wide area slam: the flat element burst over the centre + a billowing
        // VOLUME (a green gas cloud / roiling flame / arcane haze that rises and
        // lingers, so the area reads as a real body of fire/gas) + a hard
        // shockwave, debris blown out of the crater, sparks, and a scorch.
        return [
          impactHero(3.0, 0.85, { ground: true, y: 0.06, growth: 0.22, bright: heroIsNative ? 1.25 : 1.8, spin: 0.5 }),
          volume(school, true),
          shockwave(2.3),
          spray(k.rise, { count: 12, perIntensity: 2.5, speed: [1, 3], gravity: 3.2, life: [0.5, 0.95], radius: 0.5, y: 0.15 }),
          debris({ count: 8, perIntensity: 2, speed: [2.5, 5.5], radius: 0.45 }),
          spray(k.spark, { count: 8, perIntensity: 2, speed: [3, 6], gravity: -3, radius: 0.4 }),
          scorch(),
          ...(heavy ? heavyCombo() : [])
        ];
      }
      if (delivery === 'melee') {
        // A close swing/slam: the weapon SWING arc (sonic / scythe / thrust)
        // leads, the weapon BURST lands the hit, a weapon-flavoured spray (a
        // bone-grey poof for unarmed fists, a bright arc otherwise), a tight
        // shockwave, sparks, and grit kicked off the ground at the feet.
        const weaponSpray: SprayLayer =
          weapon === 'fist'
            ? spray('fist_poof', { count: 6, perIntensity: 1.5, speed: [1.6, 3.4], gravity: -2.5, size: [0.4, 0.8], life: [0.28, 0.5], blend: 'normal', tint: '#b8b2a6', bright: 1, radius: 0.28 })
            : spray('slash', { count: 4, speed: [4, 7], gravity: -2, size: [0.4, 0.85], life: [0.16, 0.3] });
        return [
          // The swing reads first (a touch larger, faster); the burst lands on it.
          ...(wk?.swing ? [elemHero(wk.swing, 2.4, 0.46, { growth: 0.16, bright: 1.2, y: 0.55 })] : []),
          impactHero(2.0, 0.52, { growth: 0.18, bright: heroIsNative ? 1.2 : 1.85, y: 0.5 }),
          weaponSpray,
          shockwave(1.4),
          spray(k.spark, { count: 10, perIntensity: 2, speed: [3, 6], gravity: -3 }),
          debris({ count: 4, perIntensity: 1.2, speed: [2, 4], radius: 0.2 }),
          ...(heavy ? heavyCombo() : [])
        ];
      }
      // projectile / direct: the element / weapon burst where it lands + a
      // shockwave, sparks off the hit, embers rising off the ground, debris
      // kicked up, and a faint scorch so even a ranged bolt marks the board.
      return [
        impactHero(2.1, 0.55, { growth: 0.18, bright: heroIsNative ? 1.22 : 1.9, y: 0.5 }),
        shockwave(1.5),
        spray(k.spark, { count: 10, perIntensity: 2 }),
        spray(k.rise, { count: 6, perIntensity: 1.5, speed: [1, 2.6], gravity: 3, life: [0.4, 0.85], radius: 0.3, y: 0.12 }),
        debris({ count: 5, perIntensity: 1.4, speed: [2, 4.2] }),
        scorch('#15131a'),
        ...(heavy ? heavyCombo() : [])
      ];

    case 'aoe-tile':
      // A SOLID element burst on every other tile of an AoE / pierce footprint
      // (the centre + any fighters already took the full heavy-combo impact). A
      // real ground hero + a shockwave + a rising lick + sparks + a scorch, so a
      // cluster blasts EVERY one of its 4/7 tiles and a pierce erupts down its
      // whole line - just without re-firing the heavy starburst combo per hex.
      return [
        impactHero(2.3, 0.62, { ground: true, y: 0.06, growth: 0.16, bright: heroIsNative ? 1.18 : 1.7, spin: 0.4 }),
        // Each footprint tile grows its own smaller column of gas/flame, so the
        // WHOLE area fills with volume - not just the centre.
        volume(school, false),
        shockwave(1.5),
        spray(k.spark, { count: 7, perIntensity: 1.5, speed: [2, 4.5], gravity: 1.4, life: [0.4, 0.78], radius: 0.36 }),
        scorch('#15131a')
      ];

    case 'apply': {
      // PROTECTIVE cluster (ONLY these five): Armor / Immune / Shell / Shield /
      // Ward raise the SAME hex-shield dome, each in a DISTINCT colour + its own
      // sound, so the player learns the shield family at a glance. The dome IS the
      // read - no glyph.
      const dome = status ? PROTECTIVE_DOME_COLOR[status] : undefined;
      if (dome) {
        return [
          // White dome art -> the per-status tint multiplies TRUE (gold reads
          // gold, void purple, white white) instead of the old cyan-tinted mess.
          { kind: 'flipbook', sheet: 'hexshield_white', size: 2.8, life: 1.0, tint: dome, blend: 'additive', bright: 1.55, y: 0.62 },
          { ...ring(2.2, true), tint: dome, bright: 1.7 },
          { ...spray('star', { count: 14, speed: [0.6, 1.7], gravity: 3, life: [0.7, 1.2], radius: 0.34, sizeOverLife: 'shrink', y: 0.42 }), tint: dome }
        ];
      }
      // EVERY OTHER status reads from its OWN purpose-built glyph (Stun stars,
      // Burn flames, Poison bubbles, Rage, ...) - big + clear so it's recognisable
      // standalone - over a status-COLOURED ground ring + a rising mote column in
      // the same hue (the school colour mix), so each keyword owns a distinct look
      // AND sound. No dome. Unmapped keywords keep just the coloured aura + float.
      const col = statusColor(status);
      const glyph = statusGlyphFor(status);
      const glyphLayer: Layer[] = glyph
        ? [elemHero(glyph, 2.1, 1.1, { bright: 1.3, y: 0.98, spin: 0.25 })]
        : [];
      return [
        ...glyphLayer,
        { ...ring(1.8, true, 0.1), tint: col, bright: 1.6 },
        { ...spray('star', { count: 11, speed: [0.7, 1.9], gravity: 2.6, life: [0.6, 1.1], radius: 0.34, sizeOverLife: 'shrink', y: 0.4, bright: 1.5 }), tint: col }
      ];
    }

    case 'heal':
      return [
        // The heal glyph (a restoring crest) rises over the fighter as the hero,
        // backed by the school-tinted sparkle column + a ground ring, so a heal
        // reads instantly as restoration, not just generic sparkles.
        elemHero('glyph-heal', 1.6, 0.95, { bright: 1.2, y: 1.0 }),
        spray('star', { count: 12, perIntensity: 2, maxCount: 26, speed: [0.9, 2.1], gravity: 2.6, life: [0.6, 1.1], radius: 0.34, sizeOverLife: 'shrink', bright: 1.7, y: 0.4 }),
        spray('glow', { count: 5, speed: [0.2, 0.7], gravity: 1.2, life: [0.4, 0.7], size: [0.6, 1.0], radius: 0.2, sizeOverLife: 'shrink', bright: 1.4 }),
        ring(1.6, true)
      ];

    case 'leaf-swirl':
      // Tranquility-style AoE heal: green nature motes drift + flutter UP over
      // each footprint tile while the heal lands, so the whole area reads as a
      // living grove, not just tinted squares. Wide radius + long life + slow
      // rise = leaves floating around the zone. (No leaf sheet yet - the nature
      // 'star' motes tinted green stand in.)
      return [
        { ...spray('star', { count: 5, perIntensity: 1, maxCount: 9, speed: [0.5, 1.4], gravity: 1.7, life: [1.1, 2.0], size: [0.3, 0.58], radius: 0.6, sizeOverLife: 'shrink', y: 0.16, bright: 1.25 }), tint: '#5BA83C', blend: 'normal' },
        { ...spray('glow', { count: 2, speed: [0.2, 0.6], gravity: 1.0, life: [0.9, 1.6], size: [0.4, 0.78], radius: 0.46, sizeOverLife: 'shrink', y: 0.3, bright: 1.1 }), tint: '#6FBF46', blend: 'additive' }
      ];

    case 'death':
      return [
        { kind: 'spray', sprite: 'smoke', count: 14, life: [0.7, 1.2], speed: [0.7, 2], size: [0.6, 1.2], sizeOverLife: 'grow', gravity: 1.3, tint: '#2a2a2e', blend: 'normal', radius: 0.32, y: 0.5 },
        hero('impact_white', 1.8, 0.4, { tint: '#cfcfd6', bright: 1.3 })
      ];

    case 'dash':
      return [
        spray('dirt', { count: 8, speed: [1, 2.6], gravity: -2, size: [0.3, 0.6], life: [0.3, 0.55], blend: 'normal', tint: '#3a342e', radius: 0.3, bright: 1 }),
        ring(1.2, true, 0.06)
      ];

    case 'fizzle':
      // One shared fail look for every school: a weak grey sputter + a few
      // falling sparks at the caster, deliberately NOT school-tinted so a
      // failed cast reads as "nothing happened", not a spell.
      return [
        { kind: 'spray', sprite: 'smoke', count: 7, life: [0.4, 0.7], speed: [0.4, 1.3], size: [0.3, 0.6], sizeOverLife: 'grow', gravity: 0.8, tint: '#5a5a60', blend: 'normal', radius: 0.22, y: 0.5 },
        { kind: 'spray', sprite: 'spark', count: 6, life: [0.2, 0.4], speed: [1, 2.4], size: [0.12, 0.26], sizeOverLife: 'shrink', gravity: -5, tint: '#9a9aa2', blend: 'additive', radius: 0.18, y: 0.5, bright: 1.1 }
      ];

    case 'cloud':
      // A bomb of SMOKE billowing out over a tile (Smoke Bomb) - soft grey puffs
      // that spread + rise gently + linger, NOT a damage burst. Grey so it reads
      // as smoke regardless of the card's school.
      return [
        { kind: 'spray', sprite: 'smoke', count: 8, perIntensity: 0, maxCount: 12, life: [1.3, 2.0], speed: [0.5, 1.4], size: [1.5, 2.7], sizeOverLife: 'grow', gravity: 0.7, tint: '#c9cbc4', blend: 'normal', radius: 0.85, y: 0.32, bright: 1 },
        { kind: 'spray', sprite: 'smoke', count: 5, perIntensity: 0, maxCount: 8, life: [1.0, 1.6], speed: [0.6, 1.6], size: [1.0, 1.9], sizeOverLife: 'grow', gravity: 1.0, tint: '#e2e3dd', blend: 'normal', radius: 0.6, y: 0.5, bright: 1 }
      ];
  }
  return [];
}

// Last-resort coverage: a small school-tinted sparkle so a card whose
// resolution produced NO damage/heal/status/move effect (e.g. "add a Rune to
// your hand", a pure draw/mana buff) still shows SOMETHING at the caster. The
// planner falls back to this only when nothing else fired.
export const FALLBACK_LAYER: SprayLayer = {
  kind: 'spray',
  sprite: 'star',
  count: 9,
  life: [0.4, 0.75],
  speed: [0.8, 2],
  size: [0.16, 0.34],
  sizeOverLife: 'shrink',
  gravity: 2.2,
  tint: 'school',
  blend: 'additive',
  radius: 0.3,
  y: 0.5,
  bright: 1.6
};

// --- classify + deliveryFor ------------------------------------------
type Kind = 'damage' | 'heal' | 'summon' | 'move' | 'debuff' | 'buff';

const AREA_SHAPES = new Set([
  'flower-7',
  'cluster-4',
  'caster-cluster',
  'caster-cluster-2',
  'adjacent',
  'line-3',
  'line-4',
  'cone-2',
  'pierce'
]);

// Does this card hit an AREA (a shaped footprint) rather than a single target?
// Used to keep a Nature AoE from channelling a single beam (it blooms instead).
export function hasAreaShape(card: Card | null | undefined): boolean {
  return AREA_SHAPES.has(card?.shape ?? '');
}

function classify(card: Card): Kind {
  const t = card.text || '';
  if (/Place\s+Trap|Spawn\s+(?:\w+\s+)?(?:Cloud|Clouds|Thorns)/i.test(t)) return 'summon';
  const dealsDamage = /\bdeal\b/i.test(t) && /\bdamage\b/i.test(t);
  if (dealsDamage) return 'damage';
  if (/\bHeal\b/.test(t)) return 'heal';
  if (/\bMove\b\s+(?:up to|one|to)|Charge|Warp|Stalk|Disengage|advance|\bDash\b/i.test(t)) return 'move';
  // Modifier: an enemy-facing debuff vs a self/ally buff.
  const debuffs = /Apply\s+(?:Stun|Silence|Weak|Expose|Hexbound|Shock|Burn)|Destroy enemy|Remove all modifiers from target|Silence/i;
  const selfFacing = /\b(?:you|your|self|ally|allies|adjacent allies|all allies)\b/i;
  if (debuffs.test(t) && !selfFacing.test(t)) return 'debuff';
  return 'buff';
}

export function deliveryFor(card: Card | null | undefined): Delivery {
  if (!card) return 'self-aura';
  if (card.type === 'Emblem') return 'emblem';
  if (card.type === 'Rune') return 'rune';
  const kind = classify(card);
  if (kind === 'summon') return 'summon';
  if (kind === 'heal') return 'heal';
  if (kind === 'move') return 'dash';
  if (kind === 'damage') {
    if (AREA_SHAPES.has(card.shape ?? '')) return 'ground-aoe';
    return (typeof card.range === 'number' ? card.range : 1) <= 1 ? 'melee' : 'projectile';
  }
  if (kind === 'debuff') return 'debuff';
  return 'self-aura'; // buffs + catch-all
}

// --- Per-card overrides (the bespoke-VFX seam) -----------------------
export interface CardVfx {
  delivery: Delivery;
  school: string;
  scale: number;
  repeat: number;
  // The Physical weapon, so the impact lands with its weapon sheet (undefined
  // for non-physical schools, which tint their school hero instead).
  weapon?: Weapon;
  // Epic / Legendary: gets the marquee flourish + the longer beat.
  marquee?: boolean;
}

// Intuition-driven tweaks: a tiny change per notable card now, full bespoke
// later. scale = size multiplier, repeat = play the impact N times.
const CARD_OVERRIDES: Record<string, Partial<CardVfx>> = {
  // Twin Cast / multi-hit -> replay the impact.
  'druid-infested-wounds': { repeat: 2 },
  'mage-lightning-bolt': { repeat: 2 },
  // Bigger spells punch bigger than their smaller cousins.
  'mage-pyroblast': { scale: 1.45 },
  'mage-fireball': { scale: 1.0 },
  'priest-death-touch': { scale: 1.2 },
  'rogue-murder': { scale: 1.35 },
  'warrior-hexecute': { scale: 1.3 },
  'paladin-heretic-strike': { scale: 1.2 },
  'mage-sanguine-burst': { scale: 1.25 },
  // Gap-closers that end in a melee slam, not a ranged bolt.
  'warrior-charge': { delivery: 'melee' },
  'druid-bestial-charge': { delivery: 'melee' },
  // Movement that strikes a small area on arrival.
  'rogue-stalk': { delivery: 'ground-aoe' },
  // Big line / area slams read as ground-AoE.
  'warrior-bull-rush': { delivery: 'ground-aoe', scale: 1.15 },
  'warrior-pit-brawl': { delivery: 'ground-aoe', scale: 1.35 },
  // Dragon Shot: the SOUND stays Magic (combat.ts reads card.school), but the
  // VISUAL is a dragon's breath - FIRE roaring down the whole pierced row, big
  // and fierce - so its VFX school is overridden to Fire and scaled up. It also
  // flies a fire-in-magic BEAM (CARD_PROJECTILE) instead of a single bead.
  'ranger-dragon-shot': { delivery: 'ground-aoe', school: 'Fire', scale: 1.6 },
  // Cinderstorm is a storm of CINDERS - its mechanical school is Magic (it applies
  // Burn directly), but the VISUAL is FIRE (roiling flame volume), bringing
  // back the cool fire look. Its bespoke spell-cinderstorm SOUND is unchanged.
  'mage-cinderstorm': { school: 'Fire', scale: 1.25 },
  // Big AoE finishers, each in its OWN school (the lead's "stick to the school"):
  // a Void rift, a Holy consecration, a Warrior gore-spin, a flower of arrows.
  'priest-rift-vortex': { scale: 1.25 },
  'paladin-unholy-grounds': { scale: 1.3 },
  'warrior-gorestorm': { scale: 1.2 },
  // Bramblethorns (Epic Nature): classify() reads "Spawn Thorns" as a plain
  // summon (a faint settling ring), which left this Epic with almost no cast
  // VFX. Route it through the richer Nature GROUND-AOE effect (a burst of
  // vines/thorns erupting across the footprint) and scale it up for Epic weight.
  'druid-bramblethorns': { delivery: 'ground-aoe', scale: 1.35 },
  'ranger-volley-shot': { scale: 1.15 }
};

export function resolveCardVfx(card: Card | null | undefined): CardVfx {
  const base: CardVfx = {
    delivery: deliveryFor(card),
    school: card?.school ?? 'Physical',
    scale: 1,
    repeat: 1,
    weapon: (card?.school ?? 'Physical') === 'Physical' ? physicalWeapon(card) : undefined,
    marquee: card?.rarity === 'Epic' || card?.rarity === 'Legendary'
  };
  const o = card ? CARD_OVERRIDES[card.id] : undefined;
  return o ? { ...base, ...o } : base;
}

// --- Resolution pacing (G7.5 / G14 v2) -------------------------------
// How long the resolution playback HOLDS on a card before advancing to the next.
// As of G14 v2 every card gets a uniform ~2s beat (see beatDurationFor) so each
// play breathes; pure presentation, setTimeout-driven, SNAP-safe.

// Bare-fizzle beat: nothing lands, so a failed cast clears fast.
export const FIZZLE_BEAT_MS = 700;

// Resolved beat duration for a resolving card. `maxHit` is the heaviest single
// damage point of the event (0 for non-damage). G14 pacing (v2): EVERY card gets
// a full ~2s beat so each play has room to breathe (the cast -> travel -> impact
// -> sting all read, and sounds don't get cut off) - a turn rarely has more than
// 5 cards, so ~5 x 2s still fits the resolution. A busier turn is compressed
// globally by MatchHud. Multi-hit replays get a touch more room.
const CARD_BEAT_MS = 2000;

export function beatDurationFor(card: Card | null | undefined, maxHit = 0): number {
  const vfx = resolveCardVfx(card);
  void maxHit; // pacing is uniform now; kept in the signature for callers
  let ms = CARD_BEAT_MS;
  // Each extra replay (Infested Wounds / Lightning Bolt Twin Cast) staggers by
  // ~140ms in particles.ts; give the beat room so both slams land.
  ms += (vfx.repeat - 1) * 240;
  return Math.round(ms);
}
