// A small seeded random number generator: the same seed gives the same game,
// which is what makes the screenshot scenes repeatable. Mulberry32, written
// from the algorithm's definition (a 32-bit state, one xorshift multiply per
// draw, scaled into [0, 1)).

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a deterministic integer in [min, max] from a seeded random function. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
