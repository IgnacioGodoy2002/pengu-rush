import Phaser from "phaser";
import { createButton } from "../ui/Button";
import { FONT } from "../constants/theme";
import { MusicManager } from "../services/MusicManager";
import { SoundEffectsManager } from "../services/SoundEffectsManager";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C_BG_HEX   = "#040d1a";
const C_CYAN     = 0x22d3ee;
const C_CYAN_HEX = "#22d3ee";
const C_PANEL    = 0x08142b;
const C_KEY_BG   = 0x1e3a5f;
const C_KEY_BORD = 0x4a7fa5;
const C_SEC_BTN  = 0x1e3a5f;
const C_SEC_BORD = 0x4a7fa5;

// ─── Panel geometry ────────────────────────────────────────────────────────────
const PANEL_W = 640;
const PANEL_H = 1170;
const PANEL_R = 18;

type FadeTarget =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Image;

export class InstructionsScene extends Phaser.Scene {
  constructor() {
    super("InstructionsScene");
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    const panelCY = height / 2 + 25;      // 665 on 1280-px canvas
    const top     = panelCY - PANEL_H / 2; // 80

    this.cameras.main.setBackgroundColor(C_BG_HEX);
    MusicManager.playMenuMusic(this);
    this.buildStars(width, height);

    const panel = this.buildPanel(cx, panelCY);
    this.buildGlow(cx, top + 110);

    const isTouch = this.sys.game.device.input.touch;

    // ─── Vertical rhythm ──────────────────────────────────────────────────
    const comoY    = top  + 65;            // 145
    const jugarY   = comoY  + 58;          // 203
    const divY0    = jugarY + 36;          // 239

    const ctrlLblY = divY0    + 26;        // 265
    const ctrlY1   = ctrlLblY + 44;        // 309
    const ctrlY2   = ctrlY1   + 46;        // 355
    const ctrlY3   = ctrlY2   + 46;        // 401
    const divY1    = ctrlY3   + 34;        // 435

    const objLblY  = divY1   + 24;         // 459
    const objTxtY  = objLblY + 32;         // 491
    const divY2    = objTxtY + 52;         // 543

    const metLblY  = divY2   + 24;         // 567
    const metY1    = metLblY + 38;         // 605
    const metY2    = metY1   + 42;         // 647
    const metY3    = metY2   + 48;         // 695
    const divY3    = metY3   + 32;         // 727

    const ptLblY   = divY3  + 24;          // 713
    const ptTxtY   = ptLblY + 32;          // 745
    const divY4    = ptTxtY + 52;          // 797

    const shLblY   = divY4  + 24;          // 821
    const shTxt1Y  = shLblY + 34;          // 855
    const shTxt2Y  = shTxt1Y + 26;         // 881
    const shTxt3Y  = shTxt2Y + 26;         // 907
    const divY5    = shTxt3Y + 24;         // 931

    const pauLblY  = divY5  + 24;          // 955
    const pauTxt1Y = pauLblY + 30;         // 985
    const pauTxt2Y = pauTxt1Y + 26;        // 1011
    const divY6    = pauTxt2Y + 24;        // 1035
    const btnY     = divY6  + 54;          // 1089

    // ─── Header ───────────────────────────────────────────────────────────
    const como = this.add
      .text(cx, comoY, "CÓMO", {
        fontFamily: FONT, fontSize: "58px", color: "#ffffff", fontStyle: "bold",
        shadow: { offsetX: 0, offsetY: 2, color: "#000033", blur: 12, fill: true },
      })
      .setOrigin(0.5);

    const jugar = this.add
      .text(cx, jugarY, "JUGAR", {
        fontFamily: FONT, fontSize: "58px", color: C_CYAN_HEX, fontStyle: "bold",
        stroke: "#083d4a", strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 0, color: C_CYAN_HEX, blur: 16, fill: true },
      })
      .setOrigin(0.5);

    const div0 = this.buildDivider(cx, divY0, 560);

    // ─── CONTROLES (device-specific) ──────────────────────────────────────
    const ctrlLbl = this.buildSectionLabel(cx, ctrlLblY, "CONTROLES");

