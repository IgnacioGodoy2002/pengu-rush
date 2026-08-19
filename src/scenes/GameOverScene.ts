import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { COLORS, FONT } from "../constants/theme";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";
import { getSuraService } from "../integration/sura/SuraIntegrationService";
import type { SuraIntegrationState, SuraServiceEvent, SuraServiceListener } from "../integration/sura/SuraTypes";
import { LOCAL_SURA_REWARD_CONFIG, calcSuraPoints } from "../config/suraRewardConfig";
import { t } from "../i18n";

interface GameOverData {
  score:            number;
  prevBestScore:    number;
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
    score: 0, prevBestScore: 0, bestScore: 0, level: 1,
    survivedMs: 0, meteorsDestroyed: 0, isNewRecord: false,
  };

  // SURA score-submission tracking
  private sendStatusText: Phaser.GameObjects.Text | null = null;
  private retryBtn: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } | null = null;
  private onSuraEvent: SuraServiceListener | null = null;

  // Buttons created by buildActionButtons — disabled while reward popup is open.
  private actionBtnRefs: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("GameOverScene");
  }

  init(data: Partial<GameOverData>): void {
    this.data_ = {
      score:            data.score            ?? 0,
      prevBestScore:    data.prevBestScore    ?? 0,
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
    this.actionBtnRefs  = [];

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
      .text(cx, 160, t("gameover_title"), {
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
      .text(cx, 310, t("gameover_score", { score }), {
        fontFamily: FONT, fontSize: "48px", color: COLORS.white, fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 385, t("gameover_record", { record: bestScore }), {
        fontFamily: FONT,
        fontSize: "30px",
        color: isNewRecord ? COLORS.green : COLORS.muted,
      })
      .setOrigin(0.5);

    if (isNewRecord) {
      SoundEffectsManager.play(this, "sfx-new-record");
      const newRec = this.add
        .text(cx, 450, t("gameover_new_record"), {
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
    this.add.text(cx, 578, t("gameover_time",      { time:  formatTime(survivedMs) }), statStyle).setOrigin(0.5);
    this.add.text(cx, 645, t("gameover_destroyed", { count: meteorsDestroyed }),        statStyle).setOrigin(0.5);

    this.addDivider(cx, 776, 540);

    // ── SURA score submission status (visible only in sura/sura-mock) ──────
    this.sendStatusText = this.add
      .text(cx, 818, "", { fontFamily: FONT, fontSize: "20px", color: "#7ec8e3" })
      .setOrigin(0.5)
      .setAlpha(0);

    // ── Retry button (no-op in parent-submit, kept hidden) ─────────────────
    const retryBtnObj = createButton({
      scene: this, x: cx, y: 855, width: 260, height: 44,
      label: "REINTENTAR", bgColor: 0x7c3aed, fontSize: "22px",
      onClick: () => this.retrySend(),
    });
    retryBtnObj.bg.setAlpha(0).disableInteractive();
    retryBtnObj.text.setAlpha(0);
    this.retryBtn = retryBtnObj;

    // ── Action buttons — disabled until reward popup is dismissed ──────────
    this.buildActionButtons(cx);

    // ── SURA integration ───────────────────────────────────────────────────
    this.setupSuraIntegration(score, level, survivedMs, meteorsDestroyed);

    // ── Reward popup (shown on top; enables action buttons on dismiss) ─────
    this.showRewardPopup(score);

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
        // In sura-mock: when a new session arrives, auto-return to MenuScene.
        if (event.state === "ready") {
          this.scene.start("MenuScene");
        }
      }
    };
    service.subscribe(this.onSuraEvent);

    // Show initial status based on current state
    this.updateSendStatus(service.getState());

    // Send MINIGAME_COMPLETED via postMessage.
    // estimatedSuraPoints is a local preview — SURA backend is authoritative.
    void service.completeGameSession({
      score,
      level,
      survivedMs,
      meteorsDestroyed,
      isNewRecord:         this.data_.isNewRecord,
      estimatedSuraPoints: calcSuraPoints(score, this.data_.prevBestScore),
      rewardScoreUnit:     LOCAL_SURA_REWARD_CONFIG.scoreUnit,
      rewardPointsPerUnit: LOCAL_SURA_REWARD_CONFIG.pointsPerUnit,
    });
  }

  private retrySend(): void {
    // No-op in parent-submit: score is sent via postMessage in completeGameSession.
  }

  private updateSendStatus(state: SuraIntegrationState): void {
    if (!this.sendStatusText) return;

    type StatusCfg = { label: string; color: string; showRetry: boolean };
    const STATUS: Partial<Record<SuraIntegrationState, StatusCfg>> = {
      "completed":  { label: t("gameover_sura_sent"),  color: "#4ade80", showRetry: false },
      "error":      { label: t("gameover_sura_error"), color: "#f87171", showRetry: false },
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

  // ─── Reward popup ─────────────────────────────────────────────────────────

  private showRewardPopup(score: number): void {
    if (!LOCAL_SURA_REWARD_CONFIG.popupEnabled) {
      this.enableActionButtons();
      return;
    }

    const suraPoints = calcSuraPoints(score, this.data_.prevBestScore);
    const { width, height } = this.scale;
    const cx = width  / 2;
    const cy = height / 2;

    const PANEL_W    = 620;
    const PANEL_H    = 430;
    const PANEL_R    = 20;
    const BASE_DEPTH = 10;

    const toDestroy:    Phaser.GameObjects.GameObject[] = [];
    const slideTargets: Phaser.GameObjects.Text[]       = [];
    const loopTweens:   Phaser.Tweens.Tween[]           = [];

    // Registers a text for the slide-up entrance and adds it to toDestroy.
    const addText = (t: Phaser.GameObjects.Text): Phaser.GameObjects.Text => {
      t.y += 14;
      slideTargets.push(t);
      toDestroy.push(t);
      return t;
    };

    // ── Overlay ───────────────────────────────────────────────────────────────
    // fillAlpha controls the final visual opacity so the game-object alpha can
    // be tweened from 0 → 1 without making the overlay fully opaque.
    toDestroy.push(
      this.add.rectangle(cx, cy, width, height, 0x000000, 0.72)
        .setDepth(BASE_DEPTH)
        .setInteractive(),   // absorbs clicks so disabled action buttons stay blocked
    );

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panelG = this.add.graphics().setDepth(BASE_DEPTH + 1);
    const px = cx - PANEL_W / 2;
    const py = cy - PANEL_H / 2;

    // Soft outer glow halo
    panelG.fillStyle(0x22d3ee, 0.07);
    panelG.fillRoundedRect(px - 4, py - 4, PANEL_W + 8, PANEL_H + 8, PANEL_R + 3);
    // Drop shadow
    panelG.fillStyle(0x000000, 0.6);
    panelG.fillRoundedRect(px + 7, py + 11, PANEL_W, PANEL_H, PANEL_R);
    // Body — deep navy
    panelG.fillStyle(0x061020, 1);
    panelG.fillRoundedRect(px, py, PANEL_W, PANEL_H, PANEL_R);
    // Top accent bar
    panelG.fillStyle(0x22d3ee, 0.9);
    panelG.fillRoundedRect(px, py, PANEL_W, 6, { tl: PANEL_R, tr: PANEL_R, bl: 0, br: 0 });
    // White shimmer on the accent bar
    panelG.fillStyle(0xffffff, 0.22);
    panelG.fillRoundedRect(px + 2, py + 1, PANEL_W - 4, 2, 1);
    // Border
    panelG.lineStyle(2, 0x22d3ee, 0.8);
    panelG.strokeRoundedRect(px, py, PANEL_W, PANEL_H, PANEL_R);
    // Corner ornaments
    const CO = 12, CS = 5;
    const CORNERS: [number, number][] = [
      [px + CO, py + CO], [px + PANEL_W - CO, py + CO],
      [px + CO, py + PANEL_H - CO], [px + PANEL_W - CO, py + PANEL_H - CO],
    ];
    panelG.fillStyle(0x22d3ee, 0.85);
    CORNERS.forEach(([ox, oy]) => panelG.fillRect(ox - CS / 2, oy - CS / 2, CS, CS));

    toDestroy.push(panelG);

    const D = BASE_DEPTH + 2;

    if (suraPoints > 0) {
      // ── Winner branch ──────────────────────────────────────────────────────

      // Small elegant label
      addText(
        this.add.text(cx, cy - 155, t("popup_winner_title"), {
          fontFamily: FONT, fontSize: "26px", color: "#22d3ee", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(D),
      );

      // Decorative gold stars
      addText(
        this.add.text(cx, cy - 112, t("popup_winner_stars"), {
          fontFamily: FONT, fontSize: "18px", color: "#f59e0b",
        }).setOrigin(0.5).setDepth(D),
      );

      // Hero: points value
      const pointsText = this.add.text(
        cx, cy - 52,
        `${suraPoints} ${LOCAL_SURA_REWARD_CONFIG.currencyLabel}`,
        {
          fontFamily: FONT, fontSize: "60px", color: "#f59e0b", fontStyle: "bold",
          shadow: { offsetX: 0, offsetY: 0, color: "#f59e0b", blur: 30, fill: true },
          stroke: "#7c3000", strokeThickness: 3,
        },
      ).setOrigin(0.5).setDepth(D);
      addText(pointsText);

      // Thin separator
      const divG = this.add.graphics().setDepth(D);
      divG.lineStyle(1, 0x22d3ee, 0.3);
      divG.lineBetween(cx - 200, cy + 18, cx + 200, cy + 18);
      toDestroy.push(divG);

      // Secondary: score
      addText(
        this.add.text(cx, cy + 50, t("popup_winner_score", { score }), {
          fontFamily: FONT, fontSize: "24px", color: "#7ec8e3",
        }).setOrigin(0.5).setDepth(D),
      );

      // Subtle pulse on the hero text — stopped explicitly before destroy
      loopTweens.push(
        this.tweens.add({
          targets: pointsText, scaleX: 1.035, scaleY: 1.035,
          duration: 1000, ease: "Sine.InOut", yoyo: true, repeat: -1, delay: 400,
        }),
      );

    } else {
      // ── No-points branch ───────────────────────────────────────────────────

      // Title line 1: neutral
      addText(
        this.add.text(cx, cy - 128, t("popup_loser_title"), {
          fontFamily: FONT, fontSize: "36px", color: COLORS.white, fontStyle: "bold",
        }).setOrigin(0.5).setDepth(D),
      );

      // Title line 2: "SURA POINTS" in cyan — acts as visual focus
      addText(
        this.add.text(cx, cy - 78, t("popup_loser_brand"), {
          fontFamily: FONT, fontSize: "42px", color: "#22d3ee", fontStyle: "bold",
          shadow: { offsetX: 0, offsetY: 0, color: "#22d3ee", blur: 18, fill: true },
        }).setOrigin(0.5).setDepth(D),
      );

      // Thin separator
      const divG = this.add.graphics().setDepth(D);
      divG.lineStyle(1, 0x22d3ee, 0.25);
      divG.lineBetween(cx - 220, cy - 22, cx + 220, cy - 22);
      toDestroy.push(divG);

      // Hint line 1: descriptive, muted
      addText(
        this.add.text(cx, cy + 18, t("popup_loser_hint", { scoreUnit: LOCAL_SURA_REWARD_CONFIG.scoreUnit }), {
          fontFamily: FONT, fontSize: "22px", color: "#94a3b8",
        }).setOrigin(0.5).setDepth(D),
      );

      // Hint line 2: conversion value — gold accent
      addText(
        this.add.text(
          cx, cy + 58,
          `${LOCAL_SURA_REWARD_CONFIG.pointsPerUnit} ${LOCAL_SURA_REWARD_CONFIG.currencyLabel}`,
          { fontFamily: FONT, fontSize: "30px", color: "#f59e0b", fontStyle: "bold" },
        ).setOrigin(0.5).setDepth(D),
      );
    }

    // ── CONTINUAR button ───────────────────────────────────────────────────────
    const btn = createButton({
      scene: this, x: cx, y: cy + 150, width: 480, height: 88,
      label: t("popup_continue"), bgColor: 0x0891b2, fontSize: "32px",
      depth: BASE_DEPTH + 3,
      onClick: () => {
        for (const tw of loopTweens) tw.stop();
        for (const obj of toDestroy) obj.destroy();
        this.enableActionButtons();
      },
    });
    toDestroy.push(btn.bg, btn.text);

    // ── Entrance animation ─────────────────────────────────────────────────────
    for (const obj of toDestroy) {
      (obj as unknown as { setAlpha(v: number): void }).setAlpha(0);
    }
    // Fade everything in
    this.tweens.add({ targets: toDestroy, alpha: 1, duration: 300, ease: "Quad.Out" });
    // Slide text elements up slightly
    if (slideTargets.length > 0) {
      this.tweens.add({ targets: slideTargets, y: "-=14", duration: 320, ease: "Quad.Out" });
    }
  }

  private enableActionButtons(): void {
    for (const bg of this.actionBtnRefs) {
      bg.setInteractive({ useHandCursor: true });
    }
  }

  // ─── Action buttons per mode ──────────────────────────────────────────────

  private buildActionButtons(cx: number): void {
    let mode = "standalone";
    try { mode = getSuraService().mode; } catch { /* standalone */ }
    this.actionBtnRefs = [];

    // Register helper: disables the button immediately and stores the ref
    // so enableActionButtons() can re-enable it after the popup is dismissed.
    const reg = (btn: { bg: Phaser.GameObjects.Rectangle }) => {
      btn.bg.disableInteractive();
      this.actionBtnRefs.push(btn.bg);
    };

    if (mode === "sura") {
      reg(createButton({
        scene: this, x: cx, y: 900, width: 440, height: 84,
        label: t("gameover_back_sura"), bgColor: COLORS.btnPrimary, fontSize: "30px",
        onClick: () => {
          try { getSuraService().requestExit(); } catch { /* ok */ }
        },
      }));
      reg(createButton({
        scene: this, x: cx, y: 1004, width: 440, height: 84,
        label: t("gameover_menu"), bgColor: COLORS.btnSecondary, fontSize: "32px",
        onClick: () => this.scene.start("MenuScene"),
      }));
      return;
    }

    if (mode === "sura-mock") {
      this.add
        .text(cx, 900, t("gameover_mock_hint"), {
          fontFamily: FONT, fontSize: "22px", color: COLORS.muted,
          align: "center", lineSpacing: 5,
        })
        .setOrigin(0.5);
      reg(createButton({
        scene: this, x: cx, y: 1004, width: 440, height: 84,
        label: t("gameover_menu"), bgColor: COLORS.btnSecondary, fontSize: "32px",
        onClick: () => this.scene.start("MenuScene"),
      }));
      return;
    }

    // Standalone: original behaviour.
    reg(createButton({
      scene: this, x: cx, y: 858, width: 440, height: 84,
      label: t("gameover_play_again"), bgColor: COLORS.btnPrimary, fontSize: "32px",
      onClick: () => this.scene.start("GameScene"),
    }));
    reg(createButton({
      scene: this, x: cx, y: 972, width: 440, height: 84,
      label: t("gameover_menu"), bgColor: COLORS.btnSecondary, fontSize: "32px",
      onClick: () => this.scene.start("MenuScene"),
    }));
  }

  private addDivider(cx: number, y: number, w: number): void {
    this.add.rectangle(cx, y, w, 2, COLORS.border);
  }
}
