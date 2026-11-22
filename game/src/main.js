// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level clear, caught and victory.
//
// ?seed=N is accepted and ignored: the levels are fixed, so every run of the
// same scene is already deterministic. ?shot=start|play|alert|win stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import {
  EVENT_ALARM,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_NOTICED,
  EVENT_PEBBLE,
  EVENT_PICKUP,
  EVENT_VICTORY,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readBest() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BEST_KEY) ?? 'null');
    if (parsed && typeof parsed.shards === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): the best run then lasts this visit only.
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.maxSuspicion(), world.playerHidden(), 12);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.documentElement.dataset.shotReady = '1';
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let bootTime = 0;
  let stepSoundTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    audio.unlock();
    audio.stopPad();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Sneak past the wardens and reach the glowing arch.');
  }

  function endRun(victory) {
    const run = {
      shards: world.state.shardsCollected,
      total: world.state.shardsTotal,
      time: formatTime(world.state.time),
      alerts: world.state.alerts,
    };
    if (!best || run.shards > best.shards || (run.shards === best.shards && run.time < best.time)) {
      best = run;
      saveBest(best);
    }
    if (victory) {
      screen = SCREEN_VICTORY;
      audio.victory();
      announce(`Victory. ${run.shards} of ${run.total} shards in ${run.time}.`);
    } else {
      screen = SCREEN_CAUGHT;
      audio.caught();
      announce('Caught. Press Enter to try the hall again.');
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_NOTICED) audio.noticed();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_PEBBLE) audio.pebble();
    if (events & EVENT_CAUGHT) endRun(false);
    else if (events & EVENT_VICTORY) endRun(true);
    else if (events & EVENT_CLEAR) {
      screen = SCREEN_CLEAR;
      audio.levelClear();
      announce(`${world.state.level.name} cleared. Press Enter for the next hall.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_VICTORY) startRun();
      else if (screen === SCREEN_CLEAR) {
        world.advance();
        screen = SCREEN_PLAY;
        announce('Playing the next hall.');
      } else if (screen === SCREEN_CAUGHT) {
        world.retry();
        screen = SCREEN_PLAY;
        announce('Trying the hall again.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The halls live behind the title: wardens patrol while the player reads.
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.direction();
    const click = input.takeClick();
    const fieldClick = click ? renderer.toField(click.x, click.y) : null;
    const events = world.step(STEP, move, input.sneaking(), fieldClick);
    if (world.state.player.moving) {
      stepSoundTimer += STEP;
      const interval = input.sneaking() ? 0.55 : 0.34;
      if (stepSoundTimer >= interval) {
        stepSoundTimer = 0;
        audio.footstep(input.sneaking());
      }
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    bootTime += delta;
    accumulator += delta;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best, world.maxSuspicion(), world.playerHidden(), bootTime);
  }

  // Leaving the tab pauses a running game rather than letting wardens catch the thief unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  audio.startPad();
  announce('Mothlight. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
