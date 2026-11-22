// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (follow the level's safe path, wait crouched when the next
// step would be seen, fall back when suspicion climbs), so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { GUARD } from './config.js';
import { STEP } from './world.js';
import { canSee } from './vision.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const ALERT_LIMIT_SECONDS = 40;
const WIN_LIMIT_SECONDS = 300;

/** Does any guard see the player if they stand at (x, y), sneaking or not? */
function wouldBeSeen(world, x, y, sneaking) {
  const state = world.state;
  for (const guard of state.guards) {
    if (
      canSee(guard, x, y, state.level.walls, {
        range: GUARD.sightRange,
        halfAngle: GUARD.sightHalfAngle,
        sneaking,
        bushSpotRange: GUARD.bushSpotRange,
      })
    ) return true;
  }
  return false;
}

/**
 * One autopilot decision: follow the level's path, wait when the next step is
 * watched, and fall back to the previous waypoint while suspicion is high.
 */
function autopilot(world, pathState) {
  const state = world.state;
  const path = state.level.path;
  const waypoint = path[pathState.index];
  if (!waypoint) return { x: 0, y: 0, sneak: true };
  const dx = waypoint.x - state.player.x;
  const dy = waypoint.y - state.player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 14) {
    pathState.index += 1;
    return { x: 0, y: 0, sneak: true };
  }
  const suspicion = world.maxSuspicion();
  // Standing where a guard can already see you is never a plan: fall back to
  // the previous waypoint (a safer spot) until the guards calm down.
  if (suspicion > 0.25 && wouldBeSeen(world, state.player.x, state.player.y, waypoint.sneak)) {
    const retreat = path[Math.max(0, pathState.index - 1)];
    const rx = retreat.x - state.player.x;
    const ry = retreat.y - state.player.y;
    const rDistance = Math.hypot(rx, ry);
    if (rDistance > 10) return { x: rx / rDistance, y: ry / rDistance, sneak: true };
    return { x: 0, y: 0, sneak: true };
  }
  const step = 8;
  const nextX = state.player.x + (dx / distance) * step;
  const nextY = state.player.y + (dy / distance) * step;
  if (wouldBeSeen(world, nextX, nextY, waypoint.sneak)) {
    return { x: 0, y: 0, sneak: true };
  }
  return { x: dx / distance, y: dy / distance, sneak: waypoint.sneak };
}

function runAutopilot(world, seconds, stopOnStatus) {
  const pathState = { index: 0 };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const move = autopilot(world, pathState);
    world.step(STEP, { x: move.x, y: move.y }, move.sneak, null);
    if (stopOnStatus && world.state.status !== 'playing') break;
  }
  return world.state.status;
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is
 * start) and return the screen to draw over it and the best run to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    world.jumpToLevel(1);
    runAutopilot(world, PLAY_SECONDS, false);
    return { screen: SCREEN_PLAY, best: null };
  }
  if (name === 'alert') {
    world.reset();
    // Stand in the open on the first warden's patrol line and wait to be found.
    world.state.player.x = 630;
    world.state.player.y = 130;
    const steps = Math.floor(ALERT_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
      if (world.state.status === 'caught') break;
    }
    return { screen: world.state.status === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: null };
  }
  if (name === 'win') {
    // A full run: the autopilot plays all three halls in order, so the victory
    // screen shows the real totals of a real run, not one hall's.
    world.reset();
    let status = 'playing';
    for (let level = 0; level < 3 && status !== 'victory'; level += 1) {
      status = runAutopilot(world, WIN_LIMIT_SECONDS, true);
      if (status === 'clear') {
        world.advance();
        status = 'playing';
        continue;
      }
      if (status === 'victory') break;
      // One more attempt at this hall, all-sneak: slower, far harder to spot.
      world.retry();
      status = runAutopilot(world, WIN_LIMIT_SECONDS, true);
      if (status === 'clear') {
        world.advance();
        status = 'playing';
      }
    }
    if (status === 'victory') {
      return {
        screen: SCREEN_VICTORY,
        best: {
          shards: world.state.shardsCollected,
          total: world.state.shardsTotal,
          time: `${Math.floor(world.state.time / 60)}:${String(Math.floor(world.state.time % 60)).padStart(2, '0')}`,
          alerts: world.state.alerts,
        },
      };
    }
    // No staged victory: if the autopilot could not win for real, the shot
    // shows the game in play instead of a faked end screen.
    return { screen: SCREEN_PLAY, best: null };
  }
  world.reset();
  const steps = Math.floor(START_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, { x: 0, y: 0 }, false, null);
  return { screen: SCREEN_TITLE, best: null };
}
