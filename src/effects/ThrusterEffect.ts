import Phaser from "phaser";
import { THRUSTER } from "../config/thrusterConfig";

const PARTICLE_KEY = "thruster-particle";

// Oval texture — taller than wide so particles look like flame droplets.
const TEX_W = 18;
const TEX_H = 28;

type EmitterSet = {
  readonly cyan:   Phaser.GameObjects.Particles.ParticleEmitter;
  readonly orange: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly anchor: Phaser.GameObjects.Arc | null;
};

export class ThrusterEffect {
  private readonly player:   Phaser.Physics.Arcade.Sprite;
  private readonly emitters: EmitterSet | null;

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.player = player;

    let emitters: EmitterSet | null = null;

    try {
      this.ensureTexture(scene);

      const offsetX     = THRUSTER.offsetX;
      const baseOffsetY = player.displayHeight * THRUSTER.offsetYRatio;

      // CRITICAL: Emitters must be created at (0,0).
      // Phaser 4 multiplies emitter transform × particle transform in the renderer.
      // With startFollow(), particles already carry absolute world positions.
      // If the emitter is also at world coords, the position doubles and goes off-screen.
      // At (0,0) the emitter transform is identity, so particle positions pass through unchanged.

      // ── Layer 1: cyan / blue — long main flame ──────────────────────────
      // ADD blend: particles add coloured light onto the dark background.
      // Lower depth (-2) means cyan renders behind the orange core.
      const cyan = scene.add.particles(0, 0, PARTICLE_KEY, {
        color:             THRUSTER.cyan.colors,
        colorEase:         THRUSTER.cyan.colorEase,
        lifespan:          { min: THRUSTER.cyan.lifespanMin,  max: THRUSTER.cyan.lifespanMax },
        speedX:            { min: THRUSTER.cyan.speedXMin,    max: THRUSTER.cyan.speedXMax },
        speedY:            { min: THRUSTER.cyan.speedYMin,    max: THRUSTER.cyan.speedYMax },
        scale:             { start: THRUSTER.cyan.scaleStart, end: 0 },
        alpha:             { start: THRUSTER.cyan.alphaStart, end: 0 },
        frequency:         THRUSTER.cyan.frequency,
        maxAliveParticles: THRUSTER.cyan.maxAlive,
        blendMode:         Phaser.BlendModes.ADD,
        gravityY:          0,
      });
      cyan.setDepth(THRUSTER.cyanDepth);
      // Cyan starts a few px below the nozzle — extraOffsetY keeps the orange core visible.
      cyan.startFollow(player, offsetX, baseOffsetY + THRUSTER.cyan.extraOffsetY);
      cyan.stop();

      // ── Layer 2: orange / yellow — short hot core ───────────────────────
      // NORMAL blend: warm colours composite over the cyan layer without washing out.
      // Higher depth (-1) means orange renders ON TOP of cyan.
      // Starts at the exact nozzle mouth (extraOffsetY = 0).
      const orange = scene.add.particles(0, 0, PARTICLE_KEY, {
        color:             THRUSTER.orange.colors,
        colorEase:         THRUSTER.orange.colorEase,
        lifespan:          { min: THRUSTER.orange.lifespanMin,  max: THRUSTER.orange.lifespanMax },
        speedX:            { min: THRUSTER.orange.speedXMin,    max: THRUSTER.orange.speedXMax },
        speedY:            { min: THRUSTER.orange.speedYMin,    max: THRUSTER.orange.speedYMax },
        scale:             { start: THRUSTER.orange.scaleStart, end: 0 },
        alpha:             { start: THRUSTER.orange.alphaStart, end: 0 },
        frequency:         THRUSTER.orange.frequency,
        maxAliveParticles: THRUSTER.orange.maxAlive,
        blendMode:         Phaser.BlendModes.NORMAL,
        gravityY:          0,
      });
      orange.setDepth(THRUSTER.orangeDepth);
      orange.startFollow(player, offsetX, baseOffsetY + THRUSTER.orange.extraOffsetY);
      orange.stop();

      // ── Debug anchor ─────────────────────────────────────────────────────
      let anchor: Phaser.GameObjects.Arc | null = null;
      if (THRUSTER.showAnchor) {
        anchor = scene.add.circle(
          player.x + offsetX,
          player.y + baseOffsetY,
          THRUSTER.anchorRadius,
          0xff0000,
          1,
        ) as Phaser.GameObjects.Arc;
        anchor.setDepth(THRUSTER.anchorDepth);
      }

      emitters = { cyan, orange, anchor };
    } catch (err) {
      console.warn("[ThrusterEffect] Failed to create:", err);
    }

    this.emitters = emitters;
  }

  /**
   * Begin emission. Call after the countdown "YA!" and after unpausing.
   *
   * After pause():  active=false, emitting=true  → resume() restores active=true.
   * After stop():   active=true,  emitting=false → start() restores emitting=true.
   */
  resume(): void {
    if (!this.emitters) return;
    this.emitters.cyan.resume();
    this.emitters.orange.resume();
    this.emitters.cyan.start();
    this.emitters.orange.start();
  }

  /** Freeze all particles without destroying them (pause overlay). */
  pause(): void {
    if (!this.emitters) return;
    this.emitters.cyan.pause();
    this.emitters.orange.pause();
  }

  /** Stop emission; in-flight particles die naturally (game-over). */
  stop(): void {
    if (!this.emitters) return;
    this.emitters.cyan.stop();
    this.emitters.orange.stop();
  }

  /** Sync the debug anchor each frame. Emitters track via startFollow(). */
  updateAnchor(): void {
    if (!this.emitters?.anchor) return;
    const offsetY = this.player.displayHeight * THRUSTER.offsetYRatio;
    this.emitters.anchor.setPosition(
      this.player.x + THRUSTER.offsetX,
      this.player.y + offsetY,
    );
  }

  /** Destroy all GameObjects. Called from scene SHUTDOWN event. */
  destroy(): void {
    if (!this.emitters) return;
    this.emitters.cyan.destroy();
    this.emitters.orange.destroy();
    this.emitters.anchor?.destroy();
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a soft oval gradient texture (TEX_W × TEX_H px) for particles.
   * White base so the emitter's `color` config can tint it freely.
   * Textures live at game level — created once per browser session.
   */
  private ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(PARTICLE_KEY)) return;

    let created = false;

    // Preferred: CanvasTexture with radial gradient for smooth soft edges
    try {
      const ct = scene.textures.createCanvas(PARTICLE_KEY, TEX_W, TEX_H);
      if (ct) {
        const ctx = ct.getContext();
        const cx  = TEX_W / 2;
        const cy  = TEX_H / 2;
        const r   = Math.max(TEX_W, TEX_H) / 2;

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0.00, "rgba(255,255,255,1.0)");
        grd.addColorStop(0.40, "rgba(255,255,255,0.75)");
        grd.addColorStop(0.80, "rgba(255,255,255,0.15)");
        grd.addColorStop(1.00, "rgba(255,255,255,0.00)");

        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(cx, cy, TEX_W / 2, TEX_H / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ct.refresh();
        created = true;
      }
    } catch (e) {
      console.warn("[ThrusterEffect] createCanvas failed, using fallback:", e);
    }

    // Fallback: plain 32×32 white circle via Graphics
    if (!created) {
      const R   = 16;
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(R, R, R);
      gfx.generateTexture(PARTICLE_KEY, R * 2, R * 2);
      gfx.destroy();
    }
  }
}
