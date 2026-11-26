# HackQuest submission copy

**Project** · HexPit | The Founding Packs  
**Team** · Engines of Creation  
**Challenge** · BNB Bangkok 2026 / Flap Track / Build on Pool Launch

**One line** · Each five-card pack funds a game's first stablecoin pool and gives its buyer a claim on a fixed GAME reserve.

**Description** · A card-game player can help open the game's market by doing something familiar: opening a pack. In HexPit, 5 test USD buys five collectible cards. The launcher records the GAME amount before the cards are revealed. Earlier packs earn a larger share, while a lucky draw changes only the cards. The twelfth pack sends the entire 60 USD raise through Flap's Pool Launch Portal. In that transaction, Flap creates GAME and pairs 500,000 GAME with the stablecoins. Another 500,000 GAME funds buyers' claims. If the round misses its deadline, buyers can recover their stablecoins.

**What judges can verify** · A public factory, two launcher instances, 60 ERC-1155 card copies, a seeded GAME/USD pair, the burned LP and a settled GAME claim. The public demonstration used one buyer. A separately recorded fork test splits the reserve between two wallets. Reviewers can browse all twelve real pack receipts without signing in, or mint from the second public round with a testnet wallet.

**What we built for Bangkok** · The BNB-specific launcher and factory, ERC-20 payment path, exact pack allocations, Flap launch and distribution, refunds, judge interface and template-based detail component. HexPit's game, card art and card catalog predate the event. The testnet demo uses block-derived card draws. Live gameplay entitlements and production randomness are future work.

**Reviewer links**

- [Interactive demo](https://eoc-gold.github.io/hexpit-flap-launch/)
- [Source and reproduction instructions](https://github.com/eoc-gold/hexpit-flap-launch)
- [Factory deployment](https://testnet.bscscan.com/tx/0x7cc68050bf75001f1367935490bb59e9802abb99cef7c202438e3c6fe9eb4043)
- [Portal creates the launcher](https://testnet.bscscan.com/tx/0xe0b3e4b74149d4b6225d7804c77ad97411008f45f533e107e2162a1e169c022b)
- [Final mint and pool creation](https://testnet.bscscan.com/tx/0xeaaef28b04d44b211df6736f33141fa0c108a7d39abed5dd21a617aa6da34774)
- [Settled GAME claim](https://testnet.bscscan.com/tx/0x239484d974c6d92f2885704727040c0f403378e6919c8aedb1c3a8d11ae3424e)
- [Judge wallet flow](https://eoc-gold.github.io/hexpit-flap-launch/#wallet)
