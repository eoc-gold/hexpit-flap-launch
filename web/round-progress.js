export const PACK_TARGET = 12;
const PACK_PRICE = 5;
const FUNDING_TARGET = PACK_TARGET * PACK_PRICE;

export function fundingPanel(root) {
  const template = document.getElementById('funding-template');
  root.append(template.content.cloneNode(true));
  const pill = root.querySelector('.funding-state');
  const total = root.querySelector('.funding-total strong');
  const track = root.querySelector('.funding-track');
  const fill = root.querySelector('.funding-fill');
  const amount = root.querySelector('.funding-amount');
  const note = root.querySelector('.funding-note');

  return function update({ packs, poolOpened = false, expired = false, payment = false }) {
    const collected = packs * PACK_PRICE;
    root.classList.toggle('is-funded', poolOpened);
    pill.textContent = poolOpened ? 'Pool open' : expired ? 'Expired' : 'Collecting';
    total.textContent = String(collected);
    track.setAttribute('aria-valuenow', String(collected));
    track.setAttribute('aria-valuetext', collected + ' of ' + FUNDING_TARGET + ' test USD');
    fill.style.width = (100 * collected / FUNDING_TARGET) + '%';
    amount.textContent = packs + ' / ' + PACK_TARGET + ' packs minted';
    if (poolOpened) {
      note.textContent = 'Seeded with 60 test USD + 500,000 GAME.';
    } else if (expired) {
      note.textContent = 'Funding round expired. Original buyers can claim refunds.';
    } else if (payment) {
      note.textContent = '+5 test USD added to the launcher reserve.';
    } else {
      note.textContent = 'The twelfth pack opens the GAME/USD pool.';
    }
  };
}
