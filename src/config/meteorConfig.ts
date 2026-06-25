// ─── Meteor configuration ─────────────────────────────────────────────────────
// Centralizes ALL per-size constants (was previously inline in GameScene.ts).
// hitboxRatio is applied to the natural texture px (meteor.width), not displaySize.

export type MeteorConfig = {
  readonly key:          string;
  readonly displaySize:  number;  // visual px (square, after setDisplaySize)
  readonly speedMult:    number;  // multiplied with currentSpeed
  readonly hitboxRatio:  number;  // fraction of natural texture size for circle radius
  readonly rotSpeed:     number;  // angular velocity magnitude (deg/s)
  readonly hp:           number;  // hit-points; bullets do WEAPON.damage per hit
  readonly destroyScore: number;  // points granted when destroyed by bullets
  readonly surviveScore: number;  // points granted when it exits the bottom (player dodged)
};

export const METEOR_CONFIGS: MeteorConfig[] = [
  { key: "meteor-small",  displaySize: 105, speedMult: 1.15, hitboxRatio: 0.50, rotSpeed: 160, hp: 1, destroyScore: 10, surviveScore:  5 },
  { key: "meteor-medium", displaySize: 132, speedMult: 1.00, hitboxRatio: 0.78, rotSpeed: 100, hp: 3, destroyScore: 25, surviveScore: 10 },
  { key: "meteor-large",  displaySize: 168, speedMult: 0.85, hitboxRatio: 0.88, rotSpeed: 55,  hp: 7, destroyScore: 55, surviveScore: 20 },
];
