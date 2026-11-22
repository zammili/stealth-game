// Everything the player sees, painted on one canvas: the stone floor, walls and
// hedges, bushes, the glowing exit arch, shards, each guard's vision cone (cut
// by cover with the same raycast the rules use), the guards and the thief, the
// noise rings, the HUD, and the title / clear / caught / victory screens.
// The canvas is a fixed 1280x720 logical area scaled to the window.

import { FIELD, PALETTE, FONT, GUARD } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_VICTORY = 'victory';

const TILE = 80;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
  }

  function transform() {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    return { scale, offsetX, offsetY };
  }

  /** Convert a canvas pixel (CSS pixels, as pointer events report) to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    const { scale, offsetX, offsetY } = transform();
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function drawFloor(time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let y = 0; y < FIELD.height; y += TILE) {
      for (let x = 0; x < FIELD.width; x += TILE) {
        ctx.fillStyle = (x / TILE + y / TILE) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // A faint moonbeam drifting across the floor, so the dark is never flat.
    const beam = ctx.createLinearGradient(0, 0, FIELD.width, FIELD.height);
    beam.addColorStop(0, 'rgba(140, 170, 255, 0.05)');
    beam.addColorStop(0.5, 'rgba(140, 170, 255, 0)');
    beam.addColorStop(1, 'rgba(140, 170, 255, 0.04)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    void time;
  }

  function drawWalls(walls) {
    for (const wall of walls) {
      ctx.fillStyle = PALETTE.wallSide;
      ctx.fillRect(wall.x, wall.y + 6, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
      // Hedge tufts along the top edge, so cover reads as cover at a glance.
      ctx.fillStyle = PALETTE.bushLight;
      for (let x = wall.x + 10; x < wall.x + wall.w - 6; x += 22) {
        ctx.beginPath();
        ctx.arc(x, wall.y + 8, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBushes(bushes, time) {
    for (const bush of bushes) {
      ctx.fillStyle = PALETTE.bushDark;
      ctx.beginPath();
      ctx.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(bush.x - bush.r * 0.25, bush.y - bush.r * 0.2, bush.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushLight;
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + time * 0.1;
        ctx.beginPath();
        ctx.arc(
          bush.x + Math.cos(angle) * bush.r * 0.45,
          bush.y + Math.sin(angle) * bush.r * 0.45,
          bush.r * 0.28,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  function drawExit(exit, time) {
    const glow = 0.55 + Math.sin(time * 2.2) * 0.15;
    const gradient = ctx.createRadialGradient(
      exit.x + exit.w / 2, exit.y + exit.h / 2, 6,
      exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w,
    );
    gradient.addColorStop(0, `rgba(143, 227, 255, ${glow})`);
    gradient.addColorStop(1, 'rgba(143, 227, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(exit.x - exit.w, exit.y - exit.h, exit.w * 3, exit.h * 3);
    ctx.fillStyle = PALETTE.exitDoor;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = PALETTE.exitGlow;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x + 2, exit.y + 2, exit.w - 4, exit.h - 4);
    ctx.beginPath();
    ctx.arc(exit.x + exit.w / 2, exit.y + exit.h / 2, 12 + Math.sin(time * 2.2) * 2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h + 18);
  }

  function drawShards(shards, time) {
    for (const shard of shards) {
      if (shard.taken) continue;
      const bob = Math.sin(time * 3 + shard.x) * 3;
      const glow = ctx.createRadialGradient(shard.x, shard.y + bob, 2, shard.x, shard.y + bob, 34);
      glow.addColorStop(0, 'rgba(255, 215, 106, 0.5)');
      glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(shard.x, shard.y + bob, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(shard.x, shard.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = PALETTE.shardCore;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  function drawCones(guards, walls) {
    for (const guard of guards) {
      const alerted = guard.mode === 'chase' || guard.mode === 'suspicious';
      const range = GUARD.sightRange * (guard.mode === 'chase' ? 1.1 : 1);
      const points = conePolygon(guard, range, GUARD.sightHalfAngle, walls);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fillStyle = alerted ? PALETTE.coneAlert : PALETTE.cone;
      ctx.fill();
      ctx.strokeStyle = alerted ? PALETTE.coneAlertEdge : PALETTE.coneEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawGuard(guard, time) {
    const alerted = guard.mode === 'chase';
    const suspicious = guard.mode === 'suspicious' || guard.mode === 'investigate';
    // Lantern light pooling around the guard's feet.
    const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 52);
    glow.addColorStop(0, alerted ? 'rgba(255, 91, 77, 0.35)' : 'rgba(255, 196, 66, 0.28)');
    glow.addColorStop(1, 'rgba(255, 196, 66, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 52, 0, Math.PI * 2);
    ctx.fill();
    // Body: a warden in a long coat, facing where it looks.
    ctx.fillStyle = PALETTE.guardCoat;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6, 8, 0, Math.PI * 2);
    ctx.fill();
    // Lantern swinging at the guard's side.
    const swing = Math.sin(time * 2 + guard.x) * 3;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(guard.x - Math.sin(guard.facing) * 16, guard.y + Math.cos(guard.facing) * 16 + swing, 4, 0, Math.PI * 2);
    ctx.fill();
    if (alerted) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `900 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 24);
    } else if (suspicious || guard.suspicion >= GUARD.suspiciousAt) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = `900 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 24);
    }
  }

  function drawPlayer(player, hidden, time) {
    const crouch = player.sneaking ? 0.8 : 1;
    ctx.save();
    if (hidden) ctx.globalAlpha = 0.55;
    // Soft shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 10, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13 * crouch + 2, 0, Math.PI * 2);
    ctx.fill();
    // Hood and face, turned where the thief looks.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.facing) * 4, player.y + Math.sin(player.facing) * 4, 7, 0, Math.PI * 2);
    ctx.fill();
    // Moth wings: two pale arcs that flutter while moving.
    const flutter = player.moving ? Math.sin(time * 18) * 3 : Math.sin(time * 3) * 1;
    ctx.strokeStyle = 'rgba(232, 228, 216, 0.85)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        player.x - Math.cos(player.facing) * 8,
        player.y - Math.sin(player.facing) * 8 + side * 8,
        6 + flutter,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNoiseRings(rings) {
    for (const ring of rings) {
      const t = ring.age / 0.6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.maxR * t, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPebbles(flights) {
    for (const flight of flights) {
      ctx.fillStyle = '#cfd6e4';
      ctx.beginPath();
      ctx.arc(flight.x, flight.y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, maxSuspicion, hidden) {
    const level = state.level;
    const taken = state.shards.filter((shard) => shard.taken).length;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${state.levelIndex + 1}. ${level.name}`, 18, 32);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = PALETTE.shard;
    ctx.fillText(`◆ ${taken}/${level.shards.length} shards`, 330, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`◉ ${state.pebbles} pebbles (click to throw)`, 480, 32);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, 760, 32);
    // Suspicion meter: the loudest guard's suspicion, green to red.
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('SEEN', 850, 32);
    ctx.fillStyle = '#20283a';
    ctx.fillRect(905, 20, 150, 12);
    const hue = maxSuspicion < 0.35 ? PALETTE.calm : maxSuspicion < 1 ? '#ffd76a' : PALETTE.danger;
    ctx.fillStyle = hue;
    ctx.fillRect(905, 20, 150 * Math.min(1, maxSuspicion), 12);
    ctx.strokeStyle = PALETTE.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(905, 20, 150, 12);
    if (hidden) {
      ctx.fillStyle = PALETTE.calm;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText('HIDDEN', 1080, 32);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('Shift sneak · P pause · M mute', FIELD.width - 18, 32);
    ctx.textAlign = 'left';
  }

  function dim() {
    ctx.fillStyle = 'rgba(6, 8, 13, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 14, 22, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function centreText(text, y, font, colour) {
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    // A lighter veil than the other screens, so the hall behind still reads.
    ctx.fillStyle = 'rgba(6, 8, 13, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(240, 120, 800, 420);
    centreText('MOTHLIGHT', 210, `900 64px ${FONT}`, PALETTE.shard);
    centreText('a quiet heist in three halls', 248, `italic 500 20px ${FONT}`, PALETTE.muted);
    centreText('You are Wren, a moth-thief. Steal the moonshards,', 310, `500 19px ${FONT}`, PALETTE.text);
    centreText('slip past the lantern wardens, and reach the glowing arch — unseen.', 340, `500 19px ${FONT}`, PALETTE.text);
    centreText('WASD / arrows — move      Shift — sneak (slow, quiet, hard to see)', 396, `500 17px ${FONT}`, PALETTE.text);
    centreText('Click — throw a pebble to lure a warden      Bushes hide you', 424, `500 17px ${FONT}`, PALETTE.text);
    centreText('Yellow cones are watching. Red means run.', 452, `500 17px ${FONT}`, '#ffd76a');
    centreText('Press Enter or click to begin', 510, `700 20px ${FONT}`, PALETTE.calm);
    if (best) {
      centreText(`Best: ${best.shards}/${best.total} shards in ${best.time} — ${best.alerts} alarms`, 150, `500 15px ${FONT}`, PALETTE.muted);
    }
    void state;
  }

  function drawClear(state) {
    dim();
    panel(340, 220, 600, 220);
    centreText('HALL CLEARED', 290, `900 40px ${FONT}`, PALETTE.calm);
    centreText(`${state.level.name} — ${state.shards.filter((s) => s.taken).length}/${state.shards.length} shards stolen`, 336, `500 18px ${FONT}`, PALETTE.text);
    centreText('Press Enter for the next hall', 392, `700 18px ${FONT}`, PALETTE.text);
  }

  function drawCaught(state) {
    dim();
    panel(340, 200, 600, 260);
    centreText('CAUGHT!', 272, `900 52px ${FONT}`, PALETTE.danger);
    centreText('A lantern found you in the dark.', 326, `500 19px ${FONT}`, PALETTE.text);
    centreText(`${state.level.name} — press Enter to try the hall again`, 362, `500 18px ${FONT}`, PALETTE.muted);
    centreText('Sneak behind cover. Wait for the cone to turn away.', 408, `500 16px ${FONT}`, PALETTE.text);
  }

  function drawVictory(state, best) {
    dim();
    panel(240, 130, 800, 400);
    centreText('THE LAST SHARD IS YOURS', 210, `900 44px ${FONT}`, PALETTE.shard);
    centreText('Three halls, unseen. The moth flies home before dawn.', 258, `italic 500 20px ${FONT}`, PALETTE.muted);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    centreText(`${state.shardsCollected}/${state.shardsTotal} shards  ·  ${minutes}:${String(seconds).padStart(2, '0')}  ·  ${state.alerts} alarms raised`, 322, `500 19px ${FONT}`, PALETTE.text);
    if (best) {
      centreText(`Best run: ${best.shards}/${best.total} shards in ${best.time}`, 360, `500 17px ${FONT}`, PALETTE.muted);
    }
    centreText('Press Enter to steal again', 470, `700 19px ${FONT}`, PALETTE.calm);
  }

  function drawPaused() {
    dim();
    centreText('PAUSED', 330, `900 48px ${FONT}`, PALETTE.text);
    centreText('Press P or Enter to keep sneaking', 380, `500 18px ${FONT}`, PALETTE.muted);
  }

  return {
    resize,
    toField,
    /**
     * Paint one frame. `screen` is one of the SCREEN_* constants; `best` is the
     * saved best run (or null). `time` is seconds since boot, for animation.
     */
    draw(worldState, screen, best, maxSuspicion, hidden, time) {
      resize();
      const { scale, offsetX, offsetY } = transform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawFloor(time);
      drawExit(worldState.level.exit, time);
      drawShards(worldState.shards, time);
      drawCones(worldState.guards, worldState.level.walls);
      drawWalls(worldState.level.walls);
      for (const guard of worldState.guards) drawGuard(guard, time);
      drawPlayer(worldState.player, hidden, time);
      drawBushes(worldState.level.bushes, time);
      drawPebbles(worldState.pebbleFlights);
      drawNoiseRings(worldState.noiseRings);
      if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHud(worldState, maxSuspicion, hidden);
      }
      if (screen === SCREEN_TITLE) drawTitle(worldState, best);
      else if (screen === SCREEN_CLEAR) drawClear(worldState);
      else if (screen === SCREEN_CAUGHT) drawCaught(worldState);
      else if (screen === SCREEN_VICTORY) drawVictory(worldState, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
    },
  };
}
