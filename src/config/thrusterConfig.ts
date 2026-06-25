// ─── Thruster visual configuration ───────────────────────────────────────────
// Change values here to tune the effect without touching ThrusterEffect.ts.
//
// HOW TO ADJUST THE FLAME:
//   Longer flame        → raise cyan.lifespanMax / cyan.speedYMax
//   Narrower flame      → lower |speedXMin| and speedXMax
//   More continuous     → lower frequency (ms between emits)
//   Brighter cyan       → raise cyan.alphaStart or cyan.scaleStart
//   Brighter core       → raise orange.alphaStart or orange.scaleStart
//   Layer separation    → raise cyan.extraOffsetY
//   Thruster position   → adjust offsetYRatio (0=center, 0.50=bottom edge)

type LayerConfig = {
  readonly colors:       number[];
  readonly colorEase:    string;
  readonly frequency:    number;    // ms between emits
  readonly lifespanMin:  number;    // ms
  readonly lifespanMax:  number;
  readonly speedXMin:    number;
  readonly speedXMax:    number;
  readonly speedYMin:    number;    // positive = downward
  readonly speedYMax:    number;
  readonly alphaStart:   number;    // opacity at birth (fades to 0)
  readonly scaleStart:   number;    // size multiplier at birth (fades to 0)
  readonly maxAlive:     number;    // particle pool cap
  readonly extraOffsetY: number;    // px below base nozzle origin
};

type ThrusterConfig = {
  readonly offsetX:      number;    // px from ship center-x
  readonly offsetYRatio: number;    // fraction of displayHeight
  readonly cyanDepth:    number;    // layer 1 depth  (behind orange and player)
  readonly orangeDepth:  number;    // layer 2 depth  (behind player, above cyan)
  readonly showAnchor:   boolean;   // red debug dot at thruster origin
  readonly anchorRadius: number;
  readonly anchorDepth:  number;
  readonly cyan:   LayerConfig;
  readonly orange: LayerConfig;
};

export const THRUSTER: ThrusterConfig = {
  offsetX:      0,
  offsetYRatio: 0.34,

  // cyan renders first (lower depth), orange renders on top inside the base of the flame.
  // Both are behind the player (depth 0).
  cyanDepth:   -2,
  orangeDepth: -1,

  showAnchor:   false,
  anchorRadius: 6,
  anchorDepth:  999,

  // ── Layer 1: cyan / blue — long main flame (ADD blend) ─────────────────
  cyan: {
    colors:       [0xffffff, 0x67e8f9, 0x22d3ee, 0x2563eb],
    colorEase:    "power2",
    frequency:    15,
    lifespanMin:  300,
    lifespanMax:  470,
    speedXMin:    -12,
    speedXMax:     12,
    speedYMin:     190,
    speedYMax:     330,
    alphaStart:    0.95,
    scaleStart:    1.25,
    maxAlive:      32,
    extraOffsetY:  4,
  },

  // ── Layer 2: orange / yellow — short hot core (NORMAL blend) ───────────
  // Negative extraOffsetY pulls the origin slightly inside the nozzle so
  // there is no visible gap between the ship and the hot core.
  // NORMAL blend keeps warm colours visible over the cyan ADD layer.
  orange: {
    colors:       [0xffffff, 0xfff7ae, 0xfbbf24, 0xf97316],
    colorEase:    "power1",
    frequency:    16,
    lifespanMin:  110,
    lifespanMax:  190,
    speedXMin:    -5,
    speedXMax:     5,
    speedYMin:     65,
    speedYMax:     120,
    alphaStart:    1.0,
    scaleStart:    0.9,
    maxAlive:      15,
    extraOffsetY:  -2,
  },
};
