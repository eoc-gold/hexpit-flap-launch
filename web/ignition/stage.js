import { animateCard, mountFX } from './reveal-effects.mjs';

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cardBack = './pack-assets/textures/cardback-dexpit-official.png';

function back() {
  const image = document.createElement('img');
  image.src = cardBack;
  image.alt = '';
  return image;
}

export function renderHand(cards, ids, catalog, { reveal = false, captions = true } = {}) {
  const effects = [];
  const motion = reveal && !reducedMotion.matches;
  const figures = ids.map((id, index) => {
    const card = catalog[Number(id) - 1];
    const figure = document.createElement('figure');
    const face = document.createElement('img');
    face.src = './art/' + card.slug + '.webp';
    face.alt = face.title = card.name;
    figure.className = 'ignition-card';
    figure.append(face);
    if (captions) {
      const caption = document.createElement('figcaption');
      caption.textContent = card.class + ' · ' + card.rarity;
      figure.append(caption);
    }
    if (motion) {
      const reverse = back();
      reverse.className = 'ignition-card-back';
      figure.style.setProperty('--reveal-delay', index * 58 + 'ms');
      figure.classList.add('is-revealing');
      figure.append(reverse);
      effects.push(animateCard(figure, card));
    }
    return figure;
  });
  cards.replaceChildren(...figures);
  return () => effects.forEach(stop => stop());
}

export function ignitionStage(host, cards, catalog, trigger) {
  let clearEffects;
  let hovering = false;
  let charging = false;
  const artUrl = id => './art/' + catalog[Number(id) - 1].slug + '.webp';
  const reactor = {
    kind: 'arcane',
    mode: 'reactor',
    strength: 0.82,
    charge: 0,
    onFrame() {
      const target = charging ? 1 : hovering ? 0.42 : 0;
      reactor.charge += (target - reactor.charge) * 0.08;
    }
  };
  mountFX(host, reactor);
  trigger?.addEventListener('pointerenter', () => { hovering = true; });
  trigger?.addEventListener('pointerleave', () => { hovering = false; });

  function clearCards() {
    clearEffects?.();
    clearEffects = undefined;
  }

  function seal() {
    clearCards();
    cards.replaceChildren(...Array.from({ length: 5 }, back));
  }

  function charge(ids) {
    charging = true;
    host.dataset.ignition = 'charging';
    clearCards();
    cards.replaceChildren(back());
    for (const id of ids) {
      const image = new Image();
      image.src = artUrl(id);
    }
  }

  function show(ids, reveal = false) {
    charging = false;
    host.dataset.ignition = reveal ? 'revealed' : 'idle';
    if (!ids) {
      seal();
      return;
    }
    clearCards();
    clearEffects = renderHand(cards, ids, catalog, { reveal });
  }

  return { charge, show };
}
