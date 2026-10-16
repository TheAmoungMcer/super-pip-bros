# Super Pip Bros. — Design

Date: 2026-10-15
Status: awaiting user review

## Intent

A browser platformer that plays like Super Mario Bros. 3 — same feature set, same
NES look and retro feel — where you clear worlds of levels to rescue a princess.
It lives in a public GitHub repo and is played from a GitHub Pages link so the
user's friend can play it, alone or together online.

**What the user said:** SMB3-like with all features on par; complete levels to
rescue the princess; same type of graphics and retro vibe; GitHub repo shared with
a friend; online co-op; two players with separate cameras; approach A (plain JS
modules); title "Super Pip Bros."

**Decided with the user:** original characters, names, art and music (no Nintendo
assets or names), so the repo can be public without takedown risk. SMB3 gameplay
mechanics are reproduced faithfully.

**Success criteria**
- Movement feels like SMB3: run/P-meter, variable jump, skid, tail flight, slopes.
- Every SMB3 feature category has an equivalent (see Content).
- Two people on two computers can play the whole game together via a room code.
- Every level is proven beatable by an automated autopilot.
- Each build stage is playable from the GitHub Pages URL.

## Cast

| Role | Name | Look |
|---|---|---|
| Player 1 | Pip | red cap, blue overalls, round nose, stubby NES proportions |
| Player 2 | Pep | green cap, same build, slightly taller |
| Princess | Princess Lumi of the Petal Kingdom | pink-and-white, flower crown |
| Final boss | King Grimjaw | horned crocodile-dragon, spiked shell-cape |
| Airship bosses | 7 Grimlings | Grimjaw's kids, one per world, each with a distinct attack |
| Fortress mini-boss | Bone Brute | armoured brawler, spins and leaps, 3 stomps |
| Map helper | Gift Hut keeper "Nana Moss" | gives items in Gift Huts |

## Content

### Power-ups (SMB3 equivalent in brackets)
- **Berry** — grow big [Super Mushroom]
- **Fire Blossom** — fireballs [Fire Flower]
- **Glide Leaf** — squirrel tail: tail-spin attack, slow-fall, P-meter flight [Super Leaf]
- **Stone Cloak** — as Leaf, plus down+B becomes an invincible statue [Tanooki Suit]
- **Frog Suit** — fast swimming, high hops on land [Frog Suit]
- **Hammer Helm** — throws arcing hammers, duck blocks fire [Hammer Suit]
- **Star** — temporary invincibility [Starman]
- **Star Wings** — unlimited flight for one level [P-Wing]
- **Hop Boot** — rideable spring boot, stomps anything (World 5 level only) [Kuribo's Shoe]
- **1-Up Berry**, coins (100 = life)

Damage ladder: special suit → big → small → death (same as SMB3).

### Inventory (28 slots, used on the world map)
Berry, Fire Blossom, Glide Leaf, Stone Cloak, Frog Suit, Hammer Helm, Star,
Star Wings, **Warp Flute** (warp zone between worlds), **Map Hammer** (break map
rocks / open shortcuts), **Skip Cloud** (skip one level), **Anchor** (stop airship
fleeing), **Music Box** (puts map Hammer Kobolds to sleep).

### Enemies (role → SMB3 counterpart)
Stage 1 set (12): Chompkin [Goomba], Para-Chompkin [Paragoomba], Shellback green/red
[Koopa], Winged Shellback [Paratroopa], Snapvine / Fire Snapvine [Piranha / Venus
Fire Trap], Boom Bolt + Bolt Cannon [Bullet Bill + Blaster], Spikebug [Spiny],
Bumble Beetle [Buzzy Beetle], Bone Shell [Dry Bones], Ember [Podoboo], Rotodisc
[Roto-Disc].
Later stages add ~30 more: Crusher [Thwomp], Hush [Boo], Hammer Kobold / Boomer
Kobold / Fire Kobold / Sledge Kobold [Hammer Bros family], Chain Snarl [Chain
Chomp], Puffer / Leaping Puffer / Big Bertha-style Gulper [Cheep Cheeps, Boss Bass],
Cloud Imp + Spikebug eggs [Lakitu], Angry Sun, Sand Twister [Fire Snake], Pokey
cactus, Spring Shellback, Jelly [Blooper], Ice Bros, Giant variants (World 4),
Stretch ghost, Rocky Mole [Rocky Wrench], Bob-omb-style Fuse Walker, Cannon
Shellback ships' turrets, Donut lifts, Lava Lotus, Ptooie-style ball plant,
Muncher-style Biters, Fire Chomp, Thwomp-style Spikes walls, Nipper plants.

### World structure
Each world: a world map (paths, locks, bridges, rocks, pipes between map areas,
wandering Hammer Kobolds, Gift Huts, a Spade bonus panel, a fortress whose clear
opens a lock), ~8–10 levels, and an airship finale against a Grimling. Clearing a
world shows a letter from Lumi (per SMB3) and gives a reward item.

| # | World | Theme / signature |
|---|---|---|
| 1 | Meadow Vale | tutorial grass, sky blocks, first fortress & airship |
| 2 | Dune Sea | desert, quicksand, Angry Sun, pyramid |
| 3 | Coral Bay | water levels, Gulper, island map with canoe |
| 4 | Titan Woods | giant blocks & giant enemies |
| 5 | Cloudtop | sky tower split map, Hop Boot level |
| 6 | Frostpeak | ice physics, frozen blocks, three fortresses |
| 7 | Pipe Maze | pipe-network map, Snapvine-only "plant" levels |
| 8 | Dark Land | tank and battleship levels, Grimjaw's castle, rescue Lumi |

### Minigames and map features
- **Gift Hut** — pick 1 of 3 chests for an item.
- **Card Match** (N-Spade) — 18-card memory game, 2 misses allowed.
- **Slot Panel** (Spade) — three-strip slot reel for lives.
- **Goal roulette** — level-end card (Berry / Blossom / Star); 3 cards = 2/3/5 lives.
- **Coin ships / white Gift Huts** — unlocked by coin or no-coin conditions as in SMB3.
- **Warp zone** — reached by Warp Flute or hidden secrets in W1 and W3.
- **Hidden things** — invisible blocks, crouch-on-white-block-to-go-behind-scenery,
  P-switch coin/brick swaps, music blocks, hidden 1-ups, secret pipes.

### Ending
Grimjaw's castle (multi-room, final two-phase boss: fire breath then ground-pound
that breaks the floor) → rescue Princess Lumi → credits roll over a curtain-stage
scene → "Thank you, Pip & Pep!" → new-game+ flag on the save.

