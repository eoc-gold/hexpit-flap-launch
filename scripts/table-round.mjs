// Rehearse on a local Anvil fork by default. --testnet uses the dedicated chain-97 signer.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeAbiParameters, encodeDeployData,
  encodeFunctionData, formatEther, http, isAddressEqual, parseAbi, parseEther, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { launchAbi, portal, portalAbi, rpc, usd, usdAbi } from './network.mjs';
import { mineSalt } from './vanity-salt.mjs';

const live = process.argv.includes('--testnet');
const transport = http(live ? rpc : 'http://127.0.0.1:18972');
const client = createPublicClient({ chain: bscTestnet, transport, pollingInterval: 400 });
assert.equal(await client.getChainId(), 97);
const file = path => JSON.parse(readFileSync(path, 'utf8'));
const { factory } = file('web/round.json');
const artifact = file('out/ClosingTable.sol/ClosingTable.json');
const factoryAbi = file('out/PackFactory.sol/PackFactory.json').abi;
const publicMode = live ? 'testnet' : 'fork';
let accounts;
let runId = publicMode;
if (live) {
  const key = process.env.HEXPIT_TESTNET_KEY;
  assert.ok(key, 'Supply the dedicated testnet signer.');
  // A second, reproducible demo account controlled by the same team.
  const secondKey = createHmac('sha256', Buffer.from(key.slice(2), 'hex'))
    .update('HexPit closing table / BSC testnet 97 / second demo seat').digest('hex');
  accounts = [privateKeyToAccount(key), privateKeyToAccount('0x' + secondKey)];
} else {
  const anvil = await client.request({ method: 'anvil_metadata' });
  assert.ok(anvil.instanceId, 'Run the local Anvil fork on port 18972.');
  runId += '-' + anvil.instanceId;
  accounts = (await client.request({ method: 'eth_accounts' })).slice(0, 2);
}
const wallets = accounts.map(account => createWalletClient({ account, chain: bscTestnet, transport }));
const [first, second] = wallets.map(w => w.account.address);
assert.notEqual(first.toLowerCase(), second.toLowerCase());
const runFile = 'runs/table-' + runId + '.json';
mkdirSync('runs', { recursive: true });
const state = existsSync(runFile) ? file(runFile) : {
  ...mineSalt(), factory, first, second, steps: {}
};
assert.deepEqual([state.first, state.second, state.factory], [first, second, factory]);
function save() {
  writeFileSync(runFile + '.tmp', JSON.stringify(state, null, 2));
  renameSync(runFile + '.tmp', runFile);
}
save();
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function transferred(receipt, asset, from, to) {
  const logs = receipt.logs.filter(log => isAddressEqual(log.address, asset));
  return parseEventLogs({ abi: transferAbi, logs, eventName: 'Transfer' })
    .filter(e => isAddressEqual(e.args.from, from) && isAddressEqual(e.args.to, to))
    .reduce((amount, e) => amount + e.args.value, 0n);
}
let spent = BigInt(state.failedGasCost ?? 0);
async function send(name, wallet, tx) {
  let hash = state.steps[name];
  if (!hash) {
    const [estimate, gasPrice] = await Promise.all([
      client.estimateGas({ account: wallet.account, ...tx }), client.getGasPrice()
    ]);
    const gas = estimate * 13n / 10n + 50000n;
    assert.ok(!live || spent + gas * gasPrice + (tx.value ?? 0n) <= parseEther('0.02'), 'Testnet spend cap reached.');
    hash = await wallet.sendTransaction({ ...tx, gas, gasPrice });
    state.steps[name] = hash;
    save();
  }
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120000 });
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  if (receipt.status !== 'success') {
    (state.reverted ??= []).push({ step: name, hash });
    state.failedGasCost = String(BigInt(state.failedGasCost ?? 0) + fee);
    delete state.steps[name];
    save();
    throw Error(name + ' reverted: ' + hash + '. Correct the cause and rerun to resume.');
  }
  spent += fee + (tx.value ?? 0n);
  console.log(name, hash);
  return receipt;
}
const call = (name, wallet, to, abi, functionName, args, value) =>
  send(name, wallet, { to, data: encodeFunctionData({ abi, functionName, args }), value });
