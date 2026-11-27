// Single source of truth for per-School colors.
//
// The damage/Heal word on a card face is tinted by the card's School (see
// DexpitCard.svelte .kw-* rules + highlightKeywords school arg), and the same
// color is the dominant tint of that card's in-match animation (see
// render3d/fx/choreography.ts). Keep the --school-* CSS vars in
// static/styles/colors_and_type.css and the .kw-* rules in DexpitCard.svelte
// in sync with this map.
//
// Palette rationale (approved by lead): on-brand, avoids the 7 class colors,
// reuses brand tokens where the meaning already fits (Fire = ember, Blood =
// blood-glow, Emblem = forge-gold).

export type School =
  | 'Physical'
  | 'Holy'
  | 'Nature'
  | 'Magic'
  | 'Emblem'
  | 'Void'
  | 'Blood'
  | 'Fire'
  | 'Lightning';

export const SCHOOL_COLORS: Record<School, string> = {
  Fire: '#f23a2c', // = brand ember
  Blood: '#ff4f3d', // = --blood-glow
  Nature: '#5BA83C', // leaf / poison
  Lightning: '#EEF23A', // neon electric yellow (white-hot cores in VFX)
  Magic: '#7A6FE8', // arcane
  Void: '#A05BD6', // curse / void
  Holy: '#F0C13C', // warm radiant gold
  Physical: '#C7C0B2', // bone-steel "no element" default
  Emblem: '#d8ae62' // = --forge-gold, identity accent only
};

// Physical is the no-element default for any unknown/missing school.
export const DEFAULT_SCHOOL_COLOR = SCHOOL_COLORS.Physical;

export function schoolColor(school?: string | null): string {
  if (!school) return DEFAULT_SCHOOL_COLOR;
  return SCHOOL_COLORS[school as School] ?? DEFAULT_SCHOOL_COLOR;
}
