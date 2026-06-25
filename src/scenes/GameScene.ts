import Phaser from "phaser";
import { RecordsService, type SavedData } from "../services/RecordsService";
import { getDifficultyForScore, getMeteorWeights } from "../constants/difficulty";
import { createButton } from "../ui/Button";
import { COLORS, FONT } from "../constants/theme";
import { SpaceBackground, SPACE_BG_HEX } from "./SpaceBackground";
import { MusicManager } from "../services/MusicManager";
import { METEOR_CONFIGS, type MeteorConfig } from "../config/meteorConfig";
import { WEAPON } from "../config/weaponConfig";
import { CAMERA_SHAKE } from "../config/cameraEffectsConfig";
import { SHIELD_CONFIG } from "../config/shieldConfig";
import { ThrusterEffect } from "../effects/ThrusterEffect";
import { SoundEffectsManager } from "../services/SoundEffectsManager";

// ─── Player multi-part hitbox config ──────────────────────────────────────────
// Adjusted for the armed ship (nave_penguino_armada.png) with cannon pods.
// Display ≈ 238 × 238 px (1254 px source × scale 0.19).
// Set DEBUG_PHYSICS = true in src/main.ts to verify overlays visually.

type HitboxDef = {
  readonly label: string;
  readonly w: number;
  readonly h: number;
  readonly dx: number;
  readonly dy: number;
};

const WING_W        = 80;
const WING_H        = 88;
const WING_OFFSET_X = 82;
const WING_OFFSET_Y = 15;

const PLAYER_HITBOX_PARTS: readonly HitboxDef[] = [
  { label: "body",       w: 84,     h: 195,    dx: 0,               dy: -5             },
  { label: "wing-right", w: WING_W, h: WING_H, dx: +WING_OFFSET_X, dy: WING_OFFSET_Y  },
  { label: "wing-left",  w: WING_W, h: WING_H, dx: -WING_OFFSET_X, dy: WING_OFFSET_Y  },
];

type PlayerZoneEntry = {
  readonly zone: Phaser.GameObjects.Zone;
  readonly dx: number;
  readonly dy: number;
};

// ─── Shoot button dimensions ──────────────────────────────────────────────────
const SHOOT_BTN_R  = 50;   // radius (px)
const SHOOT_BTN_DX = 90;   // from right edge
const SHOOT_BTN_DY = 120;  // from bottom edge

// ─── Tutorial localStorage key ────────────────────────────────────────────────
const TUTORIAL_KEY = "pengu-rush:tutorial-seen";

// ─── Explosion config per meteor size ─────────────────────────────────────────
type ExplosionCfg = { readonly count: number; readonly speedMin: number; readonly speedMax: number };

const EXPLOSION_CFG: Readonly<Record<string, ExplosionCfg>> = {
  "meteor-small":  { count:  7, speedMin:  40, speedMax: 130 },
  "meteor-medium": { count: 12, speedMin:  55, speedMax: 180 },
  "meteor-large":  { count: 19, speedMin:  70, speedMax: 240 },
};


export class GameScene extends Phaser.Scene {
  // ── Background ────────────────────────────────────────────────────────────
  private spaceBackground!: SpaceBackground;

  // ── Physics objects ───────────────────────────────────────────────────────
  private player!: Phaser.Physics.Arcade.Sprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;

  // ── Timers ────────────────────────────────────────────────────────────────
  private spawnTimer!: Phaser.Time.TimerEvent;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // ── HUD refs ──────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  // ── Persistence ───────────────────────────────────────────────────────────
  private savedData!: SavedData;

  // ── Game state ────────────────────────────────────────────────────────────
  private score = 0;
  private survivedMs = 0;
  private meteorsDestroyed = 0;
  private gameStarted = false;
  private gameOver = false;
  private paused = false;

  // ── Difficulty ────────────────────────────────────────────────────────────
  private currentLevel = 1;
  private currentSpeed = 420;
  private currentDelay = 850;

  // ── Player ────────────────────────────────────────────────────────────────
  private readonly playerSpeed = 550;