const program = await send('deploy', wallets[0], { data: encodeDeployData({
  abi: artifact.abi, bytecode: artifact.bytecode.object, args: [factory]
}) });
const table = program.contractAddress;
assert.equal((await read(table, artifact.abi, 'factory')).toLowerCase(), factory.toLowerCase());
const metadata = 'https://eoc-gold.github.io/hexpit-flap-launch/game.json';
const config = encodeAbiParameters([{ type: 'tuple', components: [{ type: 'bytes32' }, { type: 'string' }] }], [[state.salt, metadata]]);
const create = await call('create', wallets[0], portal, portalAbi, 'newLauncher', [factory, config], await read(portal, portalAbi, 'SALT_LOCK_FEE'));
const launcher = parseEventLogs({ abi: factoryAbi, logs: create.logs, eventName: 'RoundCreated' })[0].args.launcher;
const price = await read(launcher, launchAbi, 'PACK_PRICE');
await call('fundFirst', wallets[0], usd, usdAbi, 'mint', [first, price * 11n]);
await call('fundSecond', wallets[0], usd, usdAbi, 'mint', [second, price]);
if (live) {
  // The second wallet must cover the gas limit for opening a pool, as well as its approval and claim.
  state.secondaryGas ??= String((await client.getGasPrice()) * 9_000_000n);
  save();
  await send('gasForSecond', wallets[0], { to: second, value: BigInt(state.secondaryGas) });
}
await call('approveSolo', wallets[0], usd, usdAbi, 'approve', [launcher, price * 10n]);
await call('tenSoloPacks', wallets[0], launcher, launchAbi, 'mintPacks', [10n, await read(launcher, launchAbi, 'cumulative', [10n])]);
await call('approveFirstSeat', wallets[0], usd, usdAbi, 'approve', [table, price]);
await call('approveSecondSeat', wallets[1], usd, usdAbi, 'approve', [table, price]);
const pledge = await call('pledge', wallets[0], table, artifact.abi, 'join', [launcher, 10n]);
assert.equal(transferred(pledge, usd, first, table), price);
const withdrawal = await call('withdraw', wallets[0], table, artifact.abi, 'leave', [launcher]);
assert.equal(transferred(withdrawal, usd, table, first), price);
await call('approveAfterRefund', wallets[0], usd, usdAbi, 'approve', [table, price]);
const repledge = await call('repledge', wallets[0], table, artifact.abi, 'join', [launcher, 10n]);
assert.equal(transferred(repledge, usd, first, table), price);
const closing = await call('close', wallets[1], table, artifact.abi, 'join', [launcher, 10n]);
assert.equal(transferred(closing, usd, second, table), price);
assert.equal(transferred(closing, usd, table, launcher), 2n * price);
const cardsAbi = parseAbi(['function balanceOf(address,uint256) view returns (uint256)']);
const closeLogs = closing.logs.filter(log => log.address.toLowerCase() === launcher.toLowerCase());
const packs = parseEventLogs({ abi: launchAbi, logs: closeLogs, eventName: 'PackOpened' });
assert.deepEqual(packs.map(p => Number(p.args.number)), [11, 12]);
assert.ok(packs.every(p => p.args.player.toLowerCase() === table.toLowerCase()));
const { token, pool } = parseEventLogs({ abi: launchAbi, logs: closeLogs, eventName: 'PoolOpened' })[0].args;
assert.equal(token.toLowerCase(), state.predicted.toLowerCase());
const [, seated, reward] = await read(table, artifact.abi, 'tableState', [launcher]);
assert.equal(seated, 2n);
const players = [];
for (const [i, wallet] of wallets.entries()) {
  const player = wallet.account.address;
  const name = i === 0 ? 'claimFirstSeat' : 'claimSecondSeat';
  const receipt = await call(name, wallet, table, artifact.abi, 'claim', [launcher, player]);
  const event = parseEventLogs({ abi: artifact.abi, logs: receipt.logs.filter(l => l.address.toLowerCase() === table.toLowerCase()), eventName: 'HandClaimed' })[0];
  const game = event.args.game;
  assert.equal(event.args.to.toLowerCase(), player.toLowerCase());
  assert.equal(game, i === 0 ? reward / 2n : reward - reward / 2n);
  assert.equal(await read(token, usdAbi, 'balanceOf', [player]), game);
  const cards = packs[i].args.cards.map(Number);
  assert.equal(cards.length, 5);
  const seat = await read(table, artifact.abi, 'seatOf', [launcher, player]);
  assert.equal(seat.claimed, true);
  assert.deepEqual(seat.cards.map(Number), cards);
  for (const id of new Set(cards)) {
    assert.ok(await read(launcher, cardsAbi, 'balanceOf', [player, BigInt(id)]) >= BigInt(cards.filter(x => x === id).length));
  }
  players.push({ address: player, cards, game: formatEther(game), soloGame: formatEther(packs[i].args.game), claim: receipt.transactionHash });
}
assert.equal(await read(token, usdAbi, 'balanceOf', [table]), 0n);
assert.equal(await read(usd, usdAbi, 'balanceOf', [pool]), price * 12n);
assert.equal(await read(token, usdAbi, 'balanceOf', [pool]), parseEther('500000'));
const evidence = { mode: publicMode, chainId: 97, factory, table, launcher, token, pool, startSold: 10,
  target: 12, price: formatEther(price), reserve: formatEther(reward), players,
  steps: state.steps, closingBlock: String(closing.blockNumber) };
const output = 'web/table-' + publicMode + '.json';
writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(output, 'pool funded; both hands and GAME shares claimed');