## Architecture

Plain ES modules, no framework, no build step. `index.html` loads `src/main.js`.
GitHub Pages serves the repo as-is; locally `bun run dev` starts a static server.
PeerJS (pinned version, from cdnjs) is the only third-party code.

```
index.html
src/
  main.js              boot, scene switcher, fixed 60 Hz step + render
  engine/
    loop.js            fixed-timestep accumulator
    input.js           keyboard + Gamepad API -> 8-bit button mask
    render.js          256x240 offscreen canvas, integer-scaled to window, tile & sprite blit
    sprites.js         decodes text pixel-grid sprites into cached canvases (palette + flips)
    camera.js          SMB3-style scroll (dead zone, vertical lock until flying)
    audio.js           4-voice chip: 2 pulse, triangle, noise; music sequencer + sfx
    palette.js         NES 54-colour palette
  game/
    physics.js         subpixel integer kinematics + tile collision (solids, semi-solid, slopes)
    player.js          player state machine (small/big/suits, run, P-meter, swim, slide, pipes)
    powerups.js        suit rules, item drops, damage ladder
    entities/          one file per enemy family + items, blocks, platforms, projectiles
    level.js           level runtime: tiles, spawn-on-view, block bumps, P-switch, timers
    worldmap.js        map movement, locks, Hammer Kobold wandering, node entry
    inventory.js       28-slot item bar and map-item effects
    minigames.js       Gift Hut, Card Match, Slot Panel, goal roulette
    hud.js             status bar: world, P-meter, score, coins, lives, timer, cards
    save.js            3 localStorage slots, versioned, JSON export/import
    sim.js             pure Game state + step(state, inputs[]) — the networked core
  content/
    sprites/*.js       pixel grids
    levels/w1.js ...   text tile grids + entity lists per world
    maps/w1.js ...     world map grids and node metadata
    music/*.js         note data
  net/
    peer.js            PeerJS wrapper, 4-letter room codes
    protocol.js        message types, snapshot encode/decode, deltas
    host.js / guest.js authority, prediction and reconciliation
tests/                 bun test suites
tools/
  autopilot.js         plays every level; asserts goal reached
  validate-levels.js   static checks: goal exists, no unreachable required blocks
  selftest.js          headless run of everything
```

### Core rule: simulation is separate from presentation
`sim.js` owns all game state as plain data and exposes
`step(state, [p1Buttons, p2Buttons])`. Rendering, audio and networking only read
state or feed inputs. This is what makes the autopilot, the co-op test and the
netcode possible, and it keeps each module testable on its own.

