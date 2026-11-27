import type { Card, CardRarity } from '$lib/data/cards';

export type PackRarity = CardRarity;

export interface PackOpeningCard {
  tokenId: string;
  rarity: PackRarity;
  name: string;
  image: string;
  card?: Card;
}

export const PACK_RARITY_COLOR: Record<PackRarity, string> = {
  Common: '#8b857f',
  Rare: '#5a8dd6',
  Epic: '#b344e8',
  Legendary: '#c8a24a'
};

export const PACK_RARITY_RANK: Record<PackRarity, number> = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3
};

export function bestPackRarity(cards: readonly Pick<PackOpeningCard, 'rarity'>[]): PackRarity {
  return cards.reduce<PackRarity>(
    (best, card) =>
      PACK_RARITY_RANK[card.rarity] > PACK_RARITY_RANK[best] ? card.rarity : best,
    'Common'
  );
}

export function maxCardNumber(text: string | null | undefined, word: 'damage' | 'heal'): number {
  if (!text) return 0;
  const pattern =
    word === 'damage'
      ? /(?:deal|take|damage(?:d)?)\D{0,18}(\d+)/gi
      : /(?:heal|restore)\D{0,18}(\d+)/gi;
  let max = 0;
  for (const match of text.matchAll(pattern)) {
    max = Math.max(max, Number(match[1] ?? 0));
  }
  return max;
}

export function shortChainValue(value: string | null | undefined, lead = 7, tail = 5): string {
  if (!value) return 'Pending';
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
