import { formatEther, parseEther } from 'viem';
import { launchAbi, tableAbi, usd, usdAbi } from '../scripts/network.mjs';

const limit = 12n;
const price = parseEther('5');
const quantity = value => Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: 2 });

export async function tableOffer({ table, round, account, balance, sold, closed, expired, read, transact, reveal, showEscrow }) {
  const [[start, pledged, reward], seat] = await Promise.all([
    read(table, tableAbi, 'tableState', [round]),
    account ? read(table, tableAbi, 'seatOf', [round, account]) : undefined
  ]);
  const seated = (seat?.position ?? 0) > 0;
  showEscrow(reward > 0n ? 0n : pledged * price);
  if (reward > 0n) {
    const quote = pledged + ' seats filled. The pool is open.';
    if (!seated) return { quote, help: 'Each seated wallet can collect its five cards and share of GAME.' };
    const position = BigInt(seat.position);
    const share = reward * position / pledged - reward * (position - 1n) / pledged;
    const hand = { number: Number(start + position), cards: Array.from(seat.cards), game: formatEther(share), player: account, poolOpened: true };
    if (seat.claimed) return { quote, help: 'This wallet collected five cards and ' + quantity(share) + ' GAME.' };
    return {
      quote, help: 'Your hand and ' + quantity(share) + ' GAME are ready to collect.',
      label: 'Claim five cards + GAME',
      execute: () => transact(table, tableAbi, 'claim', [round, account], 'Table hand and GAME claimed.', hash => reveal(hand, hash))
    };
  }
  if (pledged > 0n && (start !== sold || expired || closed)) {
    return {
      quote: quantity(pledged * price) + ' test USD is refundable.',
      help: 'The original table quote expired or another pack sold. Anyone can return every waiting pledge.',
      label: account && 'Return all waiting pledges',
      execute: () => transact(table, tableAbi, 'release', [round], 'All waiting pledges returned to their wallets.')
    };
  }
  if (closed || expired) {
    return { quote: closed ? 'The pool is open.' : 'The round expired.', help: 'This table has no waiting pledges.' };
  }
  const remaining = limit - sold;
  const [atStart, atEnd] = await Promise.all([sold, limit].map(count => read(round, launchAbi, 'cumulative', [count])));
  const quotedShare = (atEnd - atStart) / remaining;
  const quote = pledged + ' / ' + remaining + ' seats pledged · about ' + quantity(quotedShare) + ' GAME and five cards per seat.';
  if (!account) return { quote, help: 'Connect a wallet to take one seat for 5 test USD.' };
  if (seated) return {
    quote, help: 'Your 5 test USD stays refundable until the final seat buys all remaining packs.',
    label: 'Withdraw my 5 test USD',
    execute: () => transact(table, tableAbi, 'leave', [round], 'Your 5 test USD pledge was returned.')
  };
  if (balance === undefined || balance < price) return { quote, help: 'Get 5 test USD from the faucet to take a seat.' };
  const allowance = await read(usd, usdAbi, 'allowance', [account, table]);
  if (allowance < price) return {
    quote, help: 'Approve one seat for the closing table. Your pledge uses the displayed quote.',
    label: 'Approve 5 test USD for table',
    execute: () => transact(usd, usdAbi, 'approve', [table, price], 'Closing table approved for one seat.')
  };
  const final = pledged + 1n === remaining;
  return {
    quote, help: final ? 'This seat will buy all remaining packs and open the pool if the table is still full.'
      : 'You can withdraw your pledge any time the table is waiting.',
    label: final ? 'Fill table and open pool' : 'Pledge 5 test USD',
    execute: () => transact(table, tableAbi, 'join', [round, sold], 'Pledge confirmed. Check your table seat below.')
  };
}
