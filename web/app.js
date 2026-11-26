import { createPublicClient, createWalletClient, custom, http, formatEther, parseAbi, parseEventLogs, zeroAddress, isAddress } from 'viem';
import {bscTestnet} from 'viem/chains';
import {rpc,portal,usd,usdAbi,launchAbi} from '../scripts/network.mjs';
const el=id=>document.getElementById(id);
const [publicRound,fork,catalog]=await Promise.all(['round','rehearsal','catalog'].map(async file=>{
  const r=await fetch('./'+file+'.json'); if (!r.ok) throw Error('Missing '+file); return r.json();
}));
const live=publicRound.status==='verified';
const data=live?publicRound:fork;
const qty=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
let index=0;
function show(i) {
  index=i;
  const p=data.packs[i];
  el('position').textContent=p.number+' / 12';
  el('prev').disabled=i===0;el('next').disabled=i===11;
  el('raised').textContent=(5*p.number)+' / 60 USD';
  el('earned').textContent=qty(p.game)+' GAME';
  el('phase').textContent=i===11?'Pool opened':'Collecting packs';
  el('fill').style.width=(100*p.number/12)+'%';
  el('cards').replaceChildren(...p.cards.map(id=>{
    const card=catalog[id-1], figure=document.createElement('figure'), img=document.createElement('img'), cap=document.createElement('figcaption');
    img.src='./art/'+card.slug+'.webp';img.alt=card.name;cap.textContent=card.class+' · '+card.rarity;
    figure.append(img,cap);return figure;
  }));
}
el('mode').textContent=live?'Public BSC testnet · Receipt replay':'BSC testnet fork · Receipt replay';
el('record').href=live?'./round.json':'./rehearsal.json';
el('proof').textContent=live?'Confirmed on public BSC testnet. Open the transactions below.':
  'Replayed on a local fork of BSC testnet at block '+data.forkBlock+'. Public testnet receipts are pending.';
if (live) for (const [name,key] of [['Factory','factory'],['Create launcher','create'],['Final mint + pool','openLast'],['Claim','claim1']]) {
  const a=document.createElement('a');a.href='https://testnet.bscscan.com/tx/'+data.steps[key].hash;a.textContent=name+' ↗';el('prooflinks').append(a);
}
show(0);el('prev').onclick=()=>show(index-1);el('next').onclick=()=>show(index+1);el('last').onclick=()=>show(11);
const params=new URLSearchParams(location.search);
const local=['127.0.0.1','localhost'].includes(location.hostname)&&params.has('fork');
const round=local?fork:publicRound;
const endpoint=local?'http://127.0.0.1:18797':rpc;
const chain=bscTestnet;
const client=createPublicClient({chain,transport:http(endpoint)});
const address=params.get('launcher')||round.judgeLauncher||round.launcher;
const msg=t=>{el('feedback').textContent=t;};
let wallet,account;
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
  await refresh();msg('Confirmed: '+hash);
  if(fn==='mintPacks'){
    const pack=parseEventLogs({abi:launchAbi,eventName:'PackOpened',logs:receipt.logs})[0]?.args;
    if(pack) msg('Mint confirmed. '+pack.cards.map(id=>catalog[Number(id)-1].name).join(', ')+'. '+qty(formatEther(pack.game))+' GAME allocated. '+hash);
  }
}
async function refresh(){
  el('actions').replaceChildren();
  if(!address||!round.factory){el('help').textContent='The public testnet launcher is awaiting deployment. Explore every pack above using the recorded fork run.';return;}
  if(!isAddress(address))throw Error('Invalid launcher address.');
  const verifiedFactory=await read(portal,parseAbi(['function getLauncher(address) view returns (address)']),'getLauncher',[address]);
  if(verifiedFactory.toLowerCase()!==round.factory.toLowerCase() || (await read(address,launchAbi,'USD')).toLowerCase()!==usd.toLowerCase()) throw Error('Unknown launcher or quote asset.');
  const [sold,deadline,pool]=await Promise.all(['sold','deadline','pool'].map(fn=>read(address,launchAbi,fn)));
  const closed=pool!==zeroAddress;
  el('help').textContent=(local?'Local fork. ':'Public BSC testnet. ')+sold+' of 12 packs minted. '+(closed?'The pool is open. Connect the wallet that minted to check its claim.':'Each pack costs 5 faucet USD. Your wallet confirms each transaction.');
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
  }else if((await client.getBlock()).timestamp>=deadline){
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
