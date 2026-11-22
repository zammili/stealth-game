// Every tuning number and colour in one place for MOTHLIGHT, a quiet top-down
// stealth game. The playfield is a fixed 1280x720 logical area; the renderer
// scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sneakSpeed: 88,
  /** Running (not sneaking) is heard this far away, in pixels. */
  noiseRadius: 150,
  /** Seconds between footstep noise pulses while running. */
  noiseInterval: 0.38,
};

export const GUARD = {
  /** How far a guard can see, in pixels, in clear light. */
  sightRange: 250,
  /** Half of the vision cone's angle, in radians. */
  sightHalfAngle: 0.56,
  /** A player inside a bush is only spotted this close. */
  bushSpotRange: 52,
  patrolSpeed: 72,
  suspiciousSpeed: 96,
  chaseSpeed: 158,
  /** Suspicion per second at point-blank range; it falls off with distance. */
  suspicionNear: 2.4,
  suspicionFar: 0.55,
  /** Suspicion at which a guard stops and stares at what it saw. */
  suspiciousAt: 0.35,
  /** Suspicion at which a guard raises the alarm and chases. */
  alarmAt: 1,
  /** Suspicion lost per second while the player is unseen. */
  suspicionDecay: 0.22,
  /** Seconds unseen before an alerted guard gives up the chase. */
  giveUpAfter: 4,
  /** Seconds a guard looks around at a noise spot before going back. */
  investigateTime: 2.2,
  /** Distance at which a chasing guard catches the player. */
  catchRange: 24,
};

export const PEBBLES_PER_LEVEL = 3;
/** How far a thrown pebble can land from the player, in pixels. */
export const PEBBLE_RANGE = 280;
/** How far a pebble's clatter carries, in pixels. */
export const PEBBLE_NOISE = 210;

export const PALETTE = {
  backdrop: '#0b0e14',
  floorA: '#1a2030',
  floorB: '#161c29',
  floorLine: '#232c40',
  wallTop: '#4a5878',
  wallSide: '#2c3550',
  wallEdge: '#6b7ba3',
  bush: '#1f4d2e',
  bushLight: '#2f6b40',
  bushDark: '#143420',
  exitGlow: '#8fe3ff',
  exitDoor: '#12303f',
  shard: '#ffd76a',
  shardCore: '#fff3c4',
  player: '#e8e4d8',
  playerCloak: '#7a5fd0',
  guard: '#e8b04b',
  guardCoat: '#8a6d2f',
  cone: 'rgba(255, 196, 66, 0.20)',
  coneEdge: 'rgba(255, 214, 106, 0.55)',
  coneAlert: 'rgba(255, 84, 66, 0.28)',
  coneAlertEdge: 'rgba(255, 110, 88, 0.7)',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#ff5b4d',
  calm: '#7fd08a',
  panel: 'rgba(10, 13, 20, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'mothlight.best';
