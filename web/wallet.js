import { createPublicClient, createWalletClient, custom, formatEther, http, isAddress, parseAbi, parseEther, parseEventLogs, toHex, zeroAddress } from 'viem';
import { bscTestnet } from 'viem/chains';
import { launchAbi, portal, rpc, tableAbi, usd, usdAbi } from '../scripts/network.mjs';
import { ignitionStage, reducedMotion } from './ignition/stage.js';
import { fundingPanel } from './round-progress.js';
import { forkTable, publicTable } from './closing-table.js';
import { tableOffer } from './table-wallet.js';

const el = id => document.getElementById(id);
const explorer = bscTestnet.blockExplorers.default.url;
const factoryAbi = parseAbi(['function getLauncher(address) view returns (address)']);
const faucetAmounts = new Set(['5', '15', '60']);
const quantity = value => Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function initWallet({ publicRound, fork, catalog, replayPack }) {
  const params = new URLSearchParams(location.search);
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname) && params.has('fork');
  const tableFork = local && params.get('fork') === 'table';
  const endpoint = tableFork ? 'http://127.0.0.1:18972' : local ? 'http://127.0.0.1:18797' : rpc;
  const chain = local ? {
    ...bscTestnet,
    name: 'Local BSC testnet fork',
    rpcUrls: { default: { http: [endpoint] } }
  } : bscTestnet;
  const round = local && !tableFork ? fork : publicRound;
  const table = (tableFork ? forkTable : local ? undefined : publicTable)?.table;
  const address = params.get('launcher') || round.judgeLauncher || round.launcher;
  const client = createPublicClient({ chain, transport: http(endpoint), cacheTime: 0 });
  const updateFunding = fundingPanel(el('wallet-funding'));
  const connect = el('connect-wallet');
  const copy = el('copy-wallet');
  const faucet = el('claim-faucet');
  const amount = el('faucet-amount');
  const actions = el('actions');
  const mintButton = document.createElement('button');
  actions.append(mintButton);
  const tableButton = document.createElement('button');
  el('live-table-actions').append(tableButton);
  el('wallet-table').hidden = !table;
  el('live-escrow-row').hidden = !table;
  if (tableFork) el('table-live-link').hidden = false;
  const assetLink = el('faucet-contract');

  let wallet, account, network, balance, gas, roundAction, tableAction, lastPack, walletStage;
  let working = false;
  let syncPending = false;
  let factoryVerified = false;
  let tableVerified = false;

  assetLink.href = explorer + '/token/' + usd;
  assetLink.hidden = local;
  el('wallet-replay').onclick = () => replayPack(lastPack, false, report);
  const read = (target, abi, functionName, args = []) =>
    client.readContract({ address: target, abi, functionName, args });

  function report(message, hash) {
    el('wallet-feedback').hidden = !message;
    el('feedback').textContent = message;
    const link = el('wallet-tx');
    link.hidden = !hash || local;
    if (hash) link.href = explorer + '/tx/' + hash;
  }

  function render() {
    const rightChain = network === chain.id;
    const hasGas = gas !== undefined && gas > 0n;
    el('wallet-account').textContent = account ? account.slice(0, 6) + '…' + account.slice(-4) : 'Wallet disconnected';
    el('wallet-account').title = account || '';
    el('wallet-network').textContent = account && !rightChain ? 'Switch to ' + chain.name : chain.name + ' · Chain ' + chain.id;
    el('faucet-balance').textContent = balance === undefined ? '— test USD' : quantity(balance) + ' test USD';
    connect.textContent = account ? 'Switch to testnet' : 'Connect wallet';
    connect.hidden = Boolean(account && rightChain);
    connect.disabled = working;
    copy.hidden = !account || !rightChain;
    faucet.disabled = working || !account || !rightChain || !hasGas;
    amount.disabled = working;
    el('faucet-help').textContent = !account ? 'Connect a wallet to mint test USD. You’ll need tBNB to pay for gas.'
      : !rightChain ? 'Switch your connected wallet to BSC Testnet.'
        : gas === undefined ? 'Checking your tBNB balance…'
          : hasGas ? 'Test USD goes directly to your connected wallet.'
            : 'This wallet needs tBNB before it can send testnet transactions.';

    mintButton.hidden = !roundAction;
    mintButton.disabled = working || !rightChain || !hasGas;
    mintButton.textContent = roundAction?.label ?? '';
    mintButton.onclick = roundAction ? () => run(roundAction.execute) : null;
    tableButton.hidden = !tableAction?.label;
    tableButton.disabled = working || !rightChain || !hasGas;
    tableButton.textContent = tableAction?.label || '';
    tableButton.onclick = tableAction?.label ? () => run(tableAction.execute) : null;
  }

  async function switchNetwork() {
    if (await wallet.getChainId() === chain.id) return;
    try {
      await wallet.switchChain({ id: chain.id });
    } catch (error) {
      if (error.code !== 4902 && error.cause?.code !== 4902) throw error;
      await wallet.addChain({ chain });
      if (await wallet.getChainId() !== chain.id) await wallet.switchChain({ id: chain.id });
    }
  }

  function bindProvider() {
    if (wallet || !window.ethereum) return;
    const provider = window.ethereum;
    wallet = createWalletClient({ chain, transport: custom(provider) });
    provider.on?.('accountsChanged', requestSync);
    provider.on?.('chainChanged', requestSync);
  }

  async function sync() {
    bindProvider();
    const [currentAccount] = wallet ? await wallet.getAddresses() : [];
    if (account !== currentAccount) {
      account = currentAccount;
      lastPack = undefined;
      walletStage?.show();
      el('wallet-receipt').hidden = true;
      balance = gas = undefined;
    }
    network = account ? await wallet.getChainId() : undefined;
    roundAction = tableAction = undefined;
    const walletUpdate = account ? Promise.all([
      read(usd, usdAbi, 'balanceOf', [account]),
      client.getBalance({ address: account })
    ]).then(([usdBalance, gasBalance]) => {
      balance = usdBalance;
      gas = gasBalance;
    }).catch(error => {
      balance = gas = undefined;
      report('Could not read your wallet balances. Return to this tab to retry.');
      console.error(error);
    }) : Promise.resolve();
    await Promise.all([walletUpdate, refreshRound(walletUpdate).catch(error => {
      el('help').textContent = 'Could not load this testnet round. The faucet is available separately.';
      if (table) {
        el('live-table-quote').textContent = '';
        el('live-table-help').textContent = 'Could not verify this round.';
      }
      console.error(error);
    })]);
  }

  async function run(task, clearFeedback = true) {
    if (working) return;
    working = true;
    if (clearFeedback) report('');
    render();
    try {
      await task();
    } catch (error) {
      report(error.shortMessage || error.message);
      if (task !== sync) syncPending = true;
    } finally {
      working = false;
      render();
      if (syncPending) requestSync();
    }
  }

  function requestSync() {
    syncPending = true;
    if (!working) {
      syncPending = false;
      void run(sync, false);
    }
  }

  connect.onclick = () => run(async () => {
    bindProvider();
    if (!wallet) throw Error('Open this page in a browser with an EVM wallet, such as MetaMask.');
    if (!account) await wallet.requestAddresses();
    await switchNetwork();
    await sync();
  });

  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(account);
      copy.textContent = 'Address copied';
      setTimeout(() => { copy.textContent = 'Copy address'; }, 1500);
    } catch {
      report('Wallet address ' + account);
    }
  };

  el('faucet-form').onsubmit = event => {
    event.preventDefault();
    if (faucet.disabled || !faucetAmounts.has(amount.value)) return;
    const size = amount.value;
    void run(() => transact(usd, usdAbi, 'mint', [account, parseEther(size)], size + ' test USD added to your wallet.'));
  };

  async function reveal(pack, hash) {
    lastPack = { ...pack, hash: local ? undefined : hash };
    el('wallet-receipt').hidden = false;
    walletStage ??= ignitionStage(el('wallet-stage'), el('wallet-cards'), catalog);
    walletStage.charge(pack.cards);
    if (!reducedMotion.matches) await new Promise(resolve => setTimeout(resolve, 680));
    walletStage.show(pack.cards, true);
  }

  async function transact(target, abi, functionName, args, confirmation, onConfirmed) {
    const [sender] = await wallet.getAddresses();
    if (!sender || sender !== account) throw Error('The connected wallet changed. Try again with the active account.');
    if (await wallet.getChainId() !== chain.id) throw Error('Switch to BSC Testnet before confirming.');
    if (local) {
      const tip = await client.getBlock();
      const walletBlock = await wallet.request({ method: 'eth_getBlockByNumber', params: [toHex(tip.number), false] });
      if (walletBlock?.hash !== tip.hash) throw Error('Select the local fork RPC in your wallet: ' + endpoint);
    }
    const config = { account: sender, address: target, abi, functionName, args };
    await client.simulateContract(config);
    const estimate = await client.estimateContractGas(config);
    report('Confirm the transaction in your wallet.');
    const hash = await wallet.writeContract({ ...config, gas: estimate * 13n / 10n + 60000n });
    report('Waiting for testnet confirmation…', hash);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw Error('The transaction reverted. ' + hash);
    report(confirmation, hash);

    if (functionName === 'mintPacks') {
      const logs = receipt.logs.filter(log => log.address.toLowerCase() === target.toLowerCase());
      const pack = parseEventLogs({ abi: launchAbi, eventName: 'PackOpened', logs })[0]?.args;
      if (pack) {
        const poolOpened = parseEventLogs({ abi: launchAbi, eventName: 'PoolOpened', logs }).length > 0;
        report('Pack minted · ' + quantity(pack.game) + ' GAME allocated.', hash);
        await reveal({ ...pack, number: Number(pack.number), game: formatEther(pack.game), poolOpened }, hash);
        updateFunding({ packs: Number(pack.number), poolOpened, payment: true });
      }
    }
    if (onConfirmed) await onConfirmed(hash);
    await sync();
  }

  async function refreshTable(sold, closed, expired, walletUpdate) {
    if (!table) return;
    if (!tableVerified) {
      const tableFactory = await read(table, tableAbi, 'factory');
      if (tableFactory.toLowerCase() !== round.factory.toLowerCase()) throw Error('Unknown table factory.');
      tableVerified = true;
    }
    await walletUpdate;
    const showEscrow = value => { el('live-escrow').textContent = quantity(value) + ' test USD'; };
    tableAction = await tableOffer({ table, round: address, account, balance, sold, closed, expired, read, transact, reveal, showEscrow });
    el('live-table-quote').textContent = tableAction.quote;
    el('live-table-help').textContent = tableAction.help;
  }

  async function refreshRound(walletUpdate) {
    if (!address || !round.factory) {
      el('help').textContent = 'The public testnet launcher is awaiting deployment.';
      return;
    }
    if (!factoryVerified) {
      if (!isAddress(address)) throw Error('Invalid launcher address.');
      const [factory, quote] = await Promise.all([
        read(portal, factoryAbi, 'getLauncher', [address]),
        read(address, launchAbi, 'USD')
      ]);
      if (factory.toLowerCase() !== round.factory.toLowerCase() || quote.toLowerCase() !== usd.toLowerCase()) {
        throw Error('Unknown launcher or quote asset.');
      }
      factoryVerified = true;
    }

    const [chainSold, deadline, pool] = await Promise.all(['sold', 'deadline', 'pool'].map(fn => read(address, launchAbi, fn)));
    const closed = pool !== zeroAddress || Boolean(lastPack?.poolOpened);
    const expired = !closed && (await client.getBlock()).timestamp >= deadline;
    const latestMint = BigInt(lastPack?.number ?? 0);
    const sold = chainSold > latestMint ? chainSold : latestMint;
    updateFunding({ packs: Number(sold), poolOpened: closed, expired, payment: sold === latestMint && sold > 0n });
    await refreshTable(sold, closed, expired, walletUpdate).catch(error => {
      el('live-escrow').textContent = '—';
      el('live-table-quote').textContent = '';
      el('live-table-help').textContent = 'The table could not be read. Return to this tab to refresh.';
      console.error(error);
    });

    if (!account) {
      el('help').textContent = closed ? 'Connect the wallet that minted to check its GAME claim.'
        : expired ? 'The round ended before reaching its target.'
          : 'Connect to mint five cards for 5 test USD.';
      return;
    }
    if (closed || expired) {
      const value = await read(address, launchAbi, closed ? 'allocation' : 'paid', [account]);
      el('help').textContent = closed ? (value > 0n ? 'The pool is open. Your solo pack GAME is ready to claim.' : 'The pool is open. This wallet has no outstanding solo pack claim.')
        : (value > 0n ? 'This round expired. Your test USD is ready to refund.' : 'This round expired. This wallet has no refund to claim.');
      if (value > 0n) {
        roundAction = closed ? {
          label: 'Claim ' + quantity(value) + ' GAME',
          execute: () => transact(address, launchAbi, 'claim', [], 'GAME claimed.')
        } : {
          label: 'Refund ' + quantity(value) + ' test USD',
          execute: () => transact(address, launchAbi, 'refund', [], 'Test USD refunded.')
        };
      }
      return;
    }

    const [price, allowance, start, end] = await Promise.all([
      read(address, launchAbi, 'PACK_PRICE'),
      read(usd, usdAbi, 'allowance', [account, address]),
      read(address, launchAbi, 'cumulative', [sold]),
      read(address, launchAbi, 'cumulative', [sold + 1n])
    ]);
    const minimum = end - start;
    await walletUpdate;
    if (balance === undefined) {
      el('help').textContent = 'Your test USD balance is unavailable.';
      return;
    }
    if (balance < price) {
      el('help').textContent = 'Get at least 5 test USD from the faucet above to mint a pack.';
      return;
    }
    if (allowance < price) {
      el('help').textContent = 'The next solo pack earns ' + quantity(minimum) + ' GAME. Approve 5 test USD, then open your pack.';
      roundAction = {
        label: 'Approve 5 test USD',
        execute: () => transact(usd, usdAbi, 'approve', [address, price], 'Approved 5 test USD. Your pack is ready to mint.')
      };
      return;
    }
    el('help').textContent = 'Five cards and ' + quantity(minimum) + ' GAME for 5 test USD. A lower allocation requires a new quote.';
    roundAction = {
      label: 'Open pack · 5 test USD',
      execute: () => transact(address, launchAbi, 'mintPacks', [1n, minimum], 'Pack minted.')
    };
  }

  window.addEventListener('focus', requestSync);
  if (table) setInterval(() => { if (account && !working && !document.hidden) requestSync(); }, 15000);
  requestSync();
}
