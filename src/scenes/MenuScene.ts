import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { FONT } from "../constants/theme";
import { RecordsService } from "../services/RecordsService";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";
import { getSuraService } from "../integration/sura/SuraIntegrationService";
import type { SuraIntegrationState, SuraServiceEvent } from "../integration/sura/SuraTypes";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C_BG_HEX    = "#040d1a";
const C_CYAN      = 0x22d3ee;
const C_CYAN_HEX  = "#22d3ee";
const C_PANEL     = 0x08142b;
const C_BADGE     = 0x0c1e3d;
const C_GOLD      = 0xf59e0b;
const C_GOLD_HEX  = "#f59e0b";
const C_JUGAR     = 0x0e7490;
const C_COMO      = 0x1e3a5f;
const C_COMO_BORD = 0x4a7fa5;

// ─── Panel geometry ───────────────────────────────────────────────────────────
const PANEL_W = 620;
const PANEL_H = 880;
const PANEL_R = 18;

type FadeTarget =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Rectangle;

// ─── SURA status label per state ─────────────────────────────────────────────
const SURA_STATUS: Partial<Record<SuraIntegrationState, string>> = {
  "waiting-context": "Esperando sesión SURA...",
  "validating":      "Validando sesión...",
  "ready":           "¡Listo!",
  "starting":        "Iniciando partida...",
  "unauthorized":    "Sesión no autorizada.",
  "error":           "Error al conectar con SURA.",
};

export class MenuScene extends Phaser.Scene {
  private isStartingGame = false;

  // ── SURA UI refs (null in standalone mode) ────────────────────────────────
  private jugarBg:        Phaser.GameObjects.Rectangle | null = null;
  private jugarText:      Phaser.GameObjects.Text      | null = null;
  private suraStatusText: Phaser.GameObjects.Text      | null = null;
  private onSuraEvent:    ((event: SuraServiceEvent) => void) | null = null;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.isStartingGame = false;
    this.jugarBg        = null;
    this.jugarText      = null;
    this.suraStatusText = null;
    this.onSuraEvent    = null;

    const { width, height } = this.scale;
    const cx      = width / 2;
    const panelCY = height * 0.492;
    const top     = panelCY - PANEL_H / 2;

    this.cameras.main.setBackgroundColor(C_BG_HEX);
    this.tryPlayMenuMusic();

    this.buildStars(width, height);

    const panel = this.buildPanel(cx, panelCY);
    const glow  = this.buildGlow(cx, top + 155);

    const titleY   = top + 118;
    const rushY    = titleY  + 100;
    const subY     = rushY   + 108;
    const div1Y    = subY    + 66;
    const badgeY   = div1Y   + 70;
    const jugarY   = badgeY  + 132;
    const comoY    = jugarY  + 115;
    const div2Y    = comoY   + 80;
    const verY     = panelCY + PANEL_H / 2 - 50;

    const pengu = this.buildPengu(cx, titleY);
    const rush  = this.buildRush(cx, rushY);
    const sub   = this.buildSubtitle(cx, subY);
    const div1  = this.buildDivider(cx, div1Y, 510);

    const { bestScore } = RecordsService.load();
    const badge = this.buildBadge(cx, badgeY, bestScore);

    const [jugarBg, jugarTxt] = this.buildButton(
      cx, jugarY, 500, 92, "JUGAR", C_JUGAR, "38px",
      C_CYAN, 0.85, 1.035, 0.87,
      () => this.startGame(),
    );
    this.jugarBg   = jugarBg;
    this.jugarText = jugarTxt;

    const como = this.buildButton(
      cx, comoY, 500, 82, "CÓMO JUGAR", C_COMO, "30px",
      C_COMO_BORD, 0.65, 1.025, 0.75,
      () => this.scene.start("InstructionsScene"),
    );

