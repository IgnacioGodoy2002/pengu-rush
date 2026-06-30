import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { COLORS, FONT } from "../constants/theme";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";
import { getSuraService } from "../integration/sura/SuraIntegrationService";
import type { SuraIntegrationState, SuraServiceEvent, SuraServiceListener } from "../integration/sura/SuraTypes";

interface GameOverData {
  score:            number;
  bestScore:        number;
  level:            number;
  survivedMs:       number;
  meteorsDestroyed: number;
  isNewRecord:      boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export class GameOverScene extends Phaser.Scene {
  private data_: GameOverData = {
    score: 0, bestScore: 0, level: 1,
    survivedMs: 0, meteorsDestroyed: 0, isNewRecord: false,
  };

  // SURA score-submission tracking
  private sendStatusText: Phaser.GameObjects.Text | null = null;
  private retryBtn: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } | null = null;
  private onSuraEvent: SuraServiceListener | null = null;

  constructor() {
    super("GameOverScene");
  }

  init(data: Partial<GameOverData>): void {
    this.data_ = {
      score:            data.score            ?? 0,
      bestScore:        data.bestScore        ?? 0,
      level:            data.level            ?? 1,
      survivedMs:       data.survivedMs       ?? 0,
      meteorsDestroyed: data.meteorsDestroyed ?? 0,
      isNewRecord:      data.isNewRecord      ?? false,
    };
  }

  create(): void {
    this.sendStatusText = null;
    this.retryBtn       = null;
    this.onSuraEvent    = null;

    MusicManager.stopAll();

    const { width, height } = this.scale;
    const cx = width / 2;
    const { score, bestScore, level, survivedMs, meteorsDestroyed, isNewRecord } = this.data_;

    this.cameras.main.setBackgroundColor(COLORS.bgHex);

    // ── Panel ──────────────────────────────────────────────────────────────
    this.add
      .rectangle(cx, height / 2, width - 80, height - 160, COLORS.surface)
      .setStrokeStyle(1, COLORS.border, 1);

    // ── Title ──────────────────────────────────────────────────────────────
    this.add
      .text(cx, 160, "GAME OVER", {
        fontFamily: FONT,
        fontSize: "68px",
        color: COLORS.white,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 4, color: "#000000", blur: 16, fill: true },
      })
      .setOrigin(0.5);

    this.addDivider(cx, 240, 540);

    // ── Primary score block ────────────────────────────────────────────────
    this.add
      .text(cx, 310, `PUNTAJE: ${score}`, {
        fontFamily: FONT, fontSize: "48px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 385, `RÉCORD: ${bestScore}`, {
        fontFamily: FONT,
        fontSize: "30px",
        color: isNewRecord ? COLORS.green : COLORS.muted,
      })
      .setOrigin(0.5);

    if (isNewRecord) {
      SoundEffectsManager.play(this, "sfx-new-record");
      const newRec = this.add
        .text(cx, 450, "¡NUEVO RÉCORD!", {
          fontFamily: FONT, fontSize: "36px", color: COLORS.accent, fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: newRec, scaleX: { from: 0.82, to: 1 }, scaleY: { from: 0.82, to: 1 },
        duration: 450, ease: "Back.Out",
      });
    }

    this.addDivider(cx, 515, 540);

    // ── Secondary stats ────────────────────────────────────────────────────
    const statStyle = { fontFamily: FONT, fontSize: "30px", color: COLORS.muted };
    this.add.text(cx, 578, `TIEMPO: ${formatTime(survivedMs)}`, statStyle).setOrigin(0.5);
    this.add.text(cx, 645, `DESTRUIDOS: ${meteorsDestroyed}`,   statStyle).setOrigin(0.5);
    this.add.text(cx, 712, `NIVEL: ${level}`,                   statStyle).setOrigin(0.5);

    this.addDivider(cx, 776, 540);

    // ── SURA score submission status (visible only in sura/sura-mock) ──────
    this.sendStatusText = this.add
      .text(cx, 818, "", { fontFamily: FONT, fontSize: "20px", color: "#7ec8e3" })
      .setOrigin(0.5)
      .setAlpha(0);

    // ── Retry button (shown on send error, hidden otherwise) ───────────────
    const retryBtnObj = createButton({
      scene: this, x: cx, y: 855, width: 260, height: 44,
      label: "REINTENTAR", bgColor: 0x7c3aed, fontSize: "22px",
      onClick: () => this.retrySend(),
    });
    retryBtnObj.bg.setAlpha(0).disableInteractive();
    retryBtnObj.text.setAlpha(0);
    this.retryBtn = retryBtnObj;

    // ── Buttons ────────────────────────────────────────────────────────────
    this.buildActionButtons(cx);

