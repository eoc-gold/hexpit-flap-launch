# HackQuest submission copy

**Project** · DEXPit Founding Packs

**Team** · Engines of Creation

**Challenge** · BNB Bangkok 2026 / Flap Track / Build on Pool Launch

**One line** · Open a five-card pack solo, or take a refundable seat with other players to fill the last packs together, split their GAME and open the game's first stablecoin pool.

**Description** · A card-game player can help open the game's market by doing something familiar: opening a pack. In HexPit, 5 test USD buys five collectible cards. The launcher records the GAME amount before the cards are revealed. Earlier packs earn a larger share, while a lucky draw changes only the cards. The twelfth pack sends the entire 60 USD raise through Flap's Pool Launch Portal. In that transaction, Flap creates GAME and pairs 500,000 GAME with the stablecoins. Another 500,000 GAME funds buyers' claims. If the round misses its deadline, buyers can recover their stablecoins.

**Why close together** · The solo schedule gives the last pack one twelfth of the first pack's GAME. Players willing to finish a round together can pledge one pack each. Once the table fills, the launcher buys all remaining packs atomically. Each participant gets five cards and an equal share of that order's GAME, to within one base unit. A player may leave while waiting. If a solo mint changes the quote, anyone can return all waiting pledges. This lets a guild coordinate a launch without asking one player to front its members' money.

**What judges can verify** · A public factory, two launcher instances, 60 ERC-1155 card copies, a seeded GAME/USD pair, the burned LP and a settled GAME claim. The public demonstration used one buyer. A separate two-wallet rehearsal on a BSC testnet fork shows pack eleven and twelve each returning about 9,615.38 GAME through the closing table. Both wallets claimed their hands independently. Reviewers can replay both flows without signing in and independently verify the original public receipts from the site. The wallet and faucet also support the second public round.

**What we built for Bangkok** · The BNB-specific launcher and factory, ERC-20 payment path, exact pack allocations, Flap launch and distribution, refunds, judge interface and template-based detail component. HexPit's game, card art and card catalog predate the event. The testnet demo uses block-derived card draws. Live gameplay entitlements and production randomness are future work.

**Market test** · The demonstrated flows used team-controlled wallets. The next question is whether independent players coordinate the final seats. With player groups, measure the share of rounds that fill, the time from the first pledge to launch or refund, and the number of distinct participating wallets. A second studio title could reuse the Flap settlement path with its own catalog.

**Reviewer links**

- [Try the two-wallet closing table](https://eoc-gold.github.io/hexpit-flap-launch/#table)
- [Verify public receipts](https://eoc-gold.github.io/hexpit-flap-launch/#evidence)
- [Watch the narrated demo](https://eoc-gold.github.io/hexpit-flap-launch/watch.html)

- [Interactive demo](https://eoc-gold.github.io/hexpit-flap-launch/)
- [Source and reproduction instructions](https://github.com/eoc-gold/hexpit-flap-launch)
- [Factory deployment](https://testnet.bscscan.com/tx/0x7cc68050bf75001f1367935490bb59e9802abb99cef7c202438e3c6fe9eb4043)
- [Portal creates the launcher](https://testnet.bscscan.com/tx/0xe0b3e4b74149d4b6225d7804c77ad97411008f45f533e107e2162a1e169c022b)
- [Final mint and pool creation](https://testnet.bscscan.com/tx/0xeaaef28b04d44b211df6736f33141fa0c108a7d39abed5dd21a617aa6da34774)
- [Settled GAME claim](https://testnet.bscscan.com/tx/0x239484d974c6d92f2885704727040c0f403378e6919c8aedb1c3a8d11ae3424e)
- [Judge wallet flow](https://eoc-gold.github.io/hexpit-flap-launch/#wallet)
