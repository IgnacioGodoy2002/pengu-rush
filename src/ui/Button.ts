import Phaser from "phaser";
import { FONT } from "../constants/theme";
import { SoundEffectsManager } from "../services/SoundEffectsManager";

export type ButtonConfig = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  bgColor?: number;
  textColor?: string;
  fontSize?: string;
  depth?: number;
};

export type ButtonObjects = {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

export function createButton(cfg: ButtonConfig): ButtonObjects {
  const bgColor = cfg.bgColor ?? 0x16a34a;
  const textColor = cfg.textColor ?? "#ffffff";
  const fontSize = cfg.fontSize ?? "30px";
  const depth = cfg.depth ?? 0;

  const bg = cfg.scene.add
    .rectangle(cfg.x, cfg.y, cfg.width, cfg.height, bgColor)
    .setStrokeStyle(2, 0xffffff, 0.15)
    .setDepth(depth)
    .setInteractive();

  const text = cfg.scene.add
    .text(cfg.x, cfg.y, cfg.label, {
      fontFamily: FONT,
      fontSize,
      color: textColor,
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setDepth(depth + 1);

  bg.on("pointerover", () => bg.setAlpha(0.82));
  bg.on("pointerout", () => bg.setAlpha(1));
  bg.on("pointerdown", () => {
    SoundEffectsManager.play(cfg.scene, "sfx-click");
    cfg.onClick();
  });

  return { bg, text };
}