  // ── Pause overlay objects ─────────────────────────────────────────────────
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];

  // ── Multi-part collision hitboxes ─────────────────────────────────────────
  private playerHitboxes!: Phaser.Physics.Arcade.Group;
  private playerZones: PlayerZoneEntry[] = [];

  // ── Thruster effect ───────────────────────────────────────────────────────
  private thruster: ThrusterEffect | null = null;

  // ── UI interaction guard ──────────────────────────────────────────────────
  // Set to true when a HUD button captures a pointerdown, so the global
  // movement listener ignores that touch.
  private isPointerOverUI = false;

  // ── Tutorial panel objects ────────────────────────────────────────────────
  private tutorialPanel: Phaser.GameObjects.GameObject[] = [];

  // ── Power-up / Shield state ───────────────────────────────────────────────
  private pickups!: Phaser.Physics.Arcade.Group;
  private pickupSprite: Phaser.Physics.Arcade.Image | null = null;
  private pickupTween: Phaser.Tweens.Tween | null = null;
  private pickupTimer: Phaser.Time.TimerEvent | null = null;
  private shieldActive = false;
  private shieldGraceUntil = 0;   // this.time.now timestamp; collisions ignored until then
  private shieldRing: Phaser.GameObjects.Graphics | null = null;
  private shieldTween: Phaser.Tweens.Tween | null = null;
  private shieldTimer: Phaser.Time.TimerEvent | null = null;
  private shieldBlinkTimer: Phaser.Time.TimerEvent | null = null;

  // ── Weapon state ──────────────────────────────────────────────────────────
  private nextShotTime  = 0;
  private shootBtnDown  = false;
  private shootBtnBounds = { cx: 0, cy: 0, r: SHOOT_BTN_R };
  private movePtrId: number | null = null;
  private firePtr:  number | null = null;   // pointer ID holding FIRE in multitouch

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.image("player-armed",  "assets/player/nave_penguino_armada.png");
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Reset per-run state ───────────────────────────────────────────────
    // Explicitly restore clock and physics in case the previous run ended
    // while paused (pause → menu path leaves time.paused = true and physics
    // paused; Phaser's Clock.shutdown() does NOT reset the paused property).
    this.time.paused = false;
    this.physics.resume();

    this.score = 0;
    this.survivedMs = 0;
    this.meteorsDestroyed = 0;
    this.gameStarted = false;
    this.gameOver = false;
    this.paused = false;
    this.currentLevel = 1;
    this.currentSpeed = 420;
    this.currentDelay = 850;
    this.pauseObjects = [];
    this.playerZones = [];
    this.nextShotTime = 0;
    this.shootBtnDown = false;
    this.firePtr      = null;
    this.movePtrId    = null;
    this.isPointerOverUI = false;
    this.tutorialPanel = [];
    this.shieldActive = false;
    this.shieldGraceUntil = 0;
    this.pickupSprite = null;
    this.pickupTween = null;
    this.pickupTimer = null;
    this.shieldRing = null;
    this.shieldTween = null;
    this.shieldTimer = null;
    this.shieldBlinkTimer = null;

    this.savedData = RecordsService.load();

    // ── Animated space background ─────────────────────────────────────────
    this.spaceBackground = new SpaceBackground(this);
    this.cameras.main.setBackgroundColor(SPACE_BG_HEX);

    // ── Corner accents ────────────────────────────────────────────────────
    this.add.rectangle(0, 0, 200, 200, COLORS.greenNum, 0.05).setOrigin(0, 0);
    this.add.rectangle(width, height, 200, 200, COLORS.greenNum, 0.05).setOrigin(1, 1);

    // ── HUD strip ─────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, 70, width, 140, 0x000000, 0.35);

    this.scoreText = this.add.text(28, 24, "Puntaje: 0", {
      fontFamily: FONT, fontSize: "26px", color: COLORS.white, fontStyle: "bold",
    });
    this.add.text(28, 60, `Récord: ${this.savedData.bestScore}`, {
      fontFamily: FONT, fontSize: "22px", color: COLORS.muted,
    });
    this.levelText = this.add
      .text(width - 130, 24, "Nivel: 1", {
        fontFamily: FONT, fontSize: "26px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0, 0);

    // Pause button — top right
    const pauseBtn = createButton({
      scene: this,
      x: width - 44, y: 70, width: 72, height: 72,
      label: "II", bgColor: COLORS.btnSecondary, fontSize: "22px",
      depth: 1, onClick: () => this.togglePause(),
    });
    pauseBtn.bg.on("pointerdown", () => { this.isPointerOverUI = true;  });
    pauseBtn.bg.on("pointerup",   () => { this.isPointerOverUI = false; });
    pauseBtn.bg.on("pointerout",  () => { this.isPointerOverUI = false; });

    // Mute button — center HUD strip
    this.buildMuteHud(width / 2, 108);

    // ── Player sprite (armed ship) ────────────────────────────────────────
    const PLAYER_SCALE = 0.19;
    this.player = this.physics.add.sprite(width / 2, height - 200, "player-armed");
    this.player.setScale(PLAYER_SCALE).setOrigin(0.5);

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setAllowGravity(false);
    playerBody.setCollideWorldBounds(true);

    // ── Multi-part hitboxes ───────────────────────────────────────────────
    this.playerHitboxes = this.physics.add.group();
    for (const def of PLAYER_HITBOX_PARTS) {
      const zone = this.add.zone(this.player.x + def.dx, this.player.y + def.dy, def.w, def.h);
      zone.setOrigin(0.5);
      this.physics.add.existing(zone);
      const zoneBody = zone.body as Phaser.Physics.Arcade.Body;
      zoneBody.setAllowGravity(false);
      if      (def.label === "wing-right") { zoneBody.debugBodyColor = 0x00ff00; }
      else if (def.label === "wing-left")  { zoneBody.debugBodyColor = 0xff2200; }
      else                                  { zoneBody.debugBodyColor = 0x2288ff; }
      this.playerHitboxes.add(zone);
      this.playerZones.push({ zone, dx: def.dx, dy: def.dy });
    }

    // ── Obstacles ─────────────────────────────────────────────────────────
    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });

    // ── Pickups (shield power-ups) ────────────────────────────────────────
    this.pickups = this.physics.add.group({ allowGravity: false });

    // ── Bullets ───────────────────────────────────────────────────────────
    this.createBulletTexture();
    this.bullets = this.physics.add.group({ allowGravity: false });

    // ── Thruster (starts stopped; resumed when countdown ends) ───────────
    try {
      this.thruster = new ThrusterEffect(this, this.player);
    } catch (err) {
      console.warn("[Thruster] Creation failed:", err);
      this.thruster = null;
    }

    // ── Keyboard input ────────────────────────────────────────────────────
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyP     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyEsc   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── Touch / pointer movement + FIRE ──────────────────────────────────
    // Each pointer is identified by ptr.id so two simultaneous touches
    // (one sliding the ship, one holding FIRE) work independently.
    // isPointerOverUI blocks PAUSE and MUTE from also triggering movement.
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.gameStarted || this.gameOver || this.paused) return;
      if (this.isPointerOverUI) return;
      const dx = ptr.x - this.shootBtnBounds.cx;
      const dy = ptr.y - this.shootBtnBounds.cy;
      if (dx * dx + dy * dy <= this.shootBtnBounds.r * this.shootBtnBounds.r) {
        // Touch is inside the FIRE button area — set FIRE state and attempt
        // an immediate shot; update() continues firing while held.
        this.shootBtnDown = true;
        this.firePtr      = ptr.id;
        this.fireBurst();
        return;
      }
      // Only capture movement if no finger is already tracking it; prevents
      // a second finger on the movement area from stealing movePtrId.
      if (this.movePtrId === null) {
        this.movePtrId = ptr.id;
        this.movePlayerTo(ptr.x);
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.gameStarted || this.gameOver || this.paused || !ptr.isDown) return;
      if (ptr.id !== this.movePtrId) return;
      this.movePlayerTo(ptr.x);
    });

    const releasePointer = (ptr: Phaser.Input.Pointer) => {
      if (ptr.id === this.movePtrId) this.movePtrId = null;
      if (ptr.id === this.firePtr) {
        this.shootBtnDown = false;
        this.firePtr      = null;
      }
    };
    this.input.on("pointerup",     releasePointer);
    this.input.on("pointercancel", releasePointer);

    // ── Physics overlaps ──────────────────────────────────────────────────
    this.physics.add.overlap(
      this.playerHitboxes,
      this.obstacles,
      (_zone, meteorObj) => {
        this.handlePlayerMeteorCollision(meteorObj as Phaser.Physics.Arcade.Sprite);
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.playerHitboxes,
      this.pickups,
      (_zone, pickupObj) => {
        this.onPickupCollected(pickupObj as Phaser.Physics.Arcade.Image);
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.bullets,
      this.obstacles,
      (bObj, mObj) => {
        this.onBulletHitMeteor(
          bObj as Phaser.Physics.Arcade.Sprite,
          mObj as Phaser.Physics.Arcade.Sprite,
        );
      },
      undefined,
      this,
    );

    // ── Controls hint ─────────────────────────────────────────────────────
    const hintText = this.add
      .text(width / 2, height - 32,
        "A / D · flechas · arrastrar  |  P pausa  |  ESPACIO disparar", {
          fontFamily: FONT, fontSize: "19px", color: COLORS.muted,
        })
      .setOrigin(0.5);

    // ── Mobile shoot button ───────────────────────────────────────────────
    this.buildShootButton(width, height);

    // ── Game music (fallback for "JUGAR DE NUEVO" from GameOverScene) ───────
    // When coming from MenuScene's JUGAR button, the track is already playing
    // and this call is a no-op (isPlaying guard inside playGameMusic).
    // Wrapped in try/catch so a future audio failure never interrupts create().
    try {
      MusicManager.playGameMusic(this);
    } catch (err) {
      console.warn("[MusicManager] Could not start game music:", err);
    }

    // ── Scene cleanup (registered once per run) ───────────────────────────
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.thruster?.destroy();
      this.thruster = null;
      this.tutorialPanel.forEach((obj) => {
        this.tweens.killTweensOf(obj);
        if (obj.active) obj.destroy();
      });
      this.tutorialPanel = [];
      this.shootBtnDown = false;
      this.firePtr      = null;
      this.cancelAllShieldState();
    });

    // ── Countdown ─────────────────────────────────────────────────────────
    this.startCountdown(hintText);
  }

  update(_time: number, delta: number): void {
    // Keep debug anchor in sync with the ship every frame (no-op when showAnchor is false).
    this.thruster?.updateAnchor();

    if (!this.paused) {
      this.spaceBackground.update(delta, this.currentLevel);
    }

    if (!this.gameStarted || this.gameOver || this.paused) return;

    this.survivedMs += delta;

    // Sync shield ring to follow the ship every frame
    if (this.shieldRing) {
      this.shieldRing.setPosition(this.player.x, this.player.y);
    }
    // Destroy pickup that fell off the bottom of the screen
    this.checkPassedPickup();

    // Pause keys
    if (
      Phaser.Input.Keyboard.JustDown(this.keyP) ||
      Phaser.Input.Keyboard.JustDown(this.keyEsc)
    ) {
      this.togglePause();
      return;
    }

    // Movement
    const movement = this.playerSpeed * (delta / 1000);
    if (this.cursors.left.isDown  || this.keyA.isDown) this.player.x -= movement;
    if (this.cursors.right.isDown || this.keyD.isDown) this.player.x += movement;

    this.keepPlayerInsideScreen();
    this.syncHitboxes();
    this.checkPassedObstacles();

    // Shooting (keyboard or mobile button; cooldown controlled inside fireBurst)
    if (this.keySpace.isDown || this.shootBtnDown) {
      this.fireBurst();
    }

    // Remove bullets that have fully exited the top of the canvas
    this.bullets.getChildren().forEach((child) => {
      const b = child as Phaser.Physics.Arcade.Sprite;
      if (b.active && b.y < -(WEAPON.bulletH + 10)) b.destroy();
    });
  }

  // ─── Countdown ─────────────────────────────────────────────────────────────

  private startCountdown(hintText: Phaser.GameObjects.Text): void {
    const { width, height } = this.scale;

    this.showTutorialIfNeeded();

    const countText = this.add
      .text(width / 2, height / 2, "3", {
        fontFamily: FONT, fontSize: "180px", color: COLORS.white, fontStyle: "bold",
        stroke: "#000000", strokeThickness: 14,
        shadow: { offsetX: 3, offsetY: 3, color: "#000000", blur: 10, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(20);

    const steps = ["3", "2", "1", "YA!"];
    steps.forEach((label, i) => {
      this.time.delayedCall(i * 900, () => {
        countText.setText(label).setAlpha(1).setScale(1);
        this.tweens.add({ targets: countText, alpha: 0, scale: 1.5, duration: 750, ease: "Power2" });
        if (label === "YA!") {
          SoundEffectsManager.play(this, "sfx-countdown-go");
        } else {
          SoundEffectsManager.play(this, "sfx-countdown");
        }
      });
    });

    this.time.delayedCall(steps.length * 900, () => {
      countText.destroy();
      hintText.destroy();
      this.destroyTutorial();
      this.gameStarted = true;
      this.thruster?.resume();
      this.scheduleNextPickup(true);

      this.spawnTimer = this.time.addEvent({
        delay: this.currentDelay,
        callback: this.spawnObstacle,
        callbackScope: this,
        loop: true,
      });
    });
  }

  // ─── Pause ─────────────────────────────────────────────────────────────────

  private togglePause(): void {
    if (!this.gameStarted || this.gameOver) return;
    this.paused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.paused = true;
    this.shootBtnDown = false;
    this.firePtr      = null;
    this.physics.pause();
    this.time.paused = true;
    MusicManager.pauseGameMusic();
    this.thruster?.pause();
    this.pickupTween?.pause();
    this.shieldTween?.pause();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const d  = 30;

    const overlay  = this.add.rectangle(cx, cy, width, height, 0x000000, 0.72).setDepth(d);
    const title    = this.add
      .text(cx, cy - 160, "PAUSA", {
        fontFamily: FONT, fontSize: "72px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(d + 1);

    const resumeBtn = createButton({
      scene: this, x: cx, y: cy - 20, width: 400, height: 80,
      label: "CONTINUAR", bgColor: COLORS.btnPrimary, fontSize: "32px",
      depth: d + 1, onClick: () => this.resumeGame(),
    });

    const menuBtn = createButton({
      scene: this, x: cx, y: cy + 110, width: 400, height: 80,
      label: "VOLVER AL MENÚ", bgColor: COLORS.btnSecondary, fontSize: "28px",
      depth: d + 1, onClick: () => {
        // Restore time and physics before leaving so that if GameScene is
        // restarted later its Clock starts unpaused and all timers fire.
        this.time.paused = false;
        this.physics.resume();
        this.paused = false;
        this.scene.start("MenuScene");
      },
    });

    this.pauseObjects = [overlay, title, resumeBtn.bg, resumeBtn.text, menuBtn.bg, menuBtn.text];
  }

  private resumeGame(): void {
    this.paused = false;
    this.time.paused = false;
    this.physics.resume();
    MusicManager.resumeGameMusic();
    this.thruster?.resume();
    this.pickupTween?.resume();
    this.shieldTween?.resume();

    this.pauseObjects.forEach((obj) => obj.destroy());
    this.pauseObjects = [];
  }

  // ─── Tutorial ──────────────────────────────────────────────────────────────

  private showTutorialIfNeeded(): void {
    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(TUTORIAL_KEY) === "1";
    } catch {
      return;  // localStorage unavailable (private browsing, sandboxed); skip silently
    }
    if (alreadySeen) return;

    // Save immediately on creation — not when the panel disappears.
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      // Non-fatal: tutorial may reappear on next session
    }

    const { width } = this.scale;
    const cx     = width / 2;
    const panelY = 360;
    const isTouch = this.sys.game.device.input.touch;

    const bg = this.add
      .rectangle(cx, panelY, 500, 200, 0x0a1a2e, 0.88)
      .setStrokeStyle(1, 0x1e4a7f)
      .setDepth(18)
      .setAlpha(0);

    const moveLabel  = isTouch ? "DESLIZÁ"           : "← / →   ó   A / D";
    const shootLabel = isTouch ? "FIRE"              : "ESPACIO";

    const t1 = this.add
      .text(cx, panelY - 55, moveLabel, {
        fontFamily: FONT, fontSize: "26px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(18).setAlpha(0);

    const t2 = this.add
      .text(cx, panelY - 22, "para moverte", {
        fontFamily: FONT, fontSize: "19px", color: COLORS.muted,
      })
      .setOrigin(0.5).setDepth(18).setAlpha(0);

    const t3 = this.add
      .text(cx, panelY + 22, shootLabel, {
        fontFamily: FONT, fontSize: "26px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(18).setAlpha(0);

    const t4 = this.add
      .text(cx, panelY + 55, "para disparar", {
        fontFamily: FONT, fontSize: "19px", color: COLORS.muted,
      })
      .setOrigin(0.5).setDepth(18).setAlpha(0);

    this.tutorialPanel = [bg, t1, t2, t3, t4];

    this.tweens.add({
      targets:  this.tutorialPanel,
      alpha:    1,
      duration: 200,
      ease:     "Linear",
    });
  }

  private destroyTutorial(): void {
    if (this.tutorialPanel.length === 0) return;
    const panel = this.tutorialPanel;
    this.tweens.add({
      targets:  panel,
      alpha:    0,
      duration: 280,
      ease:     "Linear",
      onComplete: () => {
        panel.forEach((obj) => { if (obj.active) obj.destroy(); });
        this.tutorialPanel = [];
      },
    });
  }

  // ─── Obstacle spawning ─────────────────────────────────────────────────────

  private spawnObstacle(): void {
    if (!this.gameStarted || this.gameOver) return;

    // ── Time-based size distribution ──────────────────────────────────────
    const survivedSeconds = this.survivedMs / 1000;
    const weights = getMeteorWeights(survivedSeconds);

    // Weighted selection: roll ∈ [0, 100) → compare against cumulative bands.
    // When large=0, roll can never reach small+medium=100, so large is excluded.
    const roll = Math.random() * 100;
    const cfg: MeteorConfig =
      roll < weights.small                   ? METEOR_CONFIGS[0] :   // small
      roll < weights.small + weights.medium  ? METEOR_CONFIGS[1] :   // medium
                                               METEOR_CONFIGS[2];    // large

    const half = cfg.displaySize / 2;
    const x    = Phaser.Math.Between(half, this.scale.width - half);

    if (!this.textures.exists(cfg.key)) {
      console.error(`[spawnObstacle] Texture not found: "${cfg.key}"`);
      return;
    }

    const meteor = this.physics.add.sprite(x, -half, cfg.key);
    meteor.setOrigin(0.5);
    meteor.setDisplaySize(cfg.displaySize, cfg.displaySize);
    meteor.setAngle(Phaser.Math.Between(0, 359));
    meteor.setActive(true).setVisible(true).setDepth(10);

    // HP and score-resolution guard
    meteor.setData("hp",         cfg.hp);
    meteor.setData("maxHp",      cfg.hp);
    meteor.setData("resolved",   false);
    // Store scale set by setDisplaySize so flash can restore it after tweens.
    meteor.setData("baseScaleX", meteor.scaleX);
    meteor.setData("baseScaleY", meteor.scaleY);

    // Add to group BEFORE setting velocity (group callback resets body state).
    this.obstacles.add(meteor);

    const body    = meteor.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const natW    = meteor.width;
    const natH    = meteor.height;
    const diam    = Math.min(natW, natH) * cfg.hitboxRatio;
    const radius  = diam / 2;
    body.setCircle(radius, (natW - diam) / 2, (natH - diam) / 2);
    body.updateFromGameObject();

    body.setVelocityY(this.currentSpeed * cfg.speedMult);
    body.setAngularVelocity(cfg.rotSpeed * (Math.random() < 0.5 ? 1 : -1));
  }

  // ─── Difficulty ────────────────────────────────────────────────────────────

  private updateDifficulty(): void {
    const { level, speed, delay } = getDifficultyForScore(this.score);
    this.currentSpeed = speed;
    if (delay === this.currentDelay && level === this.currentLevel) return;
    this.currentDelay = delay;
    this.currentLevel = level;
    this.levelText.setText(`Nivel: ${level}`);
    this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.currentDelay,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true,
    });
  }

  // ─── Scoring (single source of truth) ────────────────────────────────────

  private getMeteorCfg(meteor: Phaser.Physics.Arcade.Sprite): MeteorConfig | undefined {
    return METEOR_CONFIGS.find(c => c.key === meteor.texture.key);
  }

  private resolveDestroy(meteor: Phaser.Physics.Arcade.Sprite): void {
    if (meteor.getData("resolved") as boolean) return;
    meteor.setData("resolved", true);
    const cfg = this.getMeteorCfg(meteor);
    this.score += cfg?.destroyScore ?? 10;
    this.meteorsDestroyed += 1;
    this.scoreText.setText(`Puntaje: ${this.score}`);
    this.updateDifficulty();
    // Destroy SFX — fires exactly once per meteor (guarded by resolved above).
    if      (cfg?.key === "meteor-small")  SoundEffectsManager.play(this, "sfx-destroy-small");
    else if (cfg?.key === "meteor-medium") SoundEffectsManager.play(this, "sfx-destroy-medium");
    else if (cfg?.key === "meteor-large")  SoundEffectsManager.play(this, "sfx-destroy-large");

    // Camera shake by meteor size. Guard above ensures this fires exactly once.
    // Calling shake() while already shaking replaces the current effect in Phaser —
    // simultaneous destructions let the last shake win (acceptable for rare cases).
    if (cfg?.key === "meteor-medium") {
      this.cameras.main.shake(
        CAMERA_SHAKE.mediumDestroyed.duration,
        CAMERA_SHAKE.mediumDestroyed.intensity,
      );
    } else if (cfg?.key === "meteor-large") {
      this.cameras.main.shake(
        CAMERA_SHAKE.largeDestroyed.duration,
        CAMERA_SHAKE.largeDestroyed.intensity,
      );
    }
  }

  private resolveSurvive(obstacle: Phaser.Physics.Arcade.Sprite): void {
    if (obstacle.getData("resolved") as boolean) return;
    obstacle.setData("resolved", true);
    const cfg = this.getMeteorCfg(obstacle);
    this.score += cfg?.surviveScore ?? 5;
    this.scoreText.setText(`Puntaje: ${this.score}`);
    this.updateDifficulty();
  }

  // ─── Passed obstacles ──────────────────────────────────────────────────────

  private checkPassedObstacles(): void {
    this.obstacles.getChildren().forEach((child) => {
      const obstacle = child as Phaser.Physics.Arcade.Sprite;
      if (obstacle.y - obstacle.displayHeight / 2 <= this.scale.height) return;
      this.resolveSurvive(obstacle);
      obstacle.destroy();
    });
  }

  // ─── Bullet system ─────────────────────────────────────────────────────────

  private createBulletTexture(): void {
    if (this.textures.exists("bullet")) return;
    const bw  = WEAPON.bulletW;
    const bh  = WEAPON.bulletH;
    const gfx = this.add.graphics();
    // Outer soft glow
    gfx.fillStyle(WEAPON.bulletGlow, 0.35);
    gfx.fillRoundedRect(0, 0, bw, bh, bw / 2);
    // Bright core
    gfx.fillStyle(WEAPON.bulletColor, 1.0);
    gfx.fillRoundedRect(2, 2, bw - 4, bh - 4, (bw - 4) / 2);
    // White hot streak at tip
    gfx.fillStyle(0xffffff, 0.65);
    gfx.fillRoundedRect(3, 3, bw - 6, Math.round(bh / 4), (bw - 6) / 2);
    gfx.generateTexture("bullet", bw, bh);
    gfx.destroy();
  }

  private fireBurst(): void {
    if (!this.gameStarted || this.gameOver || this.paused) return;
    if (this.time.now < this.nextShotTime) return;
    this.nextShotTime = this.time.now + WEAPON.cooldownMs;

    SoundEffectsManager.play(this, "sfx-shot");

    const lx = this.player.x + this.player.displayWidth  * WEAPON.leftCannonDX;
    const rx = this.player.x + this.player.displayWidth  * WEAPON.rightCannonDX;
    const cy = this.player.y + this.player.displayHeight * WEAPON.cannonDY;

    this.spawnBullet(lx, cy);
    this.spawnBullet(rx, cy);
  }

  private spawnBullet(x: number, y: number): void {
    if (this.bullets.getLength() >= WEAPON.maxBullets) return;
    const b = this.bullets.create(x, y, "bullet") as Phaser.Physics.Arcade.Sprite;
    b.setActive(true).setVisible(true).setDepth(8);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(-WEAPON.bulletSpeed);
    body.setSize(WEAPON.bulletW - 4, WEAPON.bulletH - 4);
  }

  // ─── Bullet ↔ meteor collision ─────────────────────────────────────────────

  private onBulletHitMeteor(
    bullet: Phaser.Physics.Arcade.Sprite,
    meteor: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!bullet.active || !meteor.active) return;

    bullet.destroy();

    const hp = (meteor.getData("hp") as number) - WEAPON.damage;
    meteor.setData("hp", hp);

    if (hp <= 0) {
      this.resolveDestroy(meteor);
      // Capture position and key BEFORE destroy so the explosion reads live data.
      const { x, y } = meteor;
      const key = meteor.texture.key;
      meteor.destroy();
      this.spawnExplosion(x, y, key);
    } else {
      SoundEffectsManager.playHit(this);
      this.flashMeteor(meteor);
      this.spawnImpactParticles(meteor.x, meteor.y);
    }
  }

  private flashMeteor(meteor: Phaser.Physics.Arcade.Sprite): void {
    try {
      const bx = (meteor.getData("baseScaleX") as number) || meteor.scaleX;
      const by = (meteor.getData("baseScaleY") as number) || meteor.scaleY;

      // Kill any pending flash tween before starting a new one.
      // Prevents scale/tint accumulation under rapid fire.
      this.tweens.killTweensOf(meteor);
      meteor.clearTint();
      meteor.setScale(bx, by);

      meteor.setTint(0xffffff);
      this.tweens.add({
        targets:  meteor,
        scaleX:   bx * 0.97,
        scaleY:   by * 0.97,
        duration: 35,
        yoyo:     true,   // shrink → recover; total 70 ms — within 50–80 ms range
        ease:     "Quad.Out",
        onComplete: () => {
          if (meteor.active) {
            meteor.clearTint();
            meteor.setScale(bx, by);
          }
        },
      });
    } catch (err) {
      console.warn("[ImpactEffect] Flash failed:", err);
      if (meteor.active) meteor.clearTint();
    }
  }

  private spawnImpactParticles(x: number, y: number): void {
    if (!this.textures.exists("thruster-particle")) return;
    try {
      const burst = this.add.particles(x, y, "thruster-particle", {
        color:     [0xffffff, 0x67e8f9, 0x2563eb],
        colorEase: "power1",
        lifespan:  { min: 100, max: 220 },
        speed:     { min: 20, max: 80 },
        scale:     { start: 0.65, end: 0 },
        alpha:     { start: 0.9, end: 0 },
        quantity:  4,
        stopAfter: 4,
        blendMode: Phaser.BlendModes.ADD,
        gravityY:  0,
      });
      burst.setDepth(14);
      burst.once("complete", () => burst.destroy());
    } catch (err) {
      console.warn("[ImpactEffect] Impact particles failed:", err);
    }
  }

  private spawnExplosion(x: number, y: number, meteorKey: string): void {
    if (!this.textures.exists("thruster-particle")) return;
    try {
      const ecfg = EXPLOSION_CFG[meteorKey] ?? EXPLOSION_CFG["meteor-small"];
      const burst = this.add.particles(x, y, "thruster-particle", {
        color:     [0xffffff, 0x67e8f9, 0xfbbf24, 0xff6600],
        colorEase: "power1",
        lifespan:  { min: 200, max: 440 },
        speed:     { min: ecfg.speedMin, max: ecfg.speedMax },
        scale:     { start: 1.2, end: 0 },
        alpha:     { start: 1.0, end: 0 },
        quantity:  ecfg.count,
        stopAfter: ecfg.count,
        blendMode: Phaser.BlendModes.ADD,
        gravityY:  0,
      });
      burst.setDepth(15);
      burst.once("complete", () => burst.destroy());
    } catch (err) {
      console.warn("[ImpactEffect] Explosion failed:", err);
    }
  }

  // ─── Shoot button (mobile) ─────────────────────────────────────────────────

  private buildShootButton(w: number, h: number): void {
    const cx = w - SHOOT_BTN_DX;
    const cy = h - SHOOT_BTN_DY;
    this.shootBtnBounds = { cx, cy, r: SHOOT_BTN_R };

    const gfx = this.add.graphics().setDepth(10).setAlpha(0.85);
    gfx.fillStyle(0x001a3a, 0.60);
    gfx.fillCircle(cx, cy, SHOOT_BTN_R);
    gfx.lineStyle(2, 0x00e5ff, 0.75);
    gfx.strokeCircle(cx, cy, SHOOT_BTN_R);

    this.add.text(cx, cy - 6, "■", {
      fontFamily: FONT, fontSize: "26px", color: "#00e5ff",
    }).setOrigin(0.5).setDepth(10).setAlpha(0.85);

    this.add.text(cx, cy + 22, "FIRE", {
      fontFamily: FONT, fontSize: "13px", color: "#0099dd",
    }).setOrigin(0.5).setDepth(10).setAlpha(0.85);

    // No interactive game object events here — FIRE detection is handled
    // entirely by the global pointerdown/up/cancel listeners registered in
    // create(), which track ptr.id for reliable multitouch support.
  }

  // ─── Mute HUD button ──────────────────────────────────────────────────────

  private buildMuteHud(cx: number, cy: number): void {
    const bw = 96, bh = 28, r = 4;
    const gfx = this.add.graphics().setDepth(1);
    const lbl = this.add.text(cx, cy, "", { fontFamily: FONT, fontSize: "14px" }).setOrigin(0.5).setDepth(1);
    const hit = this.add.rectangle(cx, cy, bw, bh, 0x000000, 0).setInteractive({ useHandCursor: true }).setDepth(1);

    const draw = (a: number) => {
      gfx.clear();
      gfx.fillStyle(0x1e3a5f, a);
      gfx.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, r);
      gfx.lineStyle(1, 0x4a7fa5, 0.45);
      gfx.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, r);
    };
    const sync = (muted: boolean) => {
      lbl.setText(muted ? "♪  OFF" : "♪  ON");
      lbl.setColor(muted ? "#475569" : "#94a3b8");
    };

    draw(0.55); sync(MusicManager.isMuted);
    hit.on("pointerover",  () => draw(0.8));
    hit.on("pointerout",   () => {
      draw(0.55);
      this.isPointerOverUI = false;
    });
    hit.on("pointerdown",  (
      _ptr: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      this.isPointerOverUI = true;
      event.stopPropagation();
      sync(MusicManager.toggleMute());
      draw(0.55);
    });
    hit.on("pointerup", (
      _ptr: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.isPointerOverUI = false;
    });
  }

  // ─── Player movement ───────────────────────────────────────────────────────

  private movePlayerTo(pointerX: number): void {
    this.player.x = pointerX;
    this.keepPlayerInsideScreen();
    this.syncHitboxes();
  }

  private keepPlayerInsideScreen(): void {
    const half = this.player.displayWidth / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x, half, this.scale.width - half);
  }

  // ─── Hitbox sync ───────────────────────────────────────────────────────────

  private syncHitboxes(): void {
    for (const pz of this.playerZones) {
      (pz.zone.body as Phaser.Physics.Arcade.Body).reset(
        this.player.x + pz.dx,
        this.player.y + pz.dy,
      );
    }
  }

  // ─── Shield / Power-up ─────────────────────────────────────────────────────

  private createPickupTexture(): void {
    if (this.textures.exists("shield-pickup")) return;
    const r    = SHIELD_CONFIG.pickupRadius;   // 26
    const size = r * 2 + 8;                    // 60 — includes glow padding
    const cx   = size / 2;                     // 30

    const gfx = this.add.graphics();
    // Outer glow
    gfx.fillStyle(0x22d3ee, 0.12);
    gfx.fillCircle(cx, cx, r + 4);
    // Main fill
    gfx.fillStyle(0x0369a1, 0.82);
    gfx.fillCircle(cx, cx, r);
    // Cyan border
    gfx.lineStyle(2.5, 0x22d3ee, 1);
    gfx.strokeCircle(cx, cx, r);
    // Inner ring (shield symbol)
    gfx.lineStyle(1.5, 0x7dd3fc, 0.85);
    gfx.strokeCircle(cx, cx, r * 0.56);
    // Center dot
    gfx.fillStyle(0xffffff, 0.65);
    gfx.fillCircle(cx, cx, 4);

    gfx.generateTexture("shield-pickup", size, size);
    gfx.destroy();
  }

  private scheduleNextPickup(firstSpawn: boolean): void {
    if (this.pickupTimer) {
      this.pickupTimer.remove(false);
      this.pickupTimer = null;
    }
    if (this.gameOver || !this.gameStarted) return;
    if (this.pickupSprite?.active) return;  // pickup already visible
    if (this.shieldActive) return;           // shield active; will schedule after expiry

    const delay = firstSpawn
      ? SHIELD_CONFIG.firstSpawnDelayMs
      : Phaser.Math.Between(SHIELD_CONFIG.nextSpawnMinMs, SHIELD_CONFIG.nextSpawnMaxMs);

    this.pickupTimer = this.time.delayedCall(delay, () => {
      this.pickupTimer = null;
      this.spawnPickup();
    });
  }

  private spawnPickup(): void {
    if (this.gameOver || !this.gameStarted) return;
    if (this.pickupSprite?.active) return;
    if (this.shieldActive) return;

    const { width } = this.scale;
    const r      = SHIELD_CONFIG.pickupRadius;
    const margin = r + 20;
    const x      = Phaser.Math.Between(margin, width - margin);

    const useIcon = this.textures.exists("shield-icon");
    if (!useIcon) {
      console.warn("[Shield] shield-icon not loaded — usando textura procedural de respaldo");
      this.createPickupTexture();
    }
    const textureKey = useIcon ? "shield-icon" : "shield-pickup";

    const pickup = this.physics.add.image(x, -(r + 4), textureKey);
    if (useIcon) pickup.setDisplaySize(54, 54);
    pickup.setDepth(11).setOrigin(0.5);
    this.pickups.add(pickup);

    const body   = pickup.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const offset = (pickup.displayWidth - r * 2) / 2;
    body.setCircle(r, offset, offset);
    body.updateFromGameObject();
    body.setVelocityY(SHIELD_CONFIG.pickupSpeed);

    this.pickupSprite = pickup;
    const bsx = pickup.scaleX;
    const bsy = pickup.scaleY;
    this.pickupTween  = this.tweens.add({
      targets: pickup,
      scaleX: { from: bsx * 0.96, to: bsx * 1.06 },
      scaleY: { from: bsy * 0.96, to: bsy * 1.06 },
      duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });
  }

  private onPickupCollected(pickup: Phaser.Physics.Arcade.Image): void {
    if (!pickup.active) return;

    this.tweens.killTweensOf(pickup);
    pickup.destroy();
    this.pickupSprite = null;
    this.pickupTween  = null;

    if (this.shieldActive) return; // already shielded — discard pickup silently

    if (this.pickupTimer) {
      this.pickupTimer.remove(false);
      this.pickupTimer = null;
    }
    SoundEffectsManager.play(this, "sfx-shield-pickup");
    this.activateShield();
  }

  private checkPassedPickup(): void {
    const p = this.pickupSprite;
    if (!p?.active) return;
    if (p.y - SHIELD_CONFIG.pickupRadius <= this.scale.height) return;

    this.tweens.killTweensOf(p);
    p.destroy();
    this.pickupSprite = null;
    this.pickupTween  = null;
    this.scheduleNextPickup(false);
  }

  private handlePlayerMeteorCollision(meteor: Phaser.Physics.Arcade.Sprite): void {
    // Ignore collisions during the post-hit grace window
    if (this.time.now < this.shieldGraceUntil) return;

    if (this.shieldActive) {
      this.consumeShield(meteor);
      return;
    }

    this.finishGame();
  }

  private activateShield(): void {
    if (this.shieldActive) return;
    this.shieldActive = true;

    // Build layered ring drawn at local (0,0) so setPosition drives world coords
    const ring = this.add.graphics();
    const sr   = SHIELD_CONFIG.shieldRadius;
    ring.lineStyle(12, 0x22d3ee, 0.10); ring.strokeCircle(0, 0, sr); // outer glow
    ring.lineStyle( 5, 0x22d3ee, 0.30); ring.strokeCircle(0, 0, sr); // mid glow
    ring.lineStyle( 2, 0x7dd3fc, 0.92); ring.strokeCircle(0, 0, sr); // sharp edge
    ring.setDepth(9).setPosition(this.player.x, this.player.y).setAlpha(0);
    this.shieldRing = ring;

    // Fade in, then start gentle pulse
    this.tweens.add({
      targets: ring, alpha: 1,
      duration: SHIELD_CONFIG.shieldAppearMs, ease: "Linear",
      onComplete: () => {
        if (!ring.active || !this.shieldActive) return;
        this.shieldTween = this.tweens.add({
          targets: ring, scaleX: 1.07, scaleY: 1.07,
          duration: 950, yoyo: true, repeat: -1, ease: "Sine.InOut",
        });
      },
    });

    // Blink starts 2 s before expiry
    const blinkDelay = SHIELD_CONFIG.activeDurationMs - 2_000;
    if (blinkDelay > 0) {
      this.shieldBlinkTimer = this.time.delayedCall(blinkDelay, () => {
        this.shieldBlinkTimer = null;
        this.startShieldBlink();
      });
    }

    // Expiry timer
    this.shieldTimer = this.time.delayedCall(SHIELD_CONFIG.activeDurationMs, () => {
      this.shieldTimer = null;
      this.expireShield();
    });
  }

  private expireShield(): void {
    if (!this.shieldActive) return;
    this.shieldActive = false;
    this.shieldTimer  = null;
    this.shieldBlinkTimer?.remove(false);
    this.shieldBlinkTimer = null;
    SoundEffectsManager.play(this, "sfx-shield-expire");
    this.deactivateShieldVisual(false);
  }

  private consumeShield(meteor: Phaser.Physics.Arcade.Sprite): void {
    // Block re-entry from simultaneous collision callbacks this frame
    this.shieldGraceUntil = this.time.now + SHIELD_CONFIG.postHitGraceMs;
    this.shieldActive     = false;

    this.shieldTimer?.remove(false);
    this.shieldTimer = null;
    this.shieldBlinkTimer?.remove(false);
    this.shieldBlinkTimer = null;

    // Mark resolved so no score or surviveScore can be awarded
    if (!(meteor.getData("resolved") as boolean)) {
      meteor.setData("resolved", true);
    }

    const { x, y } = meteor;
    meteor.destroy();

    SoundEffectsManager.play(this, "sfx-shield-absorb");
    this.spawnShieldAbsorptionEffect(x, y);
    this.deactivateShieldVisual(true);
  }

  private deactivateShieldVisual(absorbed: boolean): void {
    const ring      = this.shieldRing;
    this.shieldRing = null;
    this.shieldTween = null;

    if (!ring?.active) {
      if (!this.gameOver) this.scheduleNextPickup(false);
      return;
    }

    this.tweens.killTweensOf(ring);

    if (absorbed) {
      this.tweens.add({
        targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0,
        duration: 220, ease: "Power2.Out",
        onComplete: () => {
          if (ring.active) ring.destroy();
          if (!this.gameOver) this.scheduleNextPickup(false);
        },
      });
    } else {
      this.tweens.add({
        targets: ring, alpha: 0,
        duration: SHIELD_CONFIG.shieldVanishMs, ease: "Linear",
        onComplete: () => {
          if (ring.active) ring.destroy();
          if (!this.gameOver) this.scheduleNextPickup(false);
        },
      });
    }
  }

  private startShieldBlink(): void {
    if (!this.shieldRing || !this.shieldActive) return;
    const ring = this.shieldRing;
    this.tweens.killTweensOf(ring);
    ring.setScale(1);
    this.shieldTween = this.tweens.add({
      targets: ring, alpha: 0.28,
      duration: 240, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });
  }

  private spawnShieldAbsorptionEffect(x: number, y: number): void {
    if (!this.textures.exists("thruster-particle")) return;
    try {
      const burst = this.add.particles(x, y, "thruster-particle", {
        color:     [0xffffff, 0x7dd3fc, 0x22d3ee],
        colorEase: "power1",
        lifespan:  { min: 130, max: 300 },
        speed:     { min: 60, max: 160 },
        scale:     { start: 0.9, end: 0 },
        alpha:     { start: 1.0, end: 0 },
        quantity:  11,
        stopAfter: 11,
        blendMode: Phaser.BlendModes.ADD,
        gravityY:  0,
      });
      burst.setDepth(16);
      burst.once("complete", () => burst.destroy());
    } catch (err) {
      console.warn("[Shield] Absorption effect failed:", err);
    }
  }

  private cancelAllShieldState(): void {
    this.pickupTimer?.remove(false);
    this.pickupTimer = null;

    if (this.pickupSprite?.active) {
      this.tweens.killTweensOf(this.pickupSprite);
      this.pickupSprite.destroy();
    }
    this.pickupSprite = null;
    this.pickupTween  = null;

    if (this.shieldRing?.active) {
      this.tweens.killTweensOf(this.shieldRing);
      this.shieldRing.destroy();
    }
    this.shieldRing  = null;
    this.shieldTween = null;

    this.shieldTimer?.remove(false);
    this.shieldTimer = null;
    this.shieldBlinkTimer?.remove(false);
    this.shieldBlinkTimer = null;

    this.shieldActive     = false;
    this.shieldGraceUntil = 0;
  }

  // ─── Game Over ─────────────────────────────────────────────────────────────

  private finishGame(): void {
    if (this.gameOver) return;
    this.gameOver     = true;
    this.shootBtnDown = false;
    this.firePtr      = null;
    this.spawnTimer.remove(false);
    this.cancelAllShieldState();

    SoundEffectsManager.play(this, "sfx-player-crash");

    // Stop thruster and clear all in-flight bullets
    this.thruster?.stop();
    this.bullets.clear(true, true);

    // Flash player red then fade out
    this.player.setTint(0xff0000);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 400, ease: "Power2" });

    // Freeze meteors in place
    this.obstacles.getChildren().forEach((child) => {
      const body = (child as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.Body;
      body.setVelocityY(0);
      body.setAngularVelocity(0);
    });

    this.cameras.main.shake(
      CAMERA_SHAKE.playerDeath.duration,
      CAMERA_SHAKE.playerDeath.intensity,
    );
    MusicManager.fadeOutGameMusic(this);

    const result = RecordsService.computeSessionResult(this.score, this.savedData);
    RecordsService.save({
      bestScore: result.newBestScore,
      bestMilestoneScore: result.unlockedMilestoneScore ?? this.savedData.bestMilestoneScore,
      totalRewards: result.newTotalRewards,
    });

    this.time.delayedCall(500, () => {
      this.scene.start("GameOverScene", {
        score:            this.score,
        bestScore:        result.newBestScore,
        level:            this.currentLevel,
        survivedMs:       this.survivedMs,
        meteorsDestroyed: this.meteorsDestroyed,
        isNewRecord:      result.isNewBestScore,
      });
    });
  }
}
