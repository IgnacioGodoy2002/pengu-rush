// ─── Weapon / bullet configuration ───────────────────────────────────────────
// All tunables in one place. Change here to adjust feel without touching logic.

export const WEAPON = {
  // ── Bullet appearance ────────────────────────────────────────────────────
  bulletW:      12,       // texture width  (px)
  bulletH:      32,       // texture height (px)
  bulletColor:  0x00e5ff, // core cyan
  bulletGlow:   0x006aff, // outer glow blue

  // ── Bullet physics ────────────────────────────────────────────────────────
  bulletSpeed:  1100,     // px / s (upward)
  damage:       1,        // HP removed per hit
  maxBullets:   40,       // hard limit in flight at once

  // ── Fire control ──────────────────────────────────────────────────────────
  cooldownMs:   320,      // minimum ms between bursts

  // ── Cannon offsets (fraction of the player's display size) ───────────────
  // Positive dx = right of center; positive dy = down from center.
  leftCannonDX:  -0.31,  // left  cannon horizontal offset
  rightCannonDX:  0.31,  // right cannon horizontal offset
  cannonDY:      -0.28,  // both  cannons vertical offset (negative = up)
};
