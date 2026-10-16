# Super Pip Bros.

A fan-made, retro platformer in the spirit of the NES classics. Pip and Pep cross the
Petal Kingdom to rescue Princess Lumi from King Grimjaw. All characters, art and music
are original. It plays in any modern browser, alone or with a friend online.

**Play:** https://theamoungmcer.github.io/super-pip-bros/

## Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrow keys | D-pad / left stick |
| Jump (hold for higher) | Z or Space | A / bottom button |
| Run, throw, tail spin, carry shells | X (hold) | B / X / Y |
| Pause / item bar on the map | Enter | Start |

Run with X held until the P-meter fills, then jump: with the Glide Leaf you fly.

## Play together online
1. One player picks **HOST CO-OP** and a save slot. A 4-letter room code appears at the top.
2. The other player picks **JOIN CO-OP**, types the code and presses Enter.
3. You share the world map and lives. In levels each of you has your own camera.
   If one of you falls, you float back in next to your partner.

The friend can join or leave at any time. Progress is saved in the host's browser.

## Run locally
Needs [Bun](https://bun.sh).
    bun run dev        # http://localhost:5190
    bun test           # unit tests
    bun run selftest   # level validation + every level replayed by the autopilot

Dev URLs: `?level=1-1` plays one level, `?gallery` shows every sprite.

## Status
World 1 (Meadow Vale) is complete: 6 levels, a fortress, the airship, Gift Huts and the
Slot Panel. Worlds 2–8 are coming.
