import Phaser from "phaser";

// ─── Tunable constants ─────────────────────────────────────────────────────────
//
// STAR_LAYERS  – modify count, size range, speed range, alpha, and depth per layer.
// NEBULA_DEFS  – modify position (xFrac/yFrac as 0–1 fraction of canvas), radius,
//                color (hex), and speed (px/sec downward) per nebula.
// LEVEL_SPEED_GAIN / MAX_LEVEL_MULT – how fast the parallax accelerates with level.

type LayerConfig = {
  readonly count: number;
  readonly minSize: number;  // px (will be ceiled to int)
  readonly maxSize: number;
  readonly minSpeed: number; // px/sec at level 1
  readonly maxSpeed: number;
  readonly minAlpha: number;
  readonly maxAlpha: number;
  readonly depth: number;
};

type NebulaDef = {
  readonly xFrac: number;  // 0–1 fraction of canvas width
  readonly yFrac: number;  // 0–1 fraction of canvas height
  readonly radius: number; // px
  readonly color: number;  // 0xRRGGBB
  readonly speed: number;  // px/sec downward
};

// ─── Star layer configs ────────────────────────────────────────────────────────

const STAR_LAYERS: readonly LayerConfig[] = [
  // Far: many, tiny, slow, dim
  { count: 70, minSize: 1, maxSize: 2,  minSpeed: 25,  maxSpeed: 40,  minAlpha: 0.20, maxAlpha: 0.40, depth: -5 },
  // Mid: medium count, medium size and speed
  { count: 45, minSize: 2, maxSize: 3,  minSpeed: 55,  maxSpeed: 75,  minAlpha: 0.45, maxAlpha: 0.65, depth: -4 },
  // Near: few, larger, faster, brighter
  { count: 25, minSize: 3, maxSize: 5,  minSpeed: 100, maxSpeed: 135, minAlpha: 0.65, maxAlpha: 0.90, depth: -3 },
];

// ─── Nebula configs ────────────────────────────────────────────────────────────

const NEBULA_DEFS: readonly NebulaDef[] = [
  { xFrac: 0.25, yFrac: 0.30, radius: 340, color: 0x1a0a4a, speed: 5 },
  { xFrac: 0.72, yFrac: 0.65, radius: 280, color: 0x062038, speed: 7 },
];

// ─── Level–speed relationship ──────────────────────────────────────────────────

// Each level above 1 multiplies star speeds by this amount.
const LEVEL_SPEED_GAIN = 0.08;  // +8 % per level
const MAX_LEVEL_MULT   = 1.40;  // cap at +40 % (reached at level ~6)

// ─── Background color ──────────────────────────────────────────────────────────
// Exported so GameScene can keep cameras.main.setBackgroundColor in sync.

export const SPACE_BG_COLOR = 0x07111f;
export const SPACE_BG_HEX   = "#07111f";

// ─── Internal types ────────────────────────────────────────────────────────────

type StarEntry = {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly baseSpeed: number; // px/sec at multiplier 1.0
};

type NebulaEntry = {
  readonly gfx: Phaser.GameObjects.Graphics;
  readonly speed: number;
  readonly wrapY: number;  // y at which to teleport back to top
  readonly resetY: number; // y value after wrap
};

// ─── Class ─────────────────────────────────────────────────────────────────────

export class SpaceBackground {
  private readonly w: number;
  private readonly h: number;
  private readonly starLayers: StarEntry[][] = [];
  private readonly nebulae: NebulaEntry[] = [];

  constructor(scene: Phaser.Scene) {
    this.w = scene.scale.width;
    this.h = scene.scale.height;

    // Solid background rectangle — sits behind every game object (depth -10)
    scene.add
      .rectangle(this.w / 2, this.h / 2, this.w, this.h, SPACE_BG_COLOR)
      .setDepth(-10);

    this.buildNebulae(scene);
    this.buildStars(scene);
  }

  // ─── Initialization ──────────────────────────────────────────────────────────

  private buildNebulae(scene: Phaser.Scene): void {
    for (const def of NEBULA_DEFS) {
      const gfx = scene.add.graphics().setDepth(-6);
      this.paintNebula(gfx, def.color, def.radius);
      gfx.x = this.w * def.xFrac;
      gfx.y = this.h * def.yFrac;

      this.nebulae.push({
        gfx,
        speed:  def.speed,
        wrapY:  this.h + def.radius + 20,
        resetY: -(def.radius + 20),
      });
    }
  }

  /**
   * Paints a soft nebula glow into a Graphics object.
   * Draws concentric circles from outer (large, faint) to inner (small, slightly
   * more opaque). Total accumulated center opacity ≈ 10–14 %.
   */
  private paintNebula(gfx: Phaser.GameObjects.Graphics, color: number, maxR: number): void {
    gfx.clear();
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      // ratio goes from 1.0 (outermost) to 0.25 (innermost)
      const ratio = 1 - (i / steps) * 0.75;
      const alpha = 0.010 + 0.003 * i; // 0.010 → 0.028
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(0, 0, maxR * ratio);
    }
  }

  private buildStars(scene: Phaser.Scene): void {
    for (const cfg of STAR_LAYERS) {
      const layer: StarEntry[] = [];

      for (let i = 0; i < cfg.count; i++) {
        const sz = Math.ceil(Phaser.Math.FloatBetween(cfg.minSize, cfg.maxSize));

        const rect = scene.add
          .rectangle(
            Phaser.Math.Between(0, this.w),
            Phaser.Math.Between(0, this.h), // pre-spread across the full canvas
            sz, sz,
            0xffffff,
          )
          .setAlpha(Phaser.Math.FloatBetween(cfg.minAlpha, cfg.maxAlpha))
          .setDepth(cfg.depth);

        layer.push({
          rect,
          baseSpeed: Phaser.Math.FloatBetween(cfg.minSpeed, cfg.maxSpeed),
        });
      }

      this.starLayers.push(layer);
    }
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  /**
   * Call every frame from GameScene.update() when the scene is NOT player-paused.
   * @param delta  Frame delta in milliseconds.
   * @param level  Current game level (1 = base speed, higher = faster stars).
   */
  update(delta: number, level: number): void {
    const mult = Math.min(1 + (level - 1) * LEVEL_SPEED_GAIN, MAX_LEVEL_MULT);
    const dt   = delta / 1000; // ms → seconds

    // Move stars; recycle any that leave the bottom
    for (const layer of this.starLayers) {
      for (const star of layer) {
        star.rect.y += star.baseSpeed * mult * dt;

        if (star.rect.y > this.h + 5) {
          star.rect.y = Phaser.Math.Between(-8, -1);
          star.rect.x = Phaser.Math.Between(0, this.w);
        }
      }
    }

    // Move nebulae; wrap when fully below the canvas
    for (const neb of this.nebulae) {
      neb.gfx.y += neb.speed * dt;

      if (neb.gfx.y > neb.wrapY) {
        neb.gfx.y  = neb.resetY;
        neb.gfx.x  = Phaser.Math.Between(
          Math.round(this.w * 0.1),
          Math.round(this.w * 0.9),
        );
      }
    }
  }
}
