import Phaser from "phaser";
import { FONT } from "../constants/theme";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";
import { fetchLeaderboard } from "../services/LeaderboardService";
import type { LeaderboardEntry } from "../services/LeaderboardService";
import { t } from "../i18n";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C_BG_HEX   = "#040d1a";
const C_CYAN     = 0x22d3ee;
const C_CYAN_HEX = "#22d3ee";
const C_PANEL    = 0x08142b;
const C_GOLD     = 0xf59e0b;
const C_GOLD_HEX = "#f59e0b";
const C_JUGAR    = 0x0e7490;
const C_COMO     = 0x1e3a5f;
const C_COMO_BORD = 0x4a7fa5;

// ─── Panel geometry ───────────────────────────────────────────────────────────
const PANEL_W  = 620;
const PANEL_H  = 920;
const PANEL_R  = 18;
const N_ROWS   = 12;
const ROW_H    = 48;

// ─── Medal icon (drawn, not emoji — renders identically everywhere and
// matches the app's own hand-drawn "badge" look instead of relying on the
// OS/browser's emoji glyph set) ─────────────────────────────────────────────
const MEDAL_R = 12;
const MEDAL_COLORS: { fill: number; rim: number; ribbon: number; shine: number }[] = [
  { fill: 0xffc93c, rim: 0xb8860b, ribbon: 0xb8860b, shine: 0xfff3c4 }, // gold
  { fill: 0xd9dee3, rim: 0x8a939c, ribbon: 0x8a939c, shine: 0xf3f5f7 }, // silver
  { fill: 0xcd7f32, rim: 0x8b5a2b, ribbon: 0x8b5a2b, shine: 0xe8b27d }, // bronze
];

