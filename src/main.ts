import Phaser from "phaser";
import "./style.css";

import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { InstructionsScene } from "./scenes/InstructionsScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { CANVAS } from "./constants/theme";

const DEBUG_PHYSICS = false;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  parent: "app",

  width: CANVAS.width,
  height: CANVAS.height,

  backgroundColor: "#07111f",

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CANVAS.width,
    height: CANVAS.height,
  },

  // Enable a second simultaneous pointer so one finger can slide the ship
  // while a second finger independently holds the FIRE button.
  input: {
    activePointers: 2,
  },

  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: DEBUG_PHYSICS,
    },
  },

  scene: [BootScene, MenuScene, InstructionsScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);

// iOS Safari Web Audio unlock — belt-and-suspenders alongside Phaser's own
// document-level touchstart listener. Directly resumes the AudioContext on
// the very first finger-down so every scene starts with audio active.
window.addEventListener(
  "touchstart",
  () => {
    const sm = game.sound;
    if (sm.locked && "context" in sm) {
      (sm as unknown as { context: AudioContext }).context
        .resume()
        .catch(() => { /* silent */ });
    }
  },
  { once: true, passive: true },
);
