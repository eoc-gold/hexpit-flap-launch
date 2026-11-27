import { mount, unmount } from 'svelte';
import { BUNDLED_CARDS } from './data/cards';
import PackOpeningExperience from './components/economy/PackOpeningExperience.svelte';
import './fonts.css';

const cardsBySlug = new Map(BUNDLED_CARDS.map(card => [card.id, card]));
let opening;

export function openPack({ ids, catalog, game, player, packNumber, poolOpened, explorerUrl, replay }) {
  const cards = ids.map(id => {
    const entry = catalog[Number(id) - 1];
    const card = cardsBySlug.get(entry.slug);
    return {
      tokenId: String(id),
      name: entry.name,
      rarity: entry.rarity,
      image: './art/' + entry.slug + '.webp',
      card
    };
  });

  function close() {
    if (!opening) return;
    unmount(opening);
    opening = undefined;
  }

  function start() {
    close();
    opening = mount(PackOpeningExperience, {
      target: document.getElementById('pack-opening'),
      props: {
        cards,
        receipt: { game, player, packNumber, poolOpened, explorerUrl },
        replay,
        onclose: close,
        onagain: start
      }
    });
  }

  start();
}
