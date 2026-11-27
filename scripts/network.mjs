import {parseAbi, getAddress} from 'viem';
export const rpc = 'https://bsc-testnet-rpc.publicnode.com';
export const portal = getAddress('0x000042108465206185A077Edc3F3fd2b49060000');
export const helper = getAddress('0x77779969a11eff7582f3bCf48135A846A3457777');
export const usd = getAddress('0x190C989D5665a0e404B444b53CAE9AbCfb600157');
export const tokenImpl = getAddress('0x7777c57ff7dc441c1715b2e36fa581c48B782222');
export const portalAbi = parseAbi([
 'function SALT_LOCK_FEE() view returns (uint256)',
 'function launchQuoteConfig(uint8,address) view returns (bool,uint256)',
 'function launcherFactoryMultiplier(address) view returns (bool,uint256)',
 'function newLauncher(address,bytes) payable returns (address)'
]);
export const usdAbi = parseAbi([
 'function symbol() view returns (string)', 'function decimals() view returns (uint8)',
 'function mint(address,uint256)', 'function approve(address,uint256) returns (bool)',
 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'
]);
export const tableAbi = parseAbi([
 'struct Seat { uint8 position; uint8[5] cards; bool claimed; }',
 'function factory() view returns (address)',
 'function tableState(address) view returns (uint256 startSold,uint256 pledged,uint256 reward)',
 'function seatOf(address,address) view returns (Seat)',
 'function claimable(address,address) view returns (uint256)',
 'function join(address,uint256)', 'function leave(address)', 'function release(address)', 'function claim(address,address)'
]);
export const launchAbi = parseAbi([
 'function sold() view returns (uint256)', 'function deadline() view returns (uint256)',
 'function cumulative(uint256) pure returns (uint256)', 'function allocation(address) view returns (uint256)',
 'function paid(address) view returns (uint256)', 'function pool() view returns (address)', 'function token() view returns (address)',
 'function USD() view returns (address)', 'function PACK_PRICE() view returns (uint256)', 'function PACK_LIMIT() view returns (uint256)',
 'function mintPacks(uint256,uint256)', 'function claim()', 'function refund()',
 'event PackOpened(address indexed player,uint256 indexed number,uint256[] cards,uint256 game)',
 'event PoolOpened(address indexed token,address indexed pool)'
]);
