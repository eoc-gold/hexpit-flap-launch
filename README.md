# DEXPit Founding Packs | Engines of Creation

A five-card pack is also a contribution to a game's opening market. Players pay **5 faucet USD** and receive five on-chain HexPit cards. Pack twelve sends the entire **60 USD** raise into a Flap Pool Launch pair. The same transaction creates GAME, seeds the pool and funds the outstanding pack claims.

[Open packs](https://eoc-gold.github.io/hexpit-flap-launch/#round) · [Try the closing table](https://eoc-gold.github.io/hexpit-flap-launch/#table) · [Get test USD](https://eoc-gold.github.io/hexpit-flap-launch/#faucet) · [Inspect the final mint](https://testnet.bscscan.com/tx/0xeaaef28b04d44b211df6736f33141fa0c108a7d39abed5dd21a617aa6da34774)

[Watch the 66-second pack-opening film](https://eoc-gold.github.io/hexpit-flap-launch/watch.html)

## From DEXPit to a second studio game

DEXPit is the card game. HexPit is the launcher prototype in this repository. A second Engines of Creation title could start with a character kit or gear bundle. Its designers would define the items and sale rules. Its engineers could adapt the catalog and launcher contract, run the refund and reserve tests, and reuse the factory pattern, Flap distribution callback and receipt interface. The current price, pack count, catalog and chain are fixed in code. A configurable studio-wide product is the next development step.

## Judge walkthrough

1. Open the demo. Press **Open pack** repeatedly to reveal the five cards from each recorded receipt and add its 5 test USD to the funding sidebar. Pack twelve fills the reserve and shows the seeded GAME/USD pool. Use **Replay pack opening** on any receipt for the original seal break and card effects. The fifth slot always draws Rare or better.
2. Choose **View final mint**. The launch produced 1,000,000 GAME. The pool received 500,000 GAME and 60 test USD. The launcher received the remaining 500,000 for pack buyers. All LP units went to the burn address except the pair's 1,000 base units of minimum liquidity at the zero address. [Transaction](https://testnet.bscscan.com/tx/0xeaaef28b04d44b211df6736f33141fa0c108a7d39abed5dd21a617aa6da34774)
3. Inspect the claim. A single test wallet purchased the demonstration round and claimed all 500,000 GAME. The two-wallet fork rehearsal independently reconciles the split between two buyers. [Public claim](https://testnet.bscscan.com/tx/0x239484d974c6d92f2885704727040c0f403378e6919c8aedb1c3a8d11ae3424e) · [Public receipts](web/round.json) · [Fork receipts](web/rehearsal.json)
4. To participate, open [**Test USD faucet**](https://eoc-gold.github.io/hexpit-flap-launch/#faucet) in your wallet browser. Connect and switch to BSC Testnet (chain 97), choose **5**, **15** or **60 test USD**, and confirm **Get test USD**. The [deployed faucet](https://testnet.bscscan.com/token/0x190C989D5665a0e404B444b53CAE9AbCfb600157) mints directly to the connected wallet on either device. You need tBNB for gas. See the [BNB Chain faucet guide](https://docs.bnbchain.org/bnb-smart-chain/developers/faucet/).
5. To mint cards, approve 5 test USD for the launcher and confirm **Open pack**. The public judge round accepts mints until it fills or its seven-day window expires. The test USD faucet remains accessible separately. [Judge round creation](https://testnet.bscscan.com/tx/0x27aed947d0e2d1dd361c150680f6ddbb6cf364edc6147770fdcfff2aac08be55)

At the **closing table**, try pledging the first seat, withdrawing it, then filling both seats. Watch the sidebar distinguish refundable pledges from pool money. The two-wallet replay displays the cards and payouts from an actual BSC testnet fork. Under **Where the mint went**, **Verify receipts on BSC Testnet** independently checks the original public launch using your browser. [Two-wallet receipt record](web/table-fork.json)

The inline pack opening uses the original [DEXPit Ignition particle renderer and rarity effects](https://github.com/eoc-gold/dexpit/tree/3a8703ae53990c84eb5dc787e4452c8a3e0cb1e0/packages/eoc-ignition/public), vendored in `web/ignition`. Click repeatedly to queue the recorded packs. Each reveal adds 5 test USD to the Flap funding sidebar. Confirmed wallet mints use the same effects and show the launcher's onchain progress. The optional cinematic receipt replay uses the [original DEXPit components](https://github.com/eoc-gold/dexpit/tree/3a8703ae53990c84eb5dc787e4452c8a3e0cb1e0/Website/src/lib/components/economy).

## Verified BSC testnet contracts

| Role | Address |
| --- | --- |
| Flap Pool Launch Portal | [0x000042108465206185A077Edc3F3fd2b49060000](https://testnet.bscscan.com/address/0x000042108465206185A077Edc3F3fd2b49060000) |
| Faucet USD, 18 decimals | [0x190C989D5665a0e404B444b53CAE9AbCfb600157](https://testnet.bscscan.com/address/0x190C989D5665a0e404B444b53CAE9AbCfb600157) |
| HexPit Launcher Factory | [0x03580DC9d429d64700822d8816F74ed5B622C1dC](https://testnet.bscscan.com/address/0x03580DC9d429d64700822d8816F74ed5B622C1dC) |
| Completed launcher | [0x36A0Bbf2C9C811bEA852eb8a4431EA47c9DFa925](https://testnet.bscscan.com/address/0x36A0Bbf2C9C811bEA852eb8a4431EA47c9DFa925) |
| GAME | [0xAB13dFaF30c85cA136B9058b0064ad6369F37777](https://testnet.bscscan.com/address/0xAB13dFaF30c85cA136B9058b0064ad6369F37777) |
| GAME/USD pair | [0xFc069ccA09387491FbEef6F0F2C2E01Ac13CB513](https://testnet.bscscan.com/address/0xFc069ccA09387491FbEef6F0F2C2E01Ac13CB513) |
| Interactive judge launcher | [0x690a961Ef6B4421532d9D9ccF51c90407C1000E3](https://testnet.bscscan.com/address/0x690a961Ef6B4421532d9D9ccF51c90407C1000E3) |

## Mechanism

The pack price stays fixed. The twelve GAME allocations carry descending weights from 12 to 1. Cumulative integer arithmetic assigns every unit of the reserve. The wallet binds the quoted minimum so a competing mint cannot silently worsen the buyer's allocation. The 117-card catalog, class identities and slot rarity bands come from the existing HexPit game. The factory, stablecoin sale, Flap distribution, receipt viewer and wallet interactions were built for this entry.

**Closing together.** The declining solo reward gives the last buyer the smallest allocation. A group can instead agree to buy every remaining pack at 5 test USD per seat and share the remaining GAME equally, to within one base unit. After ten solo packs, packs eleven and twelve pay about 12,820.51 and 6,410.26 GAME individually. At a two-seat table they pay about **9,615.38 GAME and five cards per wallet**. The first seat's 5 stays in escrow. The last seat buys both packs and opens the pool in the same transaction. Each wallet claims its own hand and GAME independently. [Closing table contract](src/ClosingTable.sol)

Buyers can withdraw a waiting pledge. If a solo mint changes the agreed pack count or the round expires, anyone can return all waiting pledges at full value. A failed pool launch reverts the closing transaction and earlier pledges remain refundable. Seats are per address. Only the pack allocations in the group's order are shared. [Settlement and refund tests](test/ClosingTable.t.sol)

A final mint that cannot seed the pool reverts atomically. If the round expires below its target, original buyers recover their full stablecoin payment and their GAME allocations clear. Cards from an expired round remain locked test souvenirs. In a successful round, cards become transferable and GAME belongs to the original minting wallet. The submission includes standard packs. The main game does not consume these testnet balances. Testnet card draws use block-derived entropy and can be influenced. Before introducing paid gameplay, the draw needs verifiable, asynchronous randomness.

The launcher uses Flap's explicit distribution strategy. A separate Vault is optional for this track. The demo uses a 1% buy/sell tax for 30 days with the LP fee slot receiving the tax allocation. Developer launch commission is zero. The testnet helper enabled a 100-bps floor multiplier for this factory. A mainnet release requires Flap review, a supported stablecoin and launch sizing against its approved floor.

## Reproduce

Requires Node 24, npm and Foundry. Clone with `--recurse-submodules` or run `git submodule update --init --recursive`. The submodule pins Flap's interfaces and transitive libraries. From the repository root:

```sh
npm ci
forge build
forge test -vv
npm run build
npm run verify:launch
npm run dev
```

The seven Solidity tests fork BSC testnet. Set `BSC_TESTNET_RPC_URL` to choose the provider and optionally `BSC_TESTNET_FORK_BLOCK` to pin an archive-capable provider. `verify:launch` is read-only. It compares twelve card receipts, both pool deposits, the LP burn and the buyer's GAME transfer with the public record.

For a new local rehearsal, start `anvil --fork-url https://bsc-testnet-rpc.publicnode.com --chain-id 97 --host 127.0.0.1 --port 18797 --silent` and run `npm run rehearse` from a clean checkout. This exercises the real Portal, helper and USD faucet on a local copy and records a second round for UI testing at `/?fork=1#wallet`. Keep the same Anvil state to resume a partially completed rehearsal. Archive `runs/fork.json` before starting a new fork. The public deployment runner uses `npm run live` with a dedicated chain-97 signer supplied in the process environment as `HEXPIT_TESTNET_KEY`. It journals submitted hashes and resumes receipt checks. These operations use testnet funds.

To reproduce the closing table, run a separate local fork:

```sh
anvil --fork-url https://bsc-testnet-rpc.publicnode.com --chain-id 97 --port 18972 --silent
# In another terminal after forge build
npm run table:rehearse
npm run dev
```

The rehearsal creates a round from the published factory, opens ten solo packs, fills two seats with separate test wallets, verifies both claims and writes `web/table-fork.json`. The local site at `/?fork=table#wallet` enables table wallet actions on this fork. Select the local RPC in your wallet to transact there. The published site labels the replay with the network on which its receipt was produced.

The three-file [Flap detail component](flap-ui/) follows the workshop's generic `launcher-detail/v1` template, bound to this factory. The public site handles bounded ERC-20 approvals and minting. Flap Workbench registration is a separate publication step. [Submission copy](docs/SUBMISSION.md) · [Sources and decisions](docs/RESEARCH.md)
