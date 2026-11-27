import { formatEther, isAddressEqual, parseAbi, parseEther, parseEventLogs, zeroAddress } from 'viem';
import { launchAbi, portal, usd } from './network.mjs';

const transfersAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const claimAbi = parseAbi(['event Claimed(address indexed player, uint256 game)']);
const cardsAbi = parseAbi(['event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)']);
const directAbi = parseAbi(['event FlapDirectLaunched(address token,uint8 kind,address creator,bytes32 schemaId,bytes data)']);
const registry = parseAbi(['function getLauncher(address) view returns (address)']);
const burn = '0x000000000000000000000000000000000000dEaD';
const expect = (check, label) => { if (!check) throw Error(label); };
const at = (receipt, address) => receipt.logs.filter(log => isAddressEqual(log.address, address));

export async function verifyReceipts(client, record) {
  expect(await client.getChainId() === 97, 'BSC Testnet is required.');
  const [first, final, claim, factory] = await Promise.all([
    ...['open1', 'openLast', 'claim1'].map(name => client.getTransactionReceipt({ hash: record.steps[name].hash })),
    client.readContract({ address: portal, abi: registry, functionName: 'getLauncher', args: [record.launcher] })
  ]);
  expect(isAddressEqual(factory, record.factory), 'Launcher factory differs from the record.');
  expect([first, final, claim].every(r => r.status === 'success'), 'A transaction did not confirm.');
  const packs = [first, final].flatMap(r => parseEventLogs({ abi: launchAbi, logs: at(r, record.launcher), eventName: 'PackOpened' }));
  const hands = [first, final].flatMap(r => parseEventLogs({ abi: cardsAbi, logs: at(r, record.launcher), eventName: 'TransferBatch' }));
  expect(packs.length === 12 && packs.every((p, i) => p.args.number === BigInt(i + 1) && p.args.cards.length === 5), 'Incomplete pack sequence.');
  expect(hands.length === packs.length, 'Incomplete ERC-1155 mint sequence.');
  for (const [i, {args}] of packs.entries()) {
    const shown = record.packs[i];
    expect(shown && shown.number === i + 1 && isAddressEqual(args.player, shown.player) &&
      args.game === parseEther(shown.game) && shown.cards?.length === 5 &&
      args.cards.every((id, n) => Number(id) === shown.cards[n]), 'Card receipt differs from the replay.');
    const hand = hands[i].args;
    expect(isAddressEqual(hand.from, zeroAddress) && isAddressEqual(hand.to, args.player) &&
      hand.ids.length === 5 && hand.values.length === 5 &&
      args.cards.every((id, n) => id === hand.ids[n] && hand.values[n] === 1n), 'ERC-1155 hand differs from its pack.');
  }
  const opened = parseEventLogs({ abi: launchAbi, logs: at(final, record.launcher), eventName: 'PoolOpened' })[0]?.args;
  expect(opened && isAddressEqual(opened.token, record.token) && isAddressEqual(opened.pool, record.pool), 'Pool creation differs from the record.');
  const direct = parseEventLogs({ abi: directAbi, eventName: 'FlapDirectLaunched', logs: at(final, portal) })[0]?.args;
  expect(direct && isAddressEqual(direct.token, opened.token) && direct.kind === 0, 'Flap direct tax-token launch missing.');
  const sum = (r, asset, to, from) => parseEventLogs({ abi: transfersAbi, logs: at(r, asset) })
    .filter(e => isAddressEqual(e.args.to, to) && (!from || isAddressEqual(e.args.from, from)))
    .reduce((v, e) => v + e.args.value, 0n);
  const quote = sum(final, usd, opened.pool);
  const game = sum(final, opened.token, opened.pool);
  expect(quote === parseEther('60') && game === parseEther('500000'), 'Pool deposits differ from the round target.');
  const burned = sum(final, opened.pool, burn);
  const minimum = sum(final, opened.pool, zeroAddress, zeroAddress);
  expect(burned > 0n && burned === BigInt(record.lpBurn) && minimum === BigInt(record.lpMinimum)
    && burned + minimum === BigInt(record.lpTotal), 'LP burn differs from the round record.');
  const reserve = packs.reduce((total, p) => total + p.args.game, 0n);
  const paid = parseEventLogs({ abi: claimAbi, logs: at(claim, record.launcher) })[0]?.args;
  expect(reserve === parseEther('500000') && paid?.game === reserve && packs.every(p => isAddressEqual(paid.player, p.args.player)) &&
    sum(claim, opened.token, paid.player, record.launcher) === reserve, 'GAME claim differs from the pack reserve.');
  return { packs: packs.length, cards: packs.length * 5, buyers: new Set(packs.map(p => p.args.player)).size,
    usd: formatEther(quote), game: formatEther(game), claimed: formatEther(reserve), block: String(final.blockNumber) };
}