    // ── SURA integration ───────────────────────────────────────────────────
    this.setupSuraIntegration(score, level, survivedMs, meteorsDestroyed);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onSuraEvent) {
        try { getSuraService().unsubscribe(this.onSuraEvent); } catch { /* ok */ }
        this.onSuraEvent = null;
      }
    });
  }

  // ─── SURA integration ─────────────────────────────────────────────────────

  private setupSuraIntegration(
    score: number,
    level: number,
    survivedMs: number,
    meteorsDestroyed: number,
  ): void {
    let service: ReturnType<typeof getSuraService>;
    try {
      service = getSuraService();
    } catch {
      return;
    }
    if (service.mode === "standalone") return;

    // Subscribe to state changes so we can update the send-status label.
    this.onSuraEvent = (event: SuraServiceEvent) => {
      if (event.type === "state-changed") {
        this.updateSendStatus(event.state);
        // In sura-mock: when a new session arrives and is validated, auto-return
        // to MenuScene so the user can play again.
        if (event.state === "ready") {
          this.scene.start("MenuScene");
        }
      }
    };
    service.subscribe(this.onSuraEvent);

    // Show initial status based on current state
    this.updateSendStatus(service.getState());

    // Trigger the API call to record the result
    void service.completeGameSession({ score, level, survivedMs, meteorsDestroyed });
  }

  private retrySend(): void {
    let service: ReturnType<typeof getSuraService>;
    try { service = getSuraService(); } catch { return; }
    void service.retryCompleteSession();
  }

  private updateSendStatus(state: SuraIntegrationState): void {
    if (!this.sendStatusText) return;

    type StatusCfg = { label: string; color: string; showRetry: boolean };
    const STATUS: Partial<Record<SuraIntegrationState, StatusCfg>> = {
      "playing":    { label: "Enviando resultado...",     color: "#7ec8e3", showRetry: false },
      "completing": { label: "Enviando resultado...",     color: "#7ec8e3", showRetry: false },
      "completed":  { label: "Resultado registrado ✓",   color: "#4ade80", showRetry: false },
      "error":      { label: "No se pudo enviar el resultado.", color: "#f87171", showRetry: true },
    };

    const cfg = STATUS[state];
    if (!cfg) {
      this.sendStatusText.setAlpha(0);
      return;
    }

    this.sendStatusText.setText(cfg.label).setColor(cfg.color).setAlpha(1);

    if (this.retryBtn) {
      const alpha = cfg.showRetry ? 1 : 0;
      this.retryBtn.bg.setAlpha(alpha);
      this.retryBtn.text.setAlpha(alpha);
      if (cfg.showRetry) {
        this.retryBtn.bg.setInteractive({ useHandCursor: true });
      } else {
        this.retryBtn.bg.disableInteractive();
      }
    }
  }

  // ─── Action buttons per mode ──────────────────────────────────────────────

  private buildActionButtons(cx: number): void {
    let mode = "standalone";
    try { mode = getSuraService().mode; } catch { /* standalone */ }

    if (mode === "sura") {
      // In real sura mode: player exits back to the SURA app after finishing.
      createButton({
        scene: this, x: cx, y: 900, width: 440, height: 84,
        label: "VOLVER A SURA", bgColor: COLORS.btnPrimary, fontSize: "30px",
        onClick: () => {
          try { getSuraService().requestExit(); } catch { /* ok */ }
        },
      });
      createButton({
        scene: this, x: cx, y: 1004, width: 440, height: 84,
        label: "MENÚ", bgColor: COLORS.btnSecondary, fontSize: "32px",
        onClick: () => this.scene.start("MenuScene"),
      });
      return;
    }

    if (mode === "sura-mock") {
      // In mock mode: JUGAR DE NUEVO is replaced by an informational text.
      // A new session must arrive from the host (auto-navigates when ready).
      this.add
        .text(cx, 900, "Iniciá una nueva sesión\ndesde el host de prueba", {
          fontFamily: FONT, fontSize: "22px", color: COLORS.muted,
          align: "center", lineSpacing: 5,
        })
        .setOrigin(0.5);
      createButton({
        scene: this, x: cx, y: 1004, width: 440, height: 84,
        label: "MENÚ", bgColor: COLORS.btnSecondary, fontSize: "32px",
        onClick: () => this.scene.start("MenuScene"),
      });
      return;
    }

    // Standalone: original behaviour.
    createButton({
      scene: this, x: cx, y: 858, width: 440, height: 84,
      label: "JUGAR DE NUEVO", bgColor: COLORS.btnPrimary, fontSize: "32px",
      onClick: () => this.scene.start("GameScene"),
    });
    createButton({
      scene: this, x: cx, y: 972, width: 440, height: 84,
      label: "MENÚ", bgColor: COLORS.btnSecondary, fontSize: "32px",
      onClick: () => this.scene.start("MenuScene"),
    });
  }

  private addDivider(cx: number, y: number, w: number): void {
    this.add.rectangle(cx, y, w, 2, COLORS.border);
  }
}
