import { fundingPanel, PACK_TARGET } from './round-progress.js';
import { ignitionStage, reducedMotion } from './ignition/stage.js';
import { initWallet } from './wallet.js';
const el=id=>document.getElementById(id);
const [publicRound,fork,catalog]=await Promise.all(['round','rehearsal','catalog'].map(async file=>{
  const r=await fetch('./'+file+'.json'); if (!r.ok) throw Error('Missing '+file); return r.json();
}));
const live=publicRound.status==='verified';
const data=live?publicRound:fork;
const qty=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
let selected;
let opened = 0;
let waiting = 0;
let active = false;
let replayTimer;
let lastWalletPack;
const replayButton = el('replay-pack');
const openButton = el('open-pack');
const resetButton = el('reset-round');
const clearButton = el('clear-queue');
const updateReplayFunding = fundingPanel(el('replay-funding'));
const explorer = hash => 'https://testnet.bscscan.com/tx/' + hash;
const replayStage = ignitionStage(el('replay-stage'), el('cards'), catalog, openButton);

function showReceipt(pack, animate = false) {
  selected = pack;
  const number = pack?.number ?? 0;
  el('receipt-label').textContent = pack ? 'Pack ' + number + ' allocation' : 'Five cards per pack';
  el('position').textContent = number + ' / ' + data.packs.length;
  el('earned').textContent = pack ? qty(pack.game) + ' GAME' : '';
  replayStage.show(pack?.cards, animate);
  updateQueue();
}

function updateQueue() {
  const full = opened + waiting + Number(active) >= data.packs.length;
  openButton.disabled = full;
  openButton.textContent = active ? (full ? 'Opening queued packs' : 'Queue a pack') : full ? 'All packs opened' : 'Open a pack';
  clearButton.disabled = !waiting;
  resetButton.disabled = !active && !opened && !selected;
  el('queue-status').textContent = active || waiting
    ? (active ? 'Opening pack ' + (opened + 1) + ' · ' : '') + waiting + ' queued'
    : opened + ' opened';
  el('prev').disabled = active || (selected?.number ?? 0) <= 1;
  el('next').disabled = active || selected?.number >= data.packs.length;
  el('last').disabled = active;
  replayButton.disabled = active || !selected;
}

function openNext() {
  if (!waiting) return;
  waiting--;
  active = true;
  const pack = data.packs[opened];
  replayStage.charge(pack.cards);
  updateQueue();
  const reveal = () => {
    opened++;
    active = false;
    showReceipt(pack, true);
    updateReplayFunding({
      packs: pack.number,
      poolOpened: pack.number === PACK_TARGET && Boolean(data.pool),
      payment: true
    });
    if (reducedMotion.matches) openNext();
    else replayTimer = setTimeout(() => {
      replayTimer = undefined;
      openNext();
    }, waiting ? 440 : 680);
  };
  if (reducedMotion.matches) reveal();
  else replayTimer = setTimeout(reveal, waiting ? 260 : 680);
}

function startReplay() {
  clearTimeout(replayTimer);
  replayTimer = undefined;
  opened = 0;
  waiting = 0;
  active = false;
  updateReplayFunding({ packs: opened });
  showReceipt();
}

openButton.onclick = () => {
  if (openButton.disabled) return;
  waiting++;
  if (active || replayTimer !== undefined) updateQueue();
  else openNext();
};
clearButton.onclick = () => {
  waiting = 0;
  updateQueue();
  openButton.focus();
};
resetButton.onclick = () => {
  startReplay();
  openButton.focus();
};
el('prev').onclick = () => showReceipt(data.packs[selected.number - 2]);
el('next').onclick = () => showReceipt(data.packs[selected?.number ?? 0]);
el('last').onclick = () => showReceipt(data.packs.at(-1));
startReplay();

async function animatePack({ cards, game, player, hash, number, poolOpened }, replay) {
  const { openPack } = await import('./pack-opening/index.js');
  openPack({
    ids: cards,
    catalog,
    game,
    player,
    packNumber: Number(number),
    poolOpened,
    explorerUrl: hash && explorer(hash),
    replay
  });
}

async function replayPack(pack, replay, errorTarget) {
  try {
    await animatePack(pack, replay);
  } catch (error) {
    errorTarget('Could not load the pack opening. Please reload and try again.');
    console.error(error);
  }
}

replayButton.onclick = () => {
  el('replay-error').textContent = '';
  const pack = selected;
  const step = pack.number === 1 ? 'open1' : 'openLast';
  const hash = live ? data.steps[step].hash : undefined;
  const poolOpened = pack.number === PACK_TARGET && Boolean(data.pool);
  return replayPack({ ...pack, hash, poolOpened }, true, message => {
    el('replay-error').textContent = message;
  });
};

el('mode').textContent=live?'Public BSC testnet · Receipt replay':'BSC testnet fork · Receipt replay';
el('record').href=live?'./round.json':'./rehearsal.json';
el('proof').textContent=live?'Confirmed on public BSC testnet. Open the transactions below.':
  'Replayed on a local fork of BSC testnet at block '+data.forkBlock+'. Public testnet receipts are pending.';
if (live) for (const [name,key] of [['Factory','factory'],['Create launcher','create'],['Final mint + pool','openLast'],['Claim','claim1']]) {
  const a=document.createElement('a');a.href='https://testnet.bscscan.com/tx/'+data.steps[key].hash;a.textContent=name+' ↗';el('prooflinks').append(a);
}
initWallet({ publicRound, fork, catalog, replayPack });
