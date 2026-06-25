export const SHIELD_CONFIG = {
  firstSpawnDelayMs: 18_000,   // delay after game start before first pickup appears
  nextSpawnMinMs:    28_000,   // min delay between pickups (after prior one gone/used)
  nextSpawnMaxMs:    42_000,   // max delay between pickups
  activeDurationMs:  8_000,    // how long the shield lasts once collected
  pickupSpeed:       115,      // px/s falling speed
  pickupRadius:      26,       // physics hitbox radius (and visual half-size)
  shieldRadius:      54,       // visual ring radius around the ship
  postHitGraceMs:    450,      // immunity window after shield absorbs a hit
  shieldAppearMs:    220,      // fade-in duration when shield activates
  shieldVanishMs:    200,      // fade-out duration when shield expires normally
} as const;