    // Key column centered at kx; label column left-aligned from lx
    const kx = cx - 90;
    const lx = cx + 38;

    const ctrlObjs: FadeTarget[] = isTouch
      ? this.buildControlsTouch(kx, lx, ctrlY1, ctrlY2, ctrlY3)
      : this.buildControlsDesktop(kx, lx, ctrlY1, ctrlY2, ctrlY3);

    const div1 = this.buildDivider(cx, divY1, 560);

    // ─── OBJETIVO ─────────────────────────────────────────────────────────
    const objLbl = this.buildSectionLabel(cx, objLblY, "OBJETIVO");

    const objTxt = this.add
      .text(
        cx, objTxtY,
        "Esquivá y destruí meteoritos.\nSobreviví el mayor tiempo posible y superá tu récord.",
        { fontFamily: FONT, fontSize: "21px", color: "#94a3b8", align: "center", lineSpacing: 5 },
      )
      .setOrigin(0.5);

    const div2 = this.buildDivider(cx, divY2, 560);

    // ─── METEORITOS ───────────────────────────────────────────────────────
    const metLbl = this.buildSectionLabel(cx, metLblY, "METEORITOS");

    const iconCol = cx - 210;      // circle centre-x
    const textCol = cx - 178;      // label left edge

    const [met1g, met1t] = this.buildMeteorRow(iconCol, textCol, metY1, "meteor-small",  20, "Pequeño  —  1 golpe para destruir");
    const [met2g, met2t] = this.buildMeteorRow(iconCol, textCol, metY2, "meteor-medium", 30, "Mediano  —  3 golpes para destruir");
    const [met3g, met3t] = this.buildMeteorRow(iconCol, textCol, metY3, "meteor-large",  42, "Grande  —  7 golpes para destruir");

    const div3 = this.buildDivider(cx, divY3, 560);

    // ─── PUNTOS ───────────────────────────────────────────────────────────
    const ptLbl = this.buildSectionLabel(cx, ptLblY, "PUNTOS");

    const ptTxt = this.add
      .text(
        cx, ptTxtY,
        "Destruir meteoritos da más puntos que esquivarlos.\nLos meteoritos grandes son los más valiosos.",
        { fontFamily: FONT, fontSize: "21px", color: "#94a3b8", align: "center", lineSpacing: 5 },
      )
      .setOrigin(0.5);

    const div4 = this.buildDivider(cx, divY4, 560);

    // ─── ESCUDO ───────────────────────────────────────────────────────────
    const shLbl  = this.buildSectionLabel(cx, shLblY, "ESCUDO");

    // Small shield icon aligned with the first text line
    const shIcon = this.add.image(iconCol, shTxt1Y + 13, "shield-icon")
      .setDisplaySize(64, 64)
      .setOrigin(0.5);

    const shTxt1 = this.add
      .text(textCol, shTxt1Y, "Recogé el símbolo cyan que cae del cielo", {
        fontFamily: FONT, fontSize: "21px", color: "#94a3b8",
      })
      .setOrigin(0, 0.5);

    const shTxt2 = this.add
      .text(textCol, shTxt2Y, "para activar un escudo temporal.", {
        fontFamily: FONT, fontSize: "21px", color: "#94a3b8",
      })
      .setOrigin(0, 0.5);

    const shTxt3 = this.add
      .text(cx, shTxt3Y, "Absorbe un choque y desaparece. Sin usarlo, expira solo.", {
        fontFamily: FONT, fontSize: "19px", color: "#64748b", align: "center",
        wordWrap: { width: 530 },
      })
      .setOrigin(0.5, 0);

    const div5 = this.buildDivider(cx, divY5, 560);

    // ─── PAUSA Y AUDIO ────────────────────────────────────────────────────
    const pauLbl = this.buildSectionLabel(cx, pauLblY, "PAUSA Y AUDIO");

    const pauTxt1 = this.add
      .text(cx, pauTxt1Y, "Usá el botón PAUSA para detener la partida.", {
        fontFamily: FONT, fontSize: "21px", color: "#94a3b8", align: "center",
      })
      .setOrigin(0.5);

