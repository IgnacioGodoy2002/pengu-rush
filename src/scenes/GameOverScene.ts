import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { COLORS, FONT } from "../constants/theme";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";

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
        fontFamily: FONT,
        fontSize: "48px",
        color: COLORS.white,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 385, `RÉCORD: ${bestScore}`, {
        fontFamily: FONT,
        fontSize: "30px",
        color: isNewRecord ? COLORS.green : COLORS.muted,
      })
      .setOrigin(0.5);

    // "¡NUEVO RÉCORD!" shown only on strict improvement; empate no cuenta.
    if (isNewRecord) {
      SoundEffectsManager.play(this, "sfx-new-record");
      const newRec = this.add
        .text(cx, 450, "¡NUEVO RÉCORD!", {
          fontFamily: FONT,
          fontSize: "36px",
          color: COLORS.accent,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets:  newRec,
        scaleX:   { from: 0.82, to: 1 },
        scaleY:   { from: 0.82, to: 1 },
        duration: 450,
        ease:     "Back.Out",
      });
    }

    this.addDivider(cx, 515, 540);

    // ── Secondary stats ────────────────────────────────────────────────────
    const statStyle = { fontFamily: FONT, fontSize: "30px", color: COLORS.muted };

    this.add.text(cx, 578, `TIEMPO: ${formatTime(survivedMs)}`, statStyle).setOrigin(0.5);
    this.add.text(cx, 645, `DESTRUIDOS: ${meteorsDestroyed}`,   statStyle).setOrigin(0.5);
    this.add.text(cx, 712, `NIVEL: ${level}`,                   statStyle).setOrigin(0.5);

    this.addDivider(cx, 776, 540);

    // ── Buttons ────────────────────────────────────────────────────────────
    // pointerdown on buttons does not propagate to movement because GameScene
    // is fully stopped by scene.start() before GameOverScene runs, and the
    // new GameScene ignores pointer events until the countdown ends.
    createButton({
      scene:   this,
      x:       cx,
      y:       858,
      width:   440,
      height:  84,
      label:   "JUGAR DE NUEVO",
      bgColor: COLORS.btnPrimary,
      fontSize: "32px",
      onClick: () => this.scene.start("GameScene"),
    });

    createButton({
      scene:   this,
      x:       cx,
      y:       972,
      width:   440,
      height:  84,
      label:   "MENÚ",
      bgColor: COLORS.btnSecondary,
      fontSize: "32px",
      onClick: () => this.scene.start("MenuScene"),
    });
  }

  private addDivider(cx: number, y: number, w: number): void {
    this.add.rectangle(cx, y, w, 2, COLORS.border);
  }
}
