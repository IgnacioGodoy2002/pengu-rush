import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { FONT } from "../constants/theme";
import { RecordsService } from "../services/RecordsService";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";
import { getSuraService } from "../integration/sura/SuraIntegrationService";
import type { SuraIntegrationState, SuraServiceEvent } from "../integration/sura/SuraTypes";
import { t, I18nService } from "../i18n";
import type { Locale, TranslationKey } from "../i18n";
import { fetchLeaderboard } from "../services/LeaderboardService";
import type { LeaderboardEntry } from "../services/LeaderboardService";

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
const PANEL_W = 664;
const PANEL_H = 1224;
const PANEL_R = 18;

type FadeTarget =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Rectangle;

// ─── SURA status translation key per state ────────────────────────────────────
const SURA_STATUS_KEY: Partial<Record<SuraIntegrationState, TranslationKey>> = {
  "waiting-context": "sura_waiting",
  "validating":      "sura_validating",
  "ready":           "sura_ready",
  "starting":        "sura_starting",
  "unauthorized":    "sura_unauthorized",
  "error":           "sura_error",
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
    const panelCY = height / 2;
    const top     = panelCY - PANEL_H / 2;

    this.cameras.main.setBackgroundColor(C_BG_HEX);
    this.tryPlayMenuMusic();

    this.buildStars(width, height);

    const panel = this.buildPanel(cx, panelCY);
    const glow  = this.buildGlow(cx, top + 182);

    const titleY       = top + 138;
    const rushY        = titleY      + 118;
    const subY         = rushY       + 126;
    const div1Y        = subY        + 78;
    const badgeY       = div1Y       + 82;
    const jugarY       = badgeY      + 156;
    const comoY        = jugarY      + 135;
    const top3DivY     = comoY       + 66;
    const top3RowY0    = top3DivY    + 28;
    const TOP3_SPACING = 30;
    const rankBtnY     = top3RowY0   + 2 * TOP3_SPACING + 48;
    const div2Y        = rankBtnY    + 58;
    const langY        = div2Y       + 32;
    const verY         = langY       + 40;

    const pengu = this.buildPengu(cx, titleY);
    const rush  = this.buildRush(cx, rushY);
    const sub   = this.buildSubtitle(cx, subY, t("menu_subtitle"));
    const div1  = this.buildDivider(cx, div1Y, 580);

    const { bestScore } = RecordsService.load();
    const badge = this.buildBadge(cx, badgeY, bestScore, t("menu_record_label"));

    const [jugarBg, jugarTxt] = this.buildButton(
      cx, jugarY, 570, 108, t("menu_play"), C_JUGAR, "38px",
      C_CYAN, 0.85, 1.035, 0.87,
      () => this.startGame(),
    );
    this.jugarBg   = jugarBg;
    this.jugarText = jugarTxt;

    const como = this.buildButton(
      cx, comoY, 570, 96, t("menu_how_to_play"), C_COMO, "30px",
      C_COMO_BORD, 0.65, 1.025, 0.75,
      () => this.scene.start("InstructionsScene"),
    );

    // SURA status text (visible only in sura / sura-mock modes)
    this.suraStatusText = this.add
      .text(cx, jugarY + 66, "", {
        fontFamily: FONT, fontSize: "19px", color: "#7ec8e3",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(1);

    const { targets: lbTargets, populate } = this.buildLeaderboard(
      cx, top3DivY, top3RowY0, TOP3_SPACING,
    );
    fetchLeaderboard().then(populate).catch(() => {});

    const rankBg = this.add
      .rectangle(cx, rankBtnY, 390, 52, 0x08142b, 1)
      .setStrokeStyle(1.5, C_CYAN, 0.35)
      .setInteractive({ useHandCursor: true });
    const rankTxt = this.add
      .text(cx, rankBtnY, t("leaderboard_view_ranking"), {
        fontFamily: FONT, fontSize: "24px", color: C_CYAN_HEX,
      })
      .setOrigin(0.5);
    rankBg.on("pointerover",  () => rankBg.setStrokeStyle(1.5, C_CYAN, 0.75));
    rankBg.on("pointerout",   () => rankBg.setStrokeStyle(1.5, C_CYAN, 0.35));
    rankBg.on("pointerdown",  () => {
      SoundEffectsManager.play(this, "sfx-click");
      this.scene.start("LeaderboardScene");
    });

    const div2      = this.buildDivider(cx, div2Y, 490);
    const langChips = this.buildLangChips(cx, langY);
    const version = this.add
      .text(cx, verY, t("menu_version"), {
        fontFamily: FONT, fontSize: "18px", color: "#2d4a68",
      })
      .setOrigin(0.5);

    const muteBtn = this.buildMuteButton(cx + 250, verY);

    const w0: FadeTarget[] = [panel];
    const w1: FadeTarget[] = [glow, pengu, rush];
    const w2: FadeTarget[] = [sub, div1, ...badge];
    const w3: FadeTarget[] = [...[jugarBg, jugarTxt], ...como, ...lbTargets, rankBg, rankTxt, div2, ...langChips, version, ...muteBtn];

    for (const o of [...w0, ...w1, ...w2, ...w3]) o.setAlpha(0);

    this.tweens.add({ targets: w0, alpha: 1, duration: 380, ease: "Quad.Out" });
    this.tweens.add({ targets: w1, alpha: 1, duration: 420, delay: 130, ease: "Quad.Out" });
    this.tweens.add({ targets: w2, alpha: 1, duration: 360, delay: 270, ease: "Quad.Out" });
    this.tweens.add({
      targets: w3, alpha: 1, duration: 360, delay: 400, ease: "Quad.Out",
      onComplete: () => { if (import.meta.env.DEV) (window as any).__penguSceneReady__ = true; },
    });

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
    const stateKey = SURA_STATUS_KEY[state];
    const label = stateKey ? t(stateKey) : "";
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

  private buildSubtitle(cx: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(cx, y, text, {
        fontFamily: FONT, fontSize: "32px", color: "#7ec8e3",
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

  private buildBadge(cx: number, cy: number, score: number, badgeLabel: string): FadeTarget[] {
    const bw = 570, bh = 96;

    const g = this.add.graphics();
    g.fillStyle(C_BADGE, 1);
    g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);
    g.lineStyle(1, C_GOLD, 0.42);
    g.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);

    const label = this.add
      .text(cx, cy - 17, badgeLabel, {
        fontFamily: FONT, fontSize: "19px", color: C_GOLD_HEX,
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(cx, cy + 20, `${score}`, {
        fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "bold",
      })
      .setOrigin(0.5);

    return [g, label, scoreText];
  }

  private buildLangChips(cx: number, cy: number): FadeTarget[] {
    const locales: Locale[]            = ["es", "en", "pt"];
    const labels: Record<Locale, string> = { es: "ES", en: "EN", pt: "PT" };
    const chipW  = 52, chipH = 26, gap = 8, r = 4;
    const totalW = locales.length * chipW + (locales.length - 1) * gap;
    const result: FadeTarget[] = [];
    let x        = cx - totalW / 2;
    const current = I18nService.getLocale();

    for (const locale of locales) {
      const isActive = locale === current;
      const kx       = x + chipW / 2;

      const bg = this.add.graphics();
      bg.fillStyle(isActive ? C_JUGAR : 0x1e3a5f, 1);
      bg.fillRoundedRect(kx - chipW / 2, cy - chipH / 2, chipW, chipH, r);
      bg.lineStyle(1.5, isActive ? C_CYAN : 0x4a7fa5, isActive ? 0.8 : 0.4);
      bg.strokeRoundedRect(kx - chipW / 2, cy - chipH / 2, chipW, chipH, r);

      const txt = this.add
        .text(kx, cy, labels[locale], {
          fontFamily: FONT, fontSize: "14px",
          color:      isActive ? C_CYAN_HEX : "#3d5a78",
          fontStyle:  isActive ? "bold" : "normal",
        })
        .setOrigin(0.5);

      const hit = this.add
        .rectangle(kx, cy, chipW, chipH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hit.on("pointerdown", () => {
        if (I18nService.getLocale() === locale) return;
        I18nService.setLocale(locale);
        this.scene.restart();
      });

      result.push(bg, txt, hit);
      x += chipW + gap;
    }
    return result;
  }

  private buildLeaderboard(
    cx: number,
    divY: number,
    rowStartY: number,
    rowSpacing: number,
  ): { targets: FadeTarget[]; populate: (entries: LeaderboardEntry[]) => void } {
    const rowCount = 3;
    const targets: FadeTarget[] = [];

    targets.push(this.buildDivider(cx, divY, 490));

    const rowBgs:    Phaser.GameObjects.Graphics[] = [];
    const rowRanks:  Phaser.GameObjects.Text[]     = [];
    const rowNames:  Phaser.GameObjects.Text[]     = [];
    const rowScores: Phaser.GameObjects.Text[]     = [];

    for (let i = 0; i < rowCount; i++) {
      const rowY = rowStartY + i * rowSpacing;

      const bg = this.add.graphics();
      rowBgs.push(bg);
      targets.push(bg);

      const rank = this.add.text(cx - 258, rowY, ["🥇", "🥈", "🥉"][i], {
        fontFamily: FONT, fontSize: "20px", color: "#ffffff",
      }).setOrigin(0.5, 0.5);
      rowRanks.push(rank);
      targets.push(rank);

      const name = this.add.text(cx - 250, rowY, "···", {
        fontFamily: FONT, fontSize: "22px", color: "#94a3b8",
      }).setOrigin(0, 0.5);
      rowNames.push(name);
      targets.push(name);

      const score = this.add.text(cx + 265, rowY, "", {
        fontFamily: FONT, fontSize: "22px", color: "#ffffff", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      rowScores.push(score);
      targets.push(score);
    }

    const populate = (entries: LeaderboardEntry[]) => {
      for (let i = 0; i < rowCount; i++) {
        const entry = entries[i];
        if (!entry) {
          rowNames[i].setText("").setVisible(false);
          rowScores[i].setText("").setVisible(false);
          rowRanks[i].setVisible(false);
          continue;
        }
        const isMe = entry.isCurrentPlayer ?? false;
        if (isMe) {
          const rowY = rowStartY + i * rowSpacing;
          rowBgs[i].fillStyle(C_JUGAR, 0.14);
          rowBgs[i].fillRoundedRect(cx - 284, rowY - 14, 568, 28, 4);
        }
        rowRanks[i].setVisible(true);
        rowNames[i]
          .setText(isMe ? `● ${entry.alias}  (${t("leaderboard_you")})` : entry.alias)
          .setColor(isMe ? C_CYAN_HEX : "#94a3b8");
        rowScores[i]
          .setText(entry.score.toLocaleString())
          .setColor(isMe ? C_CYAN_HEX : "#ffffff");
      }
    };

    return { targets, populate };
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