### Physics
SMB3-style subpixel integers (1 pixel = 16 subpixels), fixed 60 Hz:
walk max 1.5 px/f, run max 2.5 px/f, P-speed 3.0 px/f after the 7-segment P-meter
fills (~1.1 s of running on ground); variable jump (held A keeps reduced gravity
while rising), jump height scales with horizontal speed; skid when reversing at
speed; slopes 22.5° and 45° with crouch-sliding; tail-spin flight lasts ~4.25 s
from full P-meter. Exact constants live in `physics.js` and are tuned until the
side-by-side feel matches; tests pin them.

### Camera
Horizontal dead zone; vertical scroll locked to the ground band unless the player
is flying/climbing or the level is a vertical level, as in SMB3. Each browser
renders only its own player's camera.

## Online co-op

- Title screen: **1 Player**, **Host Co-op**, **Join Co-op**. Host shows a 4-letter
  room code (PeerJS id `superpip-XXXX`); guest types it.
- **Host-authoritative.** The host runs `sim.step` for both players. The guest sends
  its button mask every frame (with frame number). The host sends snapshots at
  20 Hz: both players in full, entities within range of either camera, and tile
  change events (broken bricks, used blocks, coins) as an append-only list so
  nothing is lost.
- **Guest prediction.** The guest runs its own player's physics locally with the
  same code, keeps an input history, and on each snapshot rewinds its player to
  the host state and replays unacknowledged inputs. Other entities are interpolated
  100 ms behind.
- **Spawning.** An enemy spawns when its spawn point enters either player's view
  and despawns only when out of both.
- **Co-op rules.** Shared world map, either player moves the marker; inventory per
  player; shared life pool and coins; a dead player floats back next to the partner
  after 3 s; the level fails only if both are dead at once (costs one life); either
  player touching the goal clears the level for both; pausing opens the menu without
  freezing the sim.
- **Disconnect.** Guest returns to title with a message; host continues solo.
- **Saves.** Progress saves on the host's browser; guest's own solo saves are separate.

## Graphics and audio

- Everything is generated from code: text pixel grids decoded into canvases at boot.
- NES palette, 16×16 metatiles, 3 colours + transparency per sprite, 8×8 font.
- SMB3 look: black outlines, striped bushes and hills, bolted blocks, theatre-curtain
  title, status bar at the bottom with P-meter and three card slots.
- Audio chip: 2 pulse (duty 12.5/25/50%), triangle, noise. All music is original
  composition: title, each world map, overworld, underground, water, sky, castle,
  airship, boss, Star, P-switch, ending, plus SFX (jump, stomp, coin, bump, power-up,
  power-down, fireball, tail, pipe, 1-up, death, clear fanfare).

## Errors and edge cases

- Missing gamepad / focus loss → pause (solo) or open menu (co-op).
- PeerJS broker unreachable → message on the title screen; solo still works.
- Corrupt or old-version save → keep the raw data, offer "start new", never crash.
- Tab hidden → solo sim pauses; host keeps simulating so the guest is not stalled.
- Level timer reaching 0 → death, as in SMB3.

## Testing

- `bun test`: physics constants, collision (slopes, semi-solids, ceilings), damage
  ladder, P-meter, inventory, save migration, protocol encode/decode.
- `tools/autopilot.js`: scripted input routes per level played through `sim.step`;
  must reach the goal for every level. Run in CI-style via `bun run selftest`.
- Co-op loopback test: host and guest connected through an in-memory fake transport
  with injected latency (100 ms) and packet jitter; play a level with the autopilot
  driving both players; assert positions converge and tile events match.
- `__runSelfTest()` in the browser: boots every scene and a sample of levels.
- Visual check: headless screenshots (gstack browse) of title, map, a level, HUD.

## Delivery stages

Each stage gets its own implementation plan, is fully playable solo and in co-op,
and is pushed to `TheAmoungMcer/super-pip-bros` and served at
`https://theamoungmcer.github.io/super-pip-bros/`.

1. **Engine + World 1.** Physics, player (small/big/Fire Blossom/Glide Leaf/Star),
   the 12 stage-1 enemies, blocks/pipes/P-switch/music blocks, World 1 map
   (6 levels, fortress + Bone Brute, Gift Hut, Slot Panel, airship + first Grimling),
   inventory, goal roulette, saves, audio, online co-op, GitHub Pages.
2. **Worlds 2–4.** Stone Cloak, Frog Suit, Card Match, water and giant levels,
   desert map features, warp zone, ~15 more enemies.
3. **Worlds 5–8 + ending.** Hammer Helm, Star Wings, Hop Boot, ice, sky tower,
   pipe maze, tanks/battleships, Grimjaw's castle, rescue Lumi, credits.

## Out of scope

- Mobile/touch controls (keyboard and gamepad only).
- More than 2 players; the SMB3 head-to-head battle minigame.
- A level editor.
- Server-side anything: no accounts, no leaderboards.
