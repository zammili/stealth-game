// Line of sight and vision cones. Everything here is pure geometry over the
// level's wall rectangles, so it can be tested without a browser: a guard sees
// the player only when the player is inside the cone, close enough, and no wall
// crosses the segment between them. The same raycast also shapes the cone the
// renderer draws, so the picture always matches the rule.

/** True when the segment (x1,y1)-(x2,y2) touches or crosses the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  // Slab test, one axis at a time; a zero-length axis is skipped when inside.
  const axes = [
    [dx, x1, rect.x, rect.x + rect.w],
    [dy, y1, rect.y, rect.y + rect.h],
  ];
  for (const [d, origin, low, high] of axes) {
    if (d === 0) {
      if (origin < low || origin > high) return false;
    } else {
      let a = (low - origin) / d;
      let b = (high - origin) / d;
      if (a > b) [a, b] = [b, a];
      if (a > tMin) tMin = a;
      if (b < tMax) tMax = b;
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** Distance along the ray (x,y)+t*(dx,dy) to the first wall hit, or Infinity. */
export function rayToWalls(x, y, dx, dy, walls, maxDistance) {
  let best = maxDistance;
  for (const wall of walls) {
    const t = rayToRect(x, y, dx, dy, wall);
    if (t !== null && t < best) best = t;
  }
  return best;
}

function rayToRect(x, y, dx, dy, rect) {
  let tMin = 0;
  let tMax = Infinity;
  const axes = [
    [dx, x, rect.x, rect.x + rect.w],
    [dy, y, rect.y, rect.y + rect.h],
  ];
  for (const [d, origin, low, high] of axes) {
    if (d === 0) {
      if (origin < low || origin > high) return null;
    } else {
      let a = (low - origin) / d;
      let b = (high - origin) / d;
      if (a > b) [a, b] = [b, a];
      if (a > tMin) tMin = a;
      if (b < tMax) tMax = b;
      if (tMin > tMax) return null;
    }
  }
  return tMin;
}

/** True when no wall blocks the straight line between the two points. */
export function hasLineOfSight(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Can this guard see the player right now? `options` carries the guard's sight
 * range and half-angle, whether the player is sneaking, and whether the player
 * is inside a bush. Sneaking shrinks the range; a bush hides the player except
 * at point-blank range.
 */
export function canSee(guard, playerX, playerY, walls, options) {
  const dx = playerX - guard.x;
  const dy = playerY - guard.y;
  const distance = Math.hypot(dx, dy);
  let range = options.range;
  if (options.sneaking) range *= 0.55;
  if (options.inBush) range = Math.min(range, options.bushSpotRange);
  if (distance > range) return false;
  if (distance < 26) return hasLineOfSight(guard.x, guard.y, playerX, playerY, walls);
  const angleToPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angleToPlayer, guard.facing)) > options.halfAngle) return false;
  return hasLineOfSight(guard.x, guard.y, playerX, playerY, walls);
}

/**
 * The visible cone as a polygon: rays fanned across the cone, each stopped by
 * the nearest wall, so cover carves real notches out of the light. Returns the
 * points in order, starting at the guard.
 */
export function conePolygon(guard, range, halfAngle, walls) {
  const steps = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= steps; i += 1) {
    const angle = guard.facing - halfAngle + (2 * halfAngle * i) / steps;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const distance = rayToWalls(guard.x, guard.y, dx, dy, walls, range);
    points.push({ x: guard.x + dx * distance, y: guard.y + dy * distance });
  }
  return points;
}
