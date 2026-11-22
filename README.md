# MOTHLIGHT — a quiet heist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/zammili/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/zammili/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

You are **Wren**, a moth-thief. Slip through three lantern-lit halls, steal the
glowing moonshards, and reach the exit arch — unseen.

## How to play

- **WASD / arrow keys** — move
- **Hold Shift** — sneak: slower, quieter, and much harder for wardens to spot
- **Click** — throw a pebble (3 per hall) to lure a warden toward the sound
- **P** — pause · **M** — mute

Running makes noise: the rings give you away, and wardens come to look. Bushes
hide you. A warden's yellow vision cone is cut short by walls and hedges — what
it cannot see, it cannot suspect. When a warden grows suspicious it stops and
stares (`?`); when the meter fills, it raises the alarm (`!`) and chases. Lose
it, wait for the meter to fall, and slip away.

## The halls

1. **Moonlit Garden** — 2 wardens, 3 shards
2. **Lantern Courtyard** — 3 wardens, 4 shards
3. **The Grand Hall** — 4 wardens, 5 shards

## Run it

No build step, no network, no assets to download — plain HTML/CSS/JS:

```sh
node serve.ts   # then open http://localhost:8080
```

Or open `game/index.html` from any static server. Sound is synthesised live
with WebAudio.

## Layout

- `game/src/config.js` — tuning numbers and colours
- `game/src/levels.js` — the three halls (walls, bushes, patrols, shards)
- `game/src/vision.js` — line of sight and vision cones
- `game/src/world.js` — the simulation (player, wardens, suspicion, noise)
- `game/src/render.js` — everything painted on the canvas
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — boot and game loop
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes the dossier)

Built for the [make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759)
best-stealth-game bounty. Original names, art, and sounds throughout.

---
*Entered via [make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759) — referral code `nj55s4jw`.*
