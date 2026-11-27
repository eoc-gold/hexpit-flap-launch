import assert from 'node:assert/strict';
import { mineSalt } from './vanity-salt.mjs';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, parseEther,
  parseEventLogs, zeroAddress, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { rpc, portal, helper, usd, portalAbi, usdAbi, launchAbi } from './network.mjs';

const live = process.argv.includes('--testnet');
const url = live ? rpc : 'http://127.0.0.1:18797';
const chain = bscTestnet;
const client = createPublicClient({chain, transport:http(url), pollingInterval:750});
assert.equal(await client.getChainId(), 97);
if (!live) assert.match(await client.request({method:'web3_clientVersion'}), /anvil/i);
const wallets = await client.request({method:'eth_accounts'}).catch(() => []);
const signer = live ? privateKeyToAccount(process.env.HEXPIT_TESTNET_KEY) : wallets[0];
const wallet = createWalletClient({account:signer, chain, transport:http(url)});
const player = wallet.account.address;
const second = live ? player : wallets[1];
const wallet2 = live ? wallet : createWalletClient({account:second,chain,transport:http(url)});
const factoryArtifact = JSON.parse(readFileSync('out/PackFactory.sol/PackFactory.json'));
const factoryAbi = factoryArtifact.abi;
const helperAbi = parseAbi(['function whitelist(address,uint16)']);
const read = (address, abi, functionName, args=[]) => client.readContract({address,abi,functionName,args});
const stateFile = 'runs/' + (live ? 'testnet' : 'fork') + '.json';
mkdirSync('runs',{recursive:true});
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile)) : {
  network:live ? 'Public BSC testnet' : 'Local fork of BSC testnet', chainId:97, player, second,
  forkBlock:String(await client.getBlockNumber()), steps:{}
};
assert.equal(state.player.toLowerCase(),player.toLowerCase());
function save() {
  writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));
  renameSync(stateFile+'.tmp',stateFile);
}
if (!state.salt) { Object.assign(state,mineSalt()); save(); }
async function step(name, submit) {
  const previous = state.steps[name];
  if (previous && (await client.getTransactionReceipt({hash:previous.hash}).catch(() => null))?.status === 'reverted') {
    (state.reverted ||= []).push({name, ...previous});
    delete state.steps[name];
  }
  if (!state.steps[name]) {
    const hash = await submit();
    state.steps[name] = {hash};
    save();
  }
  const entry = state.steps[name];
  const r = await client.waitForTransactionReceipt({hash:entry.hash,timeout:120000});
  assert.equal(r.status,'success', name+' reverted: '+entry.hash);
  entry.block=String(r.blockNumber);
  save();
  console.log(name,entry.hash);
  return r;
}
async function send(w, address, abi, fn, args=[], value=0n) {
  const {request} = await client.simulateContract({account:w.account,address,abi,functionName:fn,args,value});
  const estimate = await client.estimateContractGas({account:w.account,address,abi,functionName:fn,args,value});
  return w.writeContract({...request,gas:estimate * 13n / 10n + 60000n,gasPrice:await client.getGasPrice()});
}
const [enabled,price]=await read(portal,portalAbi,'launchQuoteConfig',[0,usd]);
assert(enabled && price>0n);
assert.equal(await read(usd,usdAbi,'symbol'),'USD');
assert.equal(await read(usd,usdAbi,'decimals'),18);
const fee=await read(portal,portalAbi,'SALT_LOCK_FEE');
if (live && !state.steps.factory && (await client.getBalance({address:player})) < fee + parseEther('0.002'))
  throw Error('Fund the chain-97 signer with tBNB for the salt lock and gas. '+player);
const deployed=await step('factory',()=>wallet.deployContract({abi:factoryAbi,bytecode:factoryArtifact.bytecode.object}));
const factory=deployed.contractAddress;
await step('enable',()=>send(wallet,helper,helperAbi,'whitelist',[factory,100]));
const [on,bps]=await read(portal,portalAbi,'launcherFactoryMultiplier',[factory]);
assert(on && bps === 100n,'testnet floor multiplier must be 100 bps');
const data=encodeAbiParameters([{type:'tuple',components:[{name:'salt',type:'bytes32'},{name:'meta',type:'string'}]}],
  [{salt:state.salt,meta:'https://eoc-gold.github.io/hexpit-flap-launch/game.json'}]);