    const pauTxt2 = this.add
      .text(cx, pauTxt2Y, "El botón de audio silencia música y efectos.", {
        fontFamily: FONT, fontSize: "21px", color: "#94a3b8", align: "center",
      })
      .setOrigin(0.5);

    const div6 = this.buildDivider(cx, divY6, 440);

    // ─── Button ───────────────────────────────────────────────────────────
    const { bg: btnBg, text: btnTxt } = createButton({
      scene: this, x: cx, y: btnY, width: 460, height: 78,
      label: "VOLVER AL MENÚ", bgColor: C_SEC_BTN, fontSize: "28px",
      onClick: () => {},
    });
    btnBg.setStrokeStyle(2, C_SEC_BORD, 0.65).setInteractive({ useHandCursor: true });
    btnBg.removeAllListeners();
    btnBg.on("pointerover",  () => { btnBg.setAlpha(0.75).setScale(1.025); btnTxt.setScale(1.025); });
    btnBg.on("pointerout",   () => { btnBg.setAlpha(1).setScale(1);        btnTxt.setScale(1);     });
    btnBg.on("pointerdown",  () => {
      SoundEffectsManager.play(this, "sfx-click");
      btnBg.setScale(0.97);
      btnTxt.setScale(0.97);
      this.scene.start("MenuScene");
    });

    // ─── Staggered fade-in ────────────────────────────────────────────────
    const w0: FadeTarget[] = [panel];
    const w1: FadeTarget[] = [como, jugar, div0];
    const w2: FadeTarget[] = [
      ctrlLbl, ...ctrlObjs, div1,
      objLbl, objTxt, div2,
      metLbl, met1g, met1t, met2g, met2t, met3g, met3t, div3,
      ptLbl, ptTxt, div4,
      shLbl, shIcon, shTxt1, shTxt2, shTxt3, div5,
      pauLbl, pauTxt1, pauTxt2, div6,
    ];
    const w3: FadeTarget[] = [btnBg, btnTxt];