type FadeTarget =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Container
  | Phaser.GameObjects.Rectangle;

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super("LeaderboardScene");
  }

  create(): void {
    const { width, height } = this.scale;
    const cx      = width / 2;
    const panelCY = height * 0.49;
    const top     = panelCY - PANEL_H / 2;

    this.cameras.main.setBackgroundColor(C_BG_HEX);
    this.tryPlayMenuMusic();
    this.buildStars(width, height);

    const panel = this.buildPanel(cx, panelCY);
    this.buildGlow(cx, top + 80);

    // ── Vertical rhythm ──────────────────────────────────────────────────────
    const titleY  = top  + 62;
    const div0Y   = titleY + 48;
    const row0Y   = div0Y  + 52;
    const divEndY = row0Y  + (N_ROWS - 1) * ROW_H + 44;
    const btnY    = divEndY + 52;

    // ── Title ────────────────────────────────────────────────────────────────
    const title = this.add
      .text(cx, titleY, t("leaderboard_title"), {
        fontFamily: FONT, fontSize: "38px", color: C_GOLD_HEX, fontStyle: "bold",
        shadow: { offsetX: 0, offsetY: 0, color: C_GOLD_HEX, blur: 14, fill: true },
      })
      .setOrigin(0.5);

    const div0 = this.buildDivider(cx, div0Y, 540);

    // ── Rows ─────────────────────────────────────────────────────────────────
    const { targets: rowTargets, populate } = this.buildRows(cx, row0Y);
    fetchLeaderboard().then(populate).catch(() => {});

    const divEnd = this.buildDivider(cx, divEndY, 540);

    // ── Back button ───────────────────────────────────────────────────────────
    const btnBg = this.add
      .rectangle(cx, btnY, 460, 78, C_COMO, 1)
      .setStrokeStyle(2, C_COMO_BORD, 0.65)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add
      .text(cx, btnY, t("leaderboard_back"), {
        fontFamily: FONT, fontSize: "28px", color: "#94a3b8", fontStyle: "bold",
      })
      .setOrigin(0.5);

    btnBg.on("pointerover",  () => { btnBg.setAlpha(0.75).setScale(1.025); btnTxt.setScale(1.025); });
    btnBg.on("pointerout",   () => { btnBg.setAlpha(1).setScale(1);        btnTxt.setScale(1);     });
    btnBg.on("pointerdown",  () => {
      SoundEffectsManager.play(this, "sfx-click");
      btnBg.setScale(0.97);
      btnTxt.setScale(0.97);
      this.scene.start("MenuScene");
    });

    // ── Staggered fade-in ────────────────────────────────────────────────────
    const w0: FadeTarget[] = [panel];
    const w1: FadeTarget[] = [title, div0];
    const w2: FadeTarget[] = [...rowTargets, divEnd];
    const w3: FadeTarget[] = [btnBg, btnTxt];

    for (const o of [...w0, ...w1, ...w2, ...w3]) o.setAlpha(0);
    this.tweens.add({ targets: w0, alpha: 1, duration: 360, ease: "Quad.Out" });
    this.tweens.add({ targets: w1, alpha: 1, duration: 400, delay: 120, ease: "Quad.Out" });
    this.tweens.add({ targets: w2, alpha: 1, duration: 380, delay: 260, ease: "Quad.Out" });
    this.tweens.add({ targets: w3, alpha: 1, duration: 360, delay: 420, ease: "Quad.Out" });
  }

  // ─── Row builder ──────────────────────────────────────────────────────────

  private buildRows(
    cx: number,
    rowStartY: number,
  ): { targets: FadeTarget[]; populate: (entries: LeaderboardEntry[]) => void } {
    const targets:    FadeTarget[]                                    = [];
    const rowBgs:     Phaser.GameObjects.Graphics[]                   = [];
    const rowLefts:   (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
    const rowNames:   Phaser.GameObjects.Text[]                       = [];
    const rowScores:  Phaser.GameObjects.Text[]                       = [];

    for (let i = 0; i < N_ROWS; i++) {
      const rowY = rowStartY + i * ROW_H;

      const bg = this.add.graphics();
      rowBgs.push(bg);
      targets.push(bg);

      // Top 3 get a drawn medal badge instead of a plain rank number —
      // drawn with Graphics (same technique as the rest of the app's
      // panels/badges) rather than an emoji glyph, so it renders
      // identically across every OS/browser instead of depending on
      // whatever emoji font happens to be installed.
      const left = i < 3
        ? this.buildMedalIcon(cx - 258, rowY, i)
        : this.add
            .text(cx - 258, rowY, `${i + 1}`, {
              fontFamily: FONT, fontSize: "20px", color: "#475569",
            })
            .setOrigin(0.5, 0.5);
      rowLefts.push(left);
      targets.push(left);

      const name = this.add
        .text(cx - 228, rowY, "···", {
          fontFamily: FONT, fontSize: "22px", color: "#94a3b8",
        })
        .setOrigin(0, 0.5);
      rowNames.push(name);
      targets.push(name);

      const score = this.add
        .text(cx + 258, rowY, "", {
          fontFamily: FONT, fontSize: "22px", color: "#ffffff", fontStyle: "bold",
        })
        .setOrigin(1, 0.5);
      rowScores.push(score);
      targets.push(score);
    }

    const populate = (entries: LeaderboardEntry[]) => {
      for (let i = 0; i < N_ROWS; i++) {
        const entry = entries[i];
        if (!entry) {
          rowNames[i].setVisible(false);
          rowScores[i].setVisible(false);
          rowLefts[i].setVisible(false);
          continue;
        }
        const isMe = entry.isCurrentPlayer ?? false;
        if (isMe) {
          const rowY = rowStartY + i * ROW_H;
          rowBgs[i].fillStyle(C_JUGAR, 0.14);
          rowBgs[i].fillRoundedRect(cx - 280, rowY - 22, 560, 44, 4);
        }
        // The medal's colour is fixed by rank (gold/silver/bronze), not by
        // who holds it — only the plain-number ranks (4+) still tint cyan
        // for the current player, matching the name/score columns.
        if (i >= 3) {
          (rowLefts[i] as Phaser.GameObjects.Text)
            .setText(`${i + 1}`)
            .setColor(isMe ? C_CYAN_HEX : "#475569");
        }
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

  private buildMedalIcon(cx: number, cy: number, tier: number): Phaser.GameObjects.Container {
    const { fill, rim, ribbon, shine } = MEDAL_COLORS[tier];
    const g = this.add.graphics();

    // Ribbon tails, poking out from behind the disc.
    g.fillStyle(ribbon, 1);
    g.fillTriangle(-5, 2, -11, 15, 1, 6);
    g.fillTriangle(5, 2, 11, 15, -1, 6);

    // Disc: rim, then fill, then a soft shine highlight.
    g.fillStyle(rim, 1);
    g.fillCircle(0, 0, MEDAL_R);
    g.fillStyle(fill, 1);
    g.fillCircle(0, 0, MEDAL_R - 2);
    g.fillStyle(shine, 0.85);
    g.fillCircle(-3.5, -3.5, 2.6);

    const label = this.add
      .text(0, 0.5, `${tier + 1}`, {
        fontFamily: FONT, fontSize: "13px", color: "#3a2a10", fontStyle: "bold",
      })
      .setOrigin(0.5);

    return this.add.container(cx, cy, [g, label]);
  }

  // ─── Private builders ─────────────────────────────────────────────────────

  private tryPlayMenuMusic(): void {
    try {
      void Promise.resolve(MusicManager.playMenuMusic(this)).catch((e: unknown) => {
        console.warn("[Music] No se pudo reproducir música de menú:", e);
      });
    } catch (e: unknown) {
      console.warn("[Music] No se pudo reproducir música de menú:", e);
    }
  }

  private buildStars(w: number, h: number): void {
    const g   = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(["pengu-leader-v1"]);
    for (let i = 0; i < 28; i++) {
      const sz = rnd.pick([1, 1, 1, 2]);
      g.fillStyle(0xffffff, rnd.realInRange(0.12, 0.48));
      g.fillRect(rnd.between(8, w - 8), rnd.between(8, h - 8), sz, sz);
    }
  }

  private buildGlow(cx: number, cy: number): void {
    const g = this.add.graphics();
    for (const [r, a] of [[200, 0.02], [120, 0.042], [60, 0.068]] as [number, number][]) {
      g.fillStyle(C_CYAN, a);
      g.fillCircle(cx, cy, r);
    }
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
    g.fillStyle(C_GOLD, 0.22);
    g.fillRoundedRect(x, y, PANEL_W, 4, { tl: PANEL_R, tr: PANEL_R, bl: 0, br: 0 });
    return g;
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
}
