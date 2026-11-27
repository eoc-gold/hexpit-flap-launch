import forkTable from './table-fork.json';
import { fundingPanel } from './round-progress.js';
import { renderHand } from './ignition/stage.js';

const publicRecords = import.meta.glob('./table-testnet.json', { eager: true, import: 'default' });
export const publicTable = publicRecords['./table-testnet.json'];
export { forkTable };
const el = id => document.getElementById(id);
const number = value => Number(value).toLocaleString('en-US', {maximumFractionDigits: 2});

export function closingReplay(catalog) {
  const evidence = publicTable || forkTable;
  const live = evidence.mode === 'testnet';
  const update = fundingPanel(el('table-funding'));
  const seats = el('table-seats');
  const next = el('table-next');
  const back = el('table-back');
  let stage = 0;
  const handEffects = [];
  el('table-mode').textContent = (live ? 'Public BSC testnet' : 'BSC testnet fork') + ' · Two-wallet replay';
  el('table-record').href = live ? './table-testnet.json' : './table-fork.json';
  el('table-live-link').hidden = !live;
  if (live) {
    el('table-close-tx').href = 'https://testnet.bscscan.com/tx/' + evidence.steps.close;
    el('table-close-tx').hidden = false;
  }

  function seatRow(player, index) {
    const row = document.createElement('article');
    const seated = stage > index;
    const claimed = stage === evidence.players.length;
    row.className = 'table-seat';
    row.dataset.seated = String(seated);
    const heading = document.createElement('h3');
    heading.textContent = 'Seat ' + (index + 1);
    const status = document.createElement('b');
    status.textContent = claimed ? number(player.game) + ' GAME' : seated ? '5 test USD pledged' : 'Available';
    const title = document.createElement('div');
    title.className = 'table-seat-title';
    title.append(heading, status);
    const text = document.createElement('p');
    text.textContent = 'Solo allocation for pack ' + (evidence.startSold + index + 1) + ' · ' + number(player.soloGame) + ' GAME';
    row.append(title, text);
    if (claimed) {
      const hand = document.createElement('div');
      hand.className = 'table-hand';
      handEffects.push(renderHand(hand, player.cards, catalog, { reveal: true, captions: false }));
      row.append(hand);
    }
    return row;
  }

  function draw() {
    handEffects.splice(0).forEach(stop => stop());
    const closed = stage === evidence.players.length;
    const price = Number(evidence.price);
    seats.replaceChildren(...evidence.players.map(seatRow));
    update({ packs: closed ? evidence.target : evidence.startSold, poolOpened: closed });
    el('table-escrow').textContent = (closed ? 0 : price * stage) + ' test USD';
    next.textContent = closed ? 'Replay the table' : stage === 0 ? 'Pledge for seat 1' : 'Fill the final seat';
    back.hidden = stage !== 1;
    el('table-message').textContent = closed
      ? 'Both wallets claimed five cards and about ' + number(evidence.players[0].game) + ' GAME each. The last indivisible unit went to seat 2.'
      : stage === 1 ? 'One seat is funded. Its pledge stays in escrow until the second player joins.'
        : 'Both seats get the same share of the remaining GAME, to within one base unit.';
  }
  next.onclick = () => { stage = stage === evidence.players.length ? 0 : stage + 1; draw(); };
  back.onclick = () => { stage = 0; draw(); el('table-message').textContent = '5 test USD returned. Both seats are open.'; };
  draw();
}
