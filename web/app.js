import { createPublicClient, createWalletClient, custom, http, formatEther, parseAbi, parseEventLogs, zeroAddress, isAddress } from 'viem';
import {bscTestnet} from 'viem/chains';
import {rpc,portal,usd,usdAbi,launchAbi} from '../scripts/network.mjs';
import { fundingPanel, PACK_TARGET } from './round-progress.js';
import { ignitionStage, reducedMotion } from './ignition/stage.js';
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
const updateWalletFunding = fundingPanel(el('wallet-funding'));
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
const params=new URLSearchParams(location.search);
const local=['127.0.0.1','localhost'].includes(location.hostname)&&params.has('fork');
const round=local?fork:publicRound;
const endpoint=local?'http://127.0.0.1:18797':rpc;
const chain=bscTestnet;
const client=createPublicClient({chain,transport:http(endpoint)});
const address=params.get('launcher')||round.judgeLauncher||round.launcher;
const msg=t=>{el('feedback').textContent=t;};
el('wallet-replay').onclick = () => replayPack(lastWalletPack, false, msg);
let wallet, account, walletStage;
function action(label,fn){
  const btn=document.createElement('button');btn.textContent=label;
  btn.onclick=async()=>{
    for(const b of el('actions').querySelectorAll('button')) b.disabled=true;
    try{await fn();}catch(e){msg(e.shortMessage||e.message);}
    finally{for(const b of el('actions').querySelectorAll('button')) b.disabled=false;}
  };el('actions').append(btn);
}
const read=(a,abi,fn,args=[])=>client.readContract({address:a,abi,functionName:fn,args});
async function transact(a,abi,fn,args){
  const net=await wallet.getChainId();if(net!==97) throw Error('Select BSC testnet, chain 97.');
  const config={account,address:a,abi,functionName:fn,args};
  await client.simulateContract(config);
  const estimate=await client.estimateContractGas(config);
  const hash=await wallet.writeContract({...config,gas:estimate*13n/10n+60000n});
  msg('Waiting for confirmation: '+hash);
  const receipt=await client.waitForTransactionReceipt({hash});
  if(receipt.status!=='success') throw Error('Transaction reverted. '+hash);
  msg('Confirmed: '+hash);
  if (fn === 'mintPacks') {
    const logs = receipt.logs.filter(log => log.address.toLowerCase() === a.toLowerCase());
    const pack = parseEventLogs({ abi: launchAbi, eventName: 'PackOpened', logs })[0]?.args;
    if (pack) {
      const poolOpened = parseEventLogs({ abi: launchAbi, eventName: 'PoolOpened', logs }).length > 0;
      const game = formatEther(pack.game);
      msg('Mint confirmed. '+pack.cards.map(id=>catalog[Number(id)-1].name).join(', ')+'. '+qty(game)+' GAME allocated. '+hash);
      lastWalletPack = { ...pack, game, poolOpened, hash: local ? undefined : hash };
      el('wallet-receipt').hidden = false;
      walletStage ??= ignitionStage(el('wallet-stage'), el('wallet-cards'), catalog);
      walletStage.charge(pack.cards);
      if (!reducedMotion.matches) await new Promise(resolve => setTimeout(resolve, 680));
      walletStage.show(pack.cards, true);
      updateWalletFunding({ packs: Number(pack.number), poolOpened, payment: true });
    }
  }
  await refresh().catch(error => console.error('Could not refresh launcher after confirmation', error));
}
async function refresh(){
  el('actions').replaceChildren();
  if(!address||!round.factory){el('help').textContent='The public testnet launcher is awaiting deployment. Explore every pack above using the recorded fork run.';return;}
  if(!isAddress(address))throw Error('Invalid launcher address.');
  const verifiedFactory=await read(portal,parseAbi(['function getLauncher(address) view returns (address)']),'getLauncher',[address]);
  if(verifiedFactory.toLowerCase()!==round.factory.toLowerCase() || (await read(address,launchAbi,'USD')).toLowerCase()!==usd.toLowerCase()) throw Error('Unknown launcher or quote asset.');
  const [chainSold,deadline,pool]=await Promise.all(['sold','deadline','pool'].map(fn=>read(address,launchAbi,fn)));
  const closed = pool !== zeroAddress || Boolean(lastWalletPack?.poolOpened);
  const expired = !closed && (await client.getBlock()).timestamp >= deadline;
  const latestMint = lastWalletPack?.number ?? 0n;
  const sold = chainSold > latestMint ? chainSold : latestMint;
  updateWalletFunding({ packs: Number(sold), poolOpened: closed, expired, payment: sold === latestMint && sold > 0n });
  el('help').textContent = closed
    ? 'Connect the wallet that minted to check its GAME claim.'
    : expired
      ? 'The round ended before reaching its target.'
      : 'Each pack costs 5 faucet USD. Your wallet confirms each transaction.';
  if(!wallet){action('Connect wallet',async()=>{
    if(!window.ethereum) throw Error('Open this page in an EVM wallet browser.');
    wallet=createWalletClient({chain,transport:custom(window.ethereum)});
    try{[account]=await wallet.requestAddresses();if(await wallet.getChainId()!==97) await wallet.switchChain({id:97});}
    catch(e){wallet=null;throw e;}
    window.ethereum.on?.('accountsChanged',()=>location.reload());window.ethereum.on?.('chainChanged',()=>location.reload());
    await refresh();
  });return;}
  const [owed,paid]=await Promise.all(['allocation','paid'].map(fn=>read(address,launchAbi,fn,[account])));
  if(closed){
    if(owed>0n)action('Claim '+qty(formatEther(owed))+' GAME',()=>transact(address,launchAbi,'claim',[]));
    else msg('This wallet has no outstanding GAME claim.');
  }else if(expired){
    if(paid>0n)action('Refund '+formatEther(paid)+' USD',()=>transact(address,launchAbi,'refund',[]));else msg('The round expired.');
  }else{
    const price=await read(address,launchAbi,'PACK_PRICE');
    const [balance,allowance,start,end]=await Promise.all([read(usd,usdAbi,'balanceOf',[account]),read(usd,usdAbi,'allowance',[account,address]),read(address,launchAbi,'cumulative',[sold]),read(address,launchAbi,'cumulative',[sold+1n])]);
    if(balance<price) action('Get 5 faucet USD',()=>transact(usd,usdAbi,'mint',[account,price]));
    else if(allowance<price) action('Approve 5 USD',()=>transact(usd,usdAbi,'approve',[address,price]));
    else action('Open pack · 5 USD',()=>transact(address,launchAbi,'mintPacks',[1n,end-start]));
  }
}
refresh().catch(e=>msg(e.shortMessage||e.message));
