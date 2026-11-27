import { randomBytes } from 'node:crypto';
import { concatHex, getCreate2Address, keccak256, toHex } from 'viem';
import { portal, tokenImpl } from './network.mjs';

export function mineSalt() {
  const bytecodeHash = keccak256(concatHex([
    '0x3d602d80600a3d3981f3', '0x363d3d373d3d3d363d73', tokenImpl, '0x5af43d82803e903d91602b57fd5bf3'
  ]));
  let nonce = BigInt('0x' + randomBytes(20).toString('hex'));
  while (true) {
    const salt = toHex(nonce++, { size: 32 });
    const predicted = getCreate2Address({ from: portal, salt, bytecodeHash });
    if (predicted.toLowerCase().endsWith('7777')) return { salt, predicted };
  }
}
