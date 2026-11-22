// The simulation: one player, patrolling guards with suspicion, noise that
// draws guards in, shards to steal, and an exit arch. Everything runs in fixed
// 1/60 s steps. The world knows nothing about drawing or sound; it reports
// what happened as event flags and the renderer and audio answer them.

import { FIELD, GUARD, PEBBLES_PER_LEVEL, PEBBLE_NOISE, PEBBLE_RANGE, PLAYER, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { canSee } from './vision.js';

export const EVENT_PICKUP = 1;
export const EVENT_NOTICED = 2;
export const EVENT_ALARM = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_CLEAR = 16;
export const EVENT_VICTORY = 32;
export const EVENT_PEBBLE = 64;

const GUARD_RADIUS = 13;

/** True when the point is inside any wall (with a margin for a circle). */
function blockedAt(x, y, radius, walls) {
  if (x < radius || x > FIELD.width - radius || y < radius || y > FIELD.height - radius) return true;
  for (const wall of walls) {
    if (
      x > wall.x - radius && x < wall.x + wall.w + radius &&
      y > wall.y - radius && y < wall.y + wall.h + radius
    ) return true;
  }
  return false;
}

/** Move a circle one step, sliding along walls axis by axis. */
function moveCircle(body, dx, dy, radius, walls) {
  const nextX = body.x + dx;
  if (!blockedAt(nextX, body.y, radius, walls)) body.x = nextX;
  const nextY = body.y + dy;
  if (!blockedAt(body.x, nextY, radius, walls)) body.y = nextY;
}

function inBush(x, y, bushes) {
  for (const bush of bushes) {
    if (Math.hypot(x - bush.x, y - bush.y) < bush.r * 0.85) return true;
  }
  return false;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, facing: 0, sneaking: false, moving: false },
    guards: [],
    shards: [],
    pebbles: PEBBLES_PER_LEVEL,
    pebbleFlights: [],
    noiseRings: [],
    status: 'playing',
    time: 0,
    shardsCollected: 0,
    shardsAtEntry: 0,
    shardsTotal: 0,
    alerts: 0,
    noiseTimer: 0,
    stepTimer: 0,
  };

  function loadLevel(index, fresh = true) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    // Retrying a hall rewinds the shards stolen in it: the count returns to
    // what it was when the hall was entered.
    if (fresh) state.shardsAtEntry = state.shardsCollected;
    else state.shardsCollected = state.shardsAtEntry;
    state.player.x = level.player.x;
    state.player.y = level.player.y;
    state.player.facing = 0;
    state.player.sneaking = false;
    state.player.moving = false;
    state.guards = level.guards.map((definition) => {
      const [x, y] = definition.waypoints[0];
      const [nx, ny] = definition.waypoints[1];
      return {
        definition,
        x,
        y,
        facing: Math.atan2(ny - y, nx - x),
        waypointIndex: 1,
        pauseTimer: 0,
        scanBase: Math.atan2(ny - y, nx - x),
        scanTime: 0,
        mode: 'patrol',
        suspicion: 0,
        lastSeen: { x, y },
        unseenFor: 0,
        investigateTarget: null,
        lookTimer: 0,
        speed: definition.speed,
        pause: definition.pause,
      };
    });
    state.shards = level.shards.map((shard) => ({ ...shard, taken: false }));
    state.pebbles = PEBBLES_PER_LEVEL;
    state.pebbleFlights = [];
    state.noiseRings = [];
    state.status = 'playing';
  }

  function hearNoise(x, y, radius) {
    for (const guard of state.guards) {
      if (guard.mode === 'chase') continue;
      if (Math.hypot(guard.x - x, guard.y - y) > radius) continue;
      guard.mode = 'investigate';
      guard.investigateTarget = { x, y };
      guard.suspicion = Math.max(guard.suspicion, 0.3);
    }
  }

  function throwPebble(targetX, targetY) {
    if (state.pebbles <= 0 || state.status !== 'playing') return false;
    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > PEBBLE_RANGE || distance < 20) return false;
    if (blockedAt(targetX, targetY, 4, state.level.walls)) return false;
    state.pebbles -= 1;
    state.pebbleFlights.push({
      fromX: state.player.x,
      fromY: state.player.y,
      x: state.player.x,
      y: state.player.y,
      targetX,
      targetY,
      age: 0,
      duration: 0.32,
    });
    return true;
  }

  function updateGuard(guard, dt, events) {
    const level = state.level;
    const player = state.player;
    const hidden = inBush(player.x, player.y, level.bushes);
    const seen = canSee(guard, player.x, player.y, level.walls, {
      range: GUARD.sightRange,
      halfAngle: GUARD.sightHalfAngle,
      sneaking: player.sneaking,
      bushSpotRange: GUARD.bushSpotRange,
    });

    if (seen) {
      const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
      const closeness = 1 - Math.min(1, distance / GUARD.sightRange);
      let rate = GUARD.suspicionFar + (GUARD.suspicionNear - GUARD.suspicionFar) * closeness;
      if (player.sneaking) rate *= 0.5;
      if (hidden) rate *= 0.4;
      const before = guard.suspicion;
      guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      guard.unseenFor = 0;
      if (before < GUARD.suspiciousAt && guard.suspicion >= GUARD.suspiciousAt && guard.mode !== 'chase') {
        events.value |= EVENT_NOTICED;
      }
      if (guard.suspicion >= GUARD.alarmAt && guard.mode !== 'chase') {
        guard.mode = 'chase';
        state.alerts += 1;
        events.value |= EVENT_ALARM;
      }
    } else {
      guard.unseenFor += dt;
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
      if (guard.mode === 'suspicious' && guard.suspicion < 0.15) guard.mode = 'patrol';
      if (guard.mode === 'chase' && guard.unseenFor > GUARD.giveUpAfter) {
        guard.mode = 'return';
        guard.suspicion = Math.min(guard.suspicion, 0.3);
      }
    }

    if (guard.mode === 'patrol') {
      const target = guard.definition.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.scanTime += dt;
        guard.facing = guard.scanBase + Math.sin(guard.scanTime * 1.4) * 0.55;
      } else {
        const dx = target[0] - guard.x;
        const dy = target[1] - guard.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.definition.waypoints.length;
          guard.pauseTimer = guard.pause;
          const next = guard.definition.waypoints[guard.waypointIndex];
          guard.scanBase = Math.atan2(next[1] - guard.y, next[0] - guard.x);
          guard.scanTime = 0;
        } else {
          guard.facing = Math.atan2(dy, dx);
          moveCircle(guard, (dx / distance) * guard.speed * dt, (dy / distance) * guard.speed * dt, GUARD_RADIUS, level.walls);
        }
      }
    } else if (guard.mode === 'suspicious') {
      guard.facing = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      const dx = guard.lastSeen.x - guard.x;
      const dy = guard.lastSeen.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 60) {
        moveCircle(guard, (dx / distance) * GUARD.suspiciousSpeed * dt, (dy / distance) * GUARD.suspiciousSpeed * dt, GUARD_RADIUS, level.walls);
      }
    } else if (guard.mode === 'chase') {
      guard.facing = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      const dx = guard.lastSeen.x - guard.x;
      const dy = guard.lastSeen.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 4) {
        moveCircle(guard, (dx / distance) * GUARD.chaseSpeed * dt, (dy / distance) * GUARD.chaseSpeed * dt, GUARD_RADIUS, level.walls);
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchRange) {
        state.status = 'caught';
        events.value |= EVENT_CAUGHT;
      }
    } else if (guard.mode === 'investigate') {
      const target = guard.investigateTarget;
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 10) {
        guard.facing = Math.atan2(dy, dx);
        moveCircle(guard, (dx / distance) * GUARD.suspiciousSpeed * dt, (dy / distance) * GUARD.suspiciousSpeed * dt, GUARD_RADIUS, level.walls);
      } else {
        guard.lookTimer += dt;
        guard.scanTime += dt;
        guard.facing = guard.scanBase + Math.sin(guard.scanTime * 1.8) * 0.9;
        if (guard.lookTimer > GUARD.investigateTime) {
          guard.lookTimer = 0;
          guard.mode = 'return';
        }
      }
    } else if (guard.mode === 'return') {
      const target = guard.definition.waypoints[guard.waypointIndex];
      const dx = target[0] - guard.x;
      const dy = target[1] - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) {
        guard.mode = 'patrol';
        guard.pauseTimer = guard.pause;
      } else {
        guard.facing = Math.atan2(dy, dx);
        moveCircle(guard, (dx / distance) * guard.speed * dt, (dy / distance) * guard.speed * dt, GUARD_RADIUS, level.walls);
      }
    }

    // A guard that just noticed something stops to stare at it.
    if (guard.mode === 'patrol' && guard.suspicion >= GUARD.suspiciousAt && guard.suspicion < GUARD.alarmAt) {
      guard.mode = 'suspicious';
    }
  }

  loadLevel(0);
  state.shardsTotal = LEVELS.reduce((sum, level) => sum + level.shards.length, 0);

  return {
    state,
    /** Back to the first level, a fresh run. */
    reset() {
      state.time = 0;
      state.shardsCollected = 0;
      state.alerts = 0;
      loadLevel(0);
    },
    /** Retry the current level after being caught. */
    retry() {
      loadLevel(state.levelIndex, false);
    },
    /** Jump to a level fresh (used by the screenshot scenes). */
    jumpToLevel(index) {
      loadLevel(index);
    },
    /** Move on after clearing a level; the last level ends the game. */
    advance() {
      if (state.status === 'clear') loadLevel(state.levelIndex + 1);
    },
    /** Highest suspicion among the guards, for the HUD meter. */
    maxSuspicion() {
      return state.guards.reduce((max, guard) => Math.max(max, guard.suspicion), 0);
    },
    /** True when the player is hidden inside a bush right now. */
    playerHidden() {
      return inBush(state.player.x, state.player.y, state.level.bushes);
    },
    /**
     * Advance the world one fixed step. `move` is a normalised direction (or
     * zero), `sneak` is the held sneak key, and `click` is a canvas click in
     * field coordinates (or null). Returns the event flags for this step.
     */
    step(dt, move, sneak, click) {
      const events = { value: 0 };
      if (state.status !== 'playing') return 0;
      state.time += dt;
      const player = state.player;
      const level = state.level;

      if (click) {
        if (throwPebble(click.x, click.y)) events.value |= EVENT_PEBBLE;
      }

      player.sneaking = sneak;
      player.moving = move.x !== 0 || move.y !== 0;
      const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      if (player.moving) {
        player.facing = Math.atan2(move.y, move.x);
        moveCircle(player, move.x * speed * dt, move.y * speed * dt, PLAYER.radius, level.walls);
        if (!sneak) {
          state.noiseTimer += dt;
          if (state.noiseTimer >= PLAYER.noiseInterval) {
            state.noiseTimer = 0;
            state.noiseRings.push({ x: player.x, y: player.y, age: 0, maxR: PLAYER.noiseRadius });
            hearNoise(player.x, player.y, PLAYER.noiseRadius);
          }
        }
      } else {
        state.noiseTimer = 0;
      }

      for (const flight of state.pebbleFlights) {
        flight.age += dt;
        const t = Math.min(1, flight.age / flight.duration);
        flight.x = flight.fromX + (flight.targetX - flight.fromX) * t;
        flight.y = flight.fromY + (flight.targetY - flight.fromY) * t;
      }
      const landed = state.pebbleFlights.filter((flight) => flight.age >= flight.duration);
      state.pebbleFlights = state.pebbleFlights.filter((flight) => flight.age < flight.duration);
      for (const flight of landed) {
        state.noiseRings.push({ x: flight.targetX, y: flight.targetY, age: 0, maxR: PEBBLE_NOISE });
        hearNoise(flight.targetX, flight.targetY, PEBBLE_NOISE);
      }
      for (const ring of state.noiseRings) ring.age += dt;
      state.noiseRings = state.noiseRings.filter((ring) => ring.age < 0.6);

      for (const shard of state.shards) {
        if (!shard.taken && Math.hypot(shard.x - player.x, shard.y - player.y) < 28) {
          shard.taken = true;
          state.shardsCollected += 1;
          events.value |= EVENT_PICKUP;
        }
      }

      for (const guard of state.guards) {
        updateGuard(guard, dt, events);
        if (state.status === 'caught') break;
      }

      if (state.status === 'playing') {
        const exit = level.exit;
        if (
          player.x > exit.x && player.x < exit.x + exit.w &&
          player.y > exit.y && player.y < exit.y + exit.h
        ) {
          if (state.levelIndex === LEVELS.length - 1) {
            state.status = 'victory';
            events.value |= EVENT_VICTORY;
          } else {
            state.status = 'clear';
            events.value |= EVENT_CLEAR;
          }
        }
      }
      return events.value;
    },
  };
}

// Re-exported for the autopilot and tests: one fixed step, in seconds.
export { STEP };