    for (const o of [...w0, ...w1, ...w2, ...w3]) o.setAlpha(0);
    this.tweens.add({ targets: w0, alpha: 1, duration: 360, ease: "Quad.Out" });
    this.tweens.add({ targets: w1, alpha: 1, duration: 400, delay: 120, ease: "Quad.Out" });
    this.tweens.add({ targets: w2, alpha: 1, duration: 380, delay: 260, ease: "Quad.Out" });
    this.tweens.add({ targets: w3, alpha: 1, duration: 360, delay: 420, ease: "Quad.Out" });
  }

  // ─── Control sections ──────────────────────────────────────────────────────

  private buildControlsDesktop(
    kx: number, lx: number,
    y1: number, y2: number, y3: number,
  ): FadeTarget[] {
    const objs: FadeTarget[] = [];

    objs.push(...this.buildKeyRow(kx, y1, ["A", "D", "←", "→"]));
    objs.push(this.mkLabel(lx, y1, "Mover la nave"));

    objs.push(...this.buildKeyRow(kx, y2, ["ESPACIO"]));
    objs.push(this.mkLabel(lx, y2, "Disparar"));

    objs.push(...this.buildKeyRow(kx, y3, ["P", "ESC"]));
    objs.push(this.mkLabel(lx, y3, "Pausar la partida"));

    return objs;
  }

  private buildControlsTouch(
    kx: number, lx: number,
    y1: number, y2: number, y3: number,
  ): FadeTarget[] {
    const objs: FadeTarget[] = [];

    objs.push(...this.buildSwipeIcon(kx, y1));
    objs.push(this.mkLabel(lx, y1, "Mover la nave"));

    objs.push(...this.buildKeyRow(kx, y2, ["FIRE"]));
    objs.push(this.mkLabel(lx, y2, "Disparar"));

    objs.push(...this.buildKeyRow(kx, y3, ["PAUSA"]));
    objs.push(this.mkLabel(lx, y3, "Pausar la partida"));

    return objs;
  }

  // ─── Private builders ──────────────────────────────────────────────────────

  private mkLabel(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: "22px", color: "#7ec8e3" })
      .setOrigin(0, 0.5);
  }

  private buildMeteorRow(
    iconX: number, textX: number, y: number,
    textureKey: string, displaySize: number, label: string,
  ): [Phaser.GameObjects.Image | Phaser.GameObjects.Graphics, Phaser.GameObjects.Text] {
    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (this.textures.exists(textureKey)) {
      icon = this.add.image(iconX, y, textureKey)
        .setDisplaySize(displaySize, displaySize)
        .setOrigin(0.5);
    } else {
      const g = this.add.graphics();
      const r = displaySize / 2;
      g.fillStyle(0x7a8fa8, 0.75);
      g.fillCircle(iconX, y, r);
      g.lineStyle(1.5, 0x9bb8cc, 0.7);
      g.strokeCircle(iconX, y, r);
      icon = g;
    }

    const txt = this.add
      .text(textX, y, label, { fontFamily: FONT, fontSize: "21px", color: "#94a3b8" })
      .setOrigin(0, 0.5);

    return [icon, txt];
  }

  private buildStars(w: number, h: number): void {
    const g   = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(["pengu-instr-v1"]);
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
    g.fillStyle(C_CYAN, 0.14);
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

  private buildSectionLabel(cx: number, y: number, label: string): Phaser.GameObjects.Text {
    return this.add
      .text(cx, y, label, {
        fontFamily: FONT, fontSize: "21px", color: C_CYAN_HEX, fontStyle: "bold",
      })
      .setOrigin(0.5);
  }

  /**
   * Keycap-style rectangles centred at (cx, y).
   * Width: 1 char → 34 px, 2 → 46, 3 → 56, 4-5 → 66, 6+ → 82.
   */
  private buildKeyRow(cx: number, y: number, labels: string[]): FadeTarget[] {
    const kh  = 28;
    const gap = 7;
    const kw  = (l: string) =>
      l.length <= 1 ? 34 : l.length <= 2 ? 46 : l.length <= 3 ? 56 : l.length <= 5 ? 66 : 82;
    const kws     = labels.map(kw);
    const totalW  = kws.reduce((a, b) => a + b, 0) + (labels.length - 1) * gap;
    let x         = cx - totalW / 2;
    const result: FadeTarget[] = [];

    for (let i = 0; i < labels.length; i++) {
      const w  = kws[i];
      const kx = x + w / 2;

      const bg = this.add.graphics();
      bg.fillStyle(C_KEY_BG, 1);
      bg.fillRoundedRect(kx - w / 2, y - kh / 2, w, kh, 4);
      bg.lineStyle(1.5, C_KEY_BORD, 0.9);
      bg.strokeRoundedRect(kx - w / 2, y - kh / 2, w, kh, 4);

      const txt = this.add
        .text(kx, y, labels[i], {
          fontFamily: FONT, fontSize: "16px", color: "#e2e8f0", fontStyle: "bold",
        })
        .setOrigin(0.5);

      result.push(bg, txt);
      x += w + gap;
    }
    return result;
  }

  /**
   * Horizontal swipe illustration: line + arrowheads + animated finger dot.
   * Compact version sized to fit the controls column.
   */
  private buildSwipeIcon(cx: number, cy: number): FadeTarget[] {
    const halfW = 42;

    const line = this.add.graphics();
    line.lineStyle(2, C_CYAN, 0.38);
    line.beginPath();
    line.moveTo(cx - halfW, cy);
    line.lineTo(cx + halfW, cy);
    line.strokePath();
    line.fillStyle(C_CYAN, 0.48);
    line.fillTriangle(cx - halfW - 8, cy, cx - halfW + 2, cy - 5, cx - halfW + 2, cy + 5);
    line.fillTriangle(cx + halfW + 8, cy, cx + halfW - 2, cy - 5, cx + halfW - 2, cy + 5);

    const dot = this.add.graphics();
    dot.fillStyle(0xffffff, 0.78);
    dot.fillCircle(0, 0, 9);
    dot.lineStyle(1.5, C_CYAN, 0.7);
    dot.strokeCircle(0, 0, 9);
    dot.x = cx;
    dot.y = cy - 20;

    this.tweens.add({
      targets: dot,
      x: { from: cx - halfW + 9, to: cx + halfW - 9 },
      duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });

    return [line, dot];
  }
}
