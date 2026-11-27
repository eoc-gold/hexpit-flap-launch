# DEXPit SFX

The sound system lives in `Website/src/lib/audio/` (moved from
`playtest/sfx.ts` in AAA-push G9). The full source map + the pairing rationale
is in [`docs/aaa-push/G9-audio-brief.md`](../../../docs/aaa-push/G9-audio-brief.md).
Picks anchor on the user's vetted `assets/sound/Shortlist` + `Shortlist2` sets.
Swap any clip by overwriting the file in place (keep the filename + extension).

The registry is layered to mirror the G7 VFX taxonomy:

- **Flow / UI** - `card-pick`, `card-cancel`, `confirm-target`, `confirm-move`,
  `card-stage`, `move`, `ready`, `draw`, `discard`, `shuffle`, `deploy`,
  `turn-start`, `timer-low`, `error`, `victory`, `defeat`, `hover`.
- **Combat: shared** - `damage` (generic fallback), `heal`, `death`,
  `death-multi`, `fizzle`, `cast-emblem`.
- **Combat: the 3-LAYER taxonomy** (the ONLY combat routing now) - `windup-*`
  (telegraph), `body-{school}-{tier}` (the hit), `sting-{keyword}` (one cue per
  status), `heal-{holy,nature}-{tier}`. SOURCE OF TRUTH: `fx-staging/sfx/`
  (`01-windup` / `02-body` / `03-sting`), flattened into this folder by
  `node tools/scripts/sync-sfx.mjs`. Routed by `windupSfxFor` / `bodyPlanFor` /
  `stingSfxFor` / `healSfxFor` in `audio/combat.ts`. A spell's only "magic" sound
  IS its school body - there is NO generic whoosh layered on top.
- **RETIRED (G16):** the old generic G7 layer (`cast` / `cast-{delivery}`,
  `impact-{school}`, `status-{buff,debuff,empower,...}`) + `castSfxFor` /
  `impactSfxFor` / `statusSfxFor` were removed - they made every spell sound the
  same. Per-status stings replace them.
- **Ambient** - two streamed scenes (`audio/ambient.ts`), own SettingsPanel
  slider. MENU scene starts on `Hell` and chains to `Volcano` if you linger past
  its 10-min length (~20-min A/B loop), in menus + deployment. BATTLE scene
  (`Action1`, the in-game track) crossfades in when the first turn begins and
  loops if a game runs long. 10-min tracks live in `static/ambient/` (gitignored,
  local-only) and stream via `createMediaElementSource` so they never decode to
  RAM. (`ambient-cave.ogg` is the retired single-loop bed.)

## Brand voice

The flow/UI layer + the Physical/Blood/Nature schools stay **gritty, stone,
forge, blood**: weighty thuds, dry whooshes, stone clacks, low resonant bass.
The elemental schools (Fire/Lightning/Holy/Magic/Void) now track the
school-colour VFX language - a Lightning card zaps, a Holy card rings - which is
an intentional divergence from the original "no sparkles" rule (it predates the
school-colour system).

## Format

- OGG Vorbis preferred; WAV / MP3 also play (the `CLIPS` src carries the
  extension per clip, so mixed formats are fine).
- Normalize peaks to about -3 dBFS so overlapping plays don't clip.

## Variant pools (diversity)

A registry key's `src` can be a single file OR an array of variant files. With an
array, the round-robin pool plays a different variant each time, so repeated hits
of the same beat never sound identical (and the variants double as channels). To
add variety to a key, drop more `<key>-N.<ext>` files in here and list them in
`sfx.ts` `CLIPS`. Current multi-variant pools:

- `impact-physical` - 19 melee clips (10 split sword swings from the
  `many_attacks` bundle + 8 loose hits + the original punch).
- `impact-nature` / `impact-void` / `impact-holy` / `impact-magic` /
  `impact-fire` - on-theme school clips plus the original pick.
- `cast-aoe` / `cast-debuff` / `cast-buff` - two variants each.

Source clips for these live in `assets/Sound effects/` (local only, untracked);
`many_attacks.mp3` is the multi-swing bundle, split into
`many_attacks_split/sword_NN.wav`.

## Sources (all free, CC0 preferred)

1. [Kenney.nl](https://kenney.nl/assets?q=audio) - CC0. *Interface Sounds*,
   *Casino Audio*, *RPG Audio*.
2. [Freesound.org](https://freesound.org) - filter license = "Creative
   Commons 0". *stone impact*, *heavy thud*, *dry whoosh*, *body fall*.
3. [OpenGameArt.org](https://opengameart.org) - CC0 / CC-BY, fantasy themed.
4. [Sonniss GDC packs](https://sonniss.com/gameaudiogdc) - free, royalty-free.

## Mute + volume

Sound on/off, SFX volume, and Ambience volume all live on the settings gear in
the HUD; preferences persist via localStorage. The ambient bed follows the
master Sound toggle.

## Missing files are graceful

If a clip's file is absent, its `<audio>` element loads with `error` set and
`playSfx()` skips it silently, so registry keys can be listed ahead of their
assets. Wired moments: the full flow + combat set plus `deploy`, `shuffle`
(MatchHud) and `timer-low`, `hover` (TimerWidget / hover effect). `card-stage`
and `discard` are intentionally NOT wired - they would double the existing
`confirm-target` (staging) and `cast` (a played card lands in discard) beats, so
their keys stay as spare slots rather than fire redundant overlapping clips.