    // SURA status text (visible only in sura / sura-mock modes)
    this.suraStatusText = this.add
      .text(cx, jugarY + 56, "", {
        fontFamily: FONT, fontSize: "19px", color: "#7ec8e3",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(1);

    const div2    = this.buildDivider(cx, div2Y, 420);
    const version = this.add
      .text(cx, verY, "MVP v1.0", {
        fontFamily: FONT, fontSize: "18px", color: "#2d4a68",
      })
      .setOrigin(0.5);

    const muteBtn = this.buildMuteButton(cx + 220, verY);

    const w0: FadeTarget[] = [panel];
    const w1: FadeTarget[] = [glow, pengu, rush];
    const w2: FadeTarget[] = [sub, div1, ...badge];
    const w3: FadeTarget[] = [...[jugarBg, jugarTxt], ...como, div2, version, ...muteBtn];

    for (const o of [...w0, ...w1, ...w2, ...w3]) o.setAlpha(0);

    this.tweens.add({ targets: w0, alpha: 1, duration: 380, ease: "Quad.Out" });
    this.tweens.add({ targets: w1, alpha: 1, duration: 420, delay: 130, ease: "Quad.Out" });
    this.tweens.add({ targets: w2, alpha: 1, duration: 360, delay: 270, ease: "Quad.Out" });
    this.tweens.add({ targets: w3, alpha: 1, duration: 360, delay: 400, ease: "Quad.Out" });

    this.setupSuraIntegration();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onSuraEvent) {
        try { getSuraService().unsubscribe(this.onSuraEvent); } catch { /* not initialised */ }
      }
    });
  }

  // ─── SURA integration ────────────────────────────────────────────────────

  private setupSuraIntegration(): void {
    let service: ReturnType<typeof getSuraService>;
    try {
      service = getSuraService();
    } catch {
      return; // standalone fallback
    }
    if (service.mode === "standalone") return;

    // Apply initial state immediately
    this.applySuraState(service.getState());

    this.onSuraEvent = (event: SuraServiceEvent) => {
      if (event.type === "state-changed") {
        this.applySuraState(event.state);
      }
    };
    service.subscribe(this.onSuraEvent);
  }

  private applySuraState(state: SuraIntegrationState): void {
    const isReady = state === "ready";

    // Enable / disable the JUGAR button
    if (this.jugarBg) {
      if (isReady) {
        this.jugarBg.setAlpha(1).setInteractive({ useHandCursor: true });
      } else {
        this.jugarBg.setAlpha(0.45).disableInteractive();
      }
    }
    if (this.jugarText) {
      this.jugarText.setAlpha(isReady ? 1 : 0.5);
    }

    // Status label
    const label = SURA_STATUS[state] ?? "";
    if (this.suraStatusText) {
      this.suraStatusText.setText(label);
      this.suraStatusText.setAlpha(label ? 1 : 0);
      // Colour: error/unauthorized in red, ready in green, others in cyan
      if (state === "error" || state === "unauthorized") {
        this.suraStatusText.setColor("#f87171");
      } else if (state === "ready") {
        this.suraStatusText.setColor("#4ade80");
      } else {
        this.suraStatusText.setColor("#7ec8e3");
      }
    }

    // If an error happened while in "starting" state, reset guard
    if (state === "error" || state === "unauthorized") {
      this.isStartingGame = false;
    }
  }

  // ─── Game launch ─────────────────────────────────────────────────────────

  private startGame(): void {
    if (this.isStartingGame) return;
    this.isStartingGame = true;

    let service: ReturnType<typeof getSuraService> | null = null;
    try { service = getSuraService(); } catch { /* standalone */ }

    if (!service || service.mode === "standalone") {
      this.launchGameScene();
      return;
    }

    // sura / sura-mock: must start the session via the API before opening GameScene
    this.applySuraState("starting");

    service.startGameSession()
      .then((success) => {
        if (!success) {
          this.isStartingGame = false;
          // applySuraState will be called by the subscriber once the service
          // emits the new state (error / unauthorized).
          return;
        }
        this.launchGameScene();
      })
      .catch(() => {
        this.isStartingGame = false;
      });
  }

  private launchGameScene(): void {
    this.runMusicAction("juego", () => MusicManager.playGameMusic(this));
    this.scene.start("GameScene");
  }

  private tryPlayMenuMusic(): void {
    this.runMusicAction("menú", () => MusicManager.playMenuMusic(this));
  }

  private runMusicAction(trackName: string, action: () => unknown): void {
    try {
      void Promise.resolve(action()).catch((error: unknown) => {
        console.warn(`[Music] No se pudo reproducir la música de ${trackName}:`, error);
      });
    } catch (error: unknown) {
      console.warn(`[Music] No se pudo reproducir la música de ${trackName}:`, error);
    }
  }

  // ─── Private builders ────────────────────────────────────────────────────

  private buildStars(w: number, h: number): void {
    const g   = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(["pengu-menu-v1"]);
    for (let i = 0; i < 32; i++) {
      const sz = rnd.pick([1, 1, 1, 2]);
      g.fillStyle(0xffffff, rnd.realInRange(0.12, 0.50));
      g.fillRect(rnd.between(8, w - 8), rnd.between(8, h - 8), sz, sz);
    }
  }

  private buildGlow(cx: number, cy: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    for (const [r, a] of [[210, 0.022], [130, 0.044], [68, 0.072]] as [number, number][]) {
      g.fillStyle(C_CYAN, a);
      g.fillCircle(cx, cy, r);
    }
    return g;
  }

  private buildPanel(cx: number, cy: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const x = cx - PANEL_W / 2;
    const y = cy - PANEL_H / 2;

    g.fillStyle(0x000000, 0.38);
    g.fillRoundedRect(x + 5, y + 9, PANEL_W, PANEL_H, PANEL_R);
    g.fillStyle(C_PANEL, 0.88);
    g.fillRoundedRect(x, y, PANEL_W, PANEL_H, PANEL_R);
    g.lineStyle(1.5, C_CYAN, 0.28);
    g.strokeRoundedRect(x, y, PANEL_W, PANEL_H, PANEL_R);
    g.fillStyle(C_CYAN, 0.14);
    g.fillRoundedRect(x, y, PANEL_W, 4, { tl: PANEL_R, tr: PANEL_R, bl: 0, br: 0 });

    return g;
  }

  private buildPengu(cx: number, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(cx, y, "PENGU", {
        fontFamily: FONT, fontSize: "90px", color: "#ffffff", fontStyle: "bold",
        shadow: { offsetX: 0, offsetY: 3, color: "#000033", blur: 16, fill: true },
      })
      .setOrigin(0.5);
  }

  private buildRush(cx: number, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(cx, y, "RUSH", {
        fontFamily: FONT, fontSize: "90px", color: C_CYAN_HEX, fontStyle: "bold",
        stroke: "#083d4a", strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: C_CYAN_HEX, blur: 22, fill: true },
      })
      .setOrigin(0.5);
  }

  private buildSubtitle(cx: number, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(cx, y, "Esquivá los meteoritos\ny superá tu récord", {
        fontFamily: FONT, fontSize: "26px", color: "#7ec8e3",
        align: "center", lineSpacing: 7,
      })
      .setOrigin(0.5);
  }

  private buildMuteButton(cx: number, cy: number): FadeTarget[] {
    const bw = 108, bh = 30, r = 5;

    const bg  = this.add.graphics();
    const lbl = this.add.text(cx, cy, "", { fontFamily: FONT, fontSize: "14px" }).setOrigin(0.5);
    const hit = this.add.rectangle(cx, cy, bw, bh, 0x000000, 0).setInteractive({ useHandCursor: true });

    const draw = (alpha: number) => {
      bg.clear();
      bg.fillStyle(0x1e3a5f, alpha);
      bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, r);
      bg.lineStyle(1, 0x4a7fa5, 0.45);
      bg.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, r);
    };
    const sync = (muted: boolean) => {
      lbl.setText(muted ? "♪  OFF" : "♪  ON");
      lbl.setColor(muted ? "#475569" : "#94a3b8");
    };

    draw(0.65);
    sync(MusicManager.isMuted);

    hit.on("pointerover",  () => draw(0.9));
    hit.on("pointerout",   () => draw(0.65));
    hit.on("pointerdown",  () => { sync(MusicManager.toggleMute()); draw(0.65); });

    return [bg, lbl, hit];
  }

  private buildDivider(cx: number, y: number, w: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(1, C_CYAN, 0.18);
    g.beginPath();
    g.moveTo(cx - w / 2, y);
    g.lineTo(cx + w / 2, y);
    g.strokePath();
    return g;
  }

  private buildBadge(cx: number, cy: number, score: number): FadeTarget[] {
    const bw = 500, bh = 82;

    const g = this.add.graphics();
    g.fillStyle(C_BADGE, 1);
    g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);
    g.lineStyle(1, C_GOLD, 0.42);
    g.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);

    const label = this.add
      .text(cx, cy - 14, "★  Récord personal", {
        fontFamily: FONT, fontSize: "19px", color: C_GOLD_HEX,
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(cx, cy + 17, `${score}`, {
        fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "bold",
      })
      .setOrigin(0.5);

    return [g, label, scoreText];
  }

  private buildButton(
    cx: number, cy: number,
    w: number, h: number,
    label: string,
    bgColor: number,
    fontSize: string,
    borderColor: number,
    borderAlpha: number,
    hoverScale: number,
    hoverAlpha: number,
    onClick: () => void,
  ): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
    const { bg, text } = createButton({
      scene: this, x: cx, y: cy, width: w, height: h,
      label, bgColor, fontSize,
      onClick: () => {},
    });

    bg.setStrokeStyle(2, borderColor, borderAlpha);
    bg.setInteractive({ useHandCursor: true });

    bg.removeAllListeners("pointerover");
    bg.removeAllListeners("pointerout");
    bg.removeAllListeners("pointerdown");

    bg.on("pointerover", () => {
      bg.setAlpha(hoverAlpha).setScale(hoverScale);
      text.setScale(hoverScale);
    });
    bg.on("pointerout", () => {
      bg.setAlpha(1).setScale(1);
      text.setScale(1);
    });
    bg.on("pointerdown", () => {
      SoundEffectsManager.play(this, "sfx-click");
      bg.setScale(0.97);
      text.setScale(0.97);
      onClick();
    });

    return [bg, text];
  }
}
