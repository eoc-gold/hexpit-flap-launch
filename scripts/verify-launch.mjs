import { readFileSync } from 'node:fs';
import { createPublicClient, http } from 'viem';
import { rpc } from './network.mjs';
import { verifyReceipts } from './verify-receipts.mjs';

const client = createPublicClient({ transport: http(process.env.BSC_TESTNET_RPC_URL || rpc) });
const record = JSON.parse(readFileSync(new URL('../web/round.json', import.meta.url), 'utf8'));
console.log(await verifyReceipts(client, record));