const created=await step('create',()=>send(wallet,portal,portalAbi,'newLauncher',[factory,data],fee));
const launcher=parseEventLogs({abi:factoryAbi,logs:created.logs,eventName:'RoundCreated'})[0].args.launcher;
const readRound=(fn,args=[])=>read(launcher,launchAbi,fn,args);
const pricePack=await readRound('PACK_PRICE');
const limit=await readRound('PACK_LIMIT');
await step('faucet1',()=>send(wallet,usd,usdAbi,'mint',[player,pricePack]));
await step('approve1',()=>send(wallet,usd,usdAbi,'approve',[launcher,pricePack]));
const awaitedFirst = await readRound('cumulative',[1n]);
const first = await step('open1',()=>send(wallet,launcher,launchAbi,'mintPacks',[1n,awaitedFirst]));
async function rest() {
  const restCost=(limit-1n)*pricePack;
  await step('faucet2',()=>send(wallet2,usd,usdAbi,'mint',[second,restCost]));
  await step('approve2',()=>send(wallet2,usd,usdAbi,'approve',[launcher,restCost]));
  const last=await step('openLast',()=>send(wallet2,launcher,launchAbi,'mintPacks',[limit-1n,parseEther('500000')-firstReward]));
  return last;
}
const firstLog=parseEventLogs({abi:launchAbi,logs:first.logs,eventName:'PackOpened'})[0].args;
const firstReward=firstLog.game;
const last=await rest();
const token=await readRound('token'), pool=await readRound('pool');
assert.equal(token.toLowerCase(),state.predicted.toLowerCase());
assert.notEqual(pool,zeroAddress);
const poolStable=await read(usd,usdAbi,'balanceOf',[pool]);
const poolGame=await read(token,usdAbi,'balanceOf',[pool]);
assert(poolStable>=pricePack*limit && poolGame>0n);
await step('claim1',()=>send(wallet,launcher,launchAbi,'claim'));
if (!live) await step('claim2',()=>send(wallet2,launcher,launchAbi,'claim'));
assert.equal(await readRound('allocation',[player]),0n);
assert.equal(await read(token,usdAbi,'balanceOf',[launcher]),0n);
const totalClaim=parseEther('500000');
assert.equal(await read(token,usdAbi,'balanceOf',[player]),live ? totalClaim : firstReward);
if (!live) assert.equal(await read(token,usdAbi,'balanceOf',[second]),totalClaim-firstReward);
const packs=[first,last].flatMap(r=>parseEventLogs({abi:launchAbi,logs:r.logs,eventName:'PackOpened'}).map(({args})=>({
  number:Number(args.number), cards:args.cards.map(Number),game:formatEther(args.game),player:args.player
})));
assert.equal(packs.length,12);
assert.equal(packs.reduce((n,p)=>n+p.cards.length,0),60);
const lpAbi=parseAbi(['function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)']);
const [lpTotal,lpBurn,lpMin]=await Promise.all([read(pool,lpAbi,'totalSupply'),read(pool,lpAbi,'balanceOf',['0x000000000000000000000000000000000000dEaD']),read(pool,lpAbi,'balanceOf',[zeroAddress])]);
assert(lpBurn>0n && lpBurn+lpMin===lpTotal,'LP supply must be entirely locked at dead and zero');
if (!state.judgeSalt) { state.judgeSalt=mineSalt().salt; save(); }
const judgeConfig=encodeAbiParameters([{type:'tuple',components:[{name:'salt',type:'bytes32'},{name:'meta',type:'string'}]}],
  [{salt:state.judgeSalt,meta:'https://eoc-gold.github.io/hexpit-flap-launch/game.json'}]);
const judgeTx=await step('openJudgeRound',()=>send(wallet,portal,portalAbi,'newLauncher',[factory,judgeConfig],fee));
const judgeLauncher=parseEventLogs({abi:factoryAbi,logs:judgeTx.logs,eventName:'RoundCreated'})[0].args.launcher;
const record={...state,factory,launcher,judgeLauncher,token,pool,lpTotal:String(lpTotal),lpBurn:String(lpBurn),lpMinimum:String(lpMin),quote:usd,poolStable:formatEther(poolStable),
  poolGame:formatEther(poolGame),claimedGame:formatEther(totalClaim),packs, status:'verified',recorded:new Date().toISOString()};
writeFileSync('web/'+(live?'round':'rehearsal')+'.json',JSON.stringify(record,null,2)+'\n');
console.log('Verified',record.network,pool);
