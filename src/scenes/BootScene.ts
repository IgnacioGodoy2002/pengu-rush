import Phaser from "phaser";
import { MusicManager } from "../services/MusicManager";
import { initSuraService } from "../integration/sura/SuraIntegrationService";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // OGG Vorbis only — all browsers that run Phaser 4 support OGG.
    // Using a single format avoids codec-detection races and the
    // "Unable to decode audio data" errors we saw with the previous MP3 files.
    this.load.audio("music-menu", "audio/menu.ogg");
    this.load.audio("music-game", "audio/juego.ogg");

    // ── SFX ───────────────────────────────────────────────────────────────
    // All ten effects are loaded here. If a file fails to decode, the
    // FILE_LOAD_ERROR handler below logs a warning and the game continues.
    // SoundEffectsManager checks cache.audio.exists() before every play call,
    // so a missing or corrupt file never causes a runtime error.
    this.load.audio("sfx-shot",           "audio/sfx/disparo.ogg");
    this.load.audio("sfx-hit",            "audio/sfx/impacto.ogg");
    this.load.audio("sfx-destroy-small",  "audio/sfx/destruccion-chico.ogg");
    this.load.audio("sfx-destroy-medium", "audio/sfx/destruccion-mediano.ogg");
    this.load.audio("sfx-destroy-large",  "audio/sfx/destruccion-grande.ogg");
    this.load.audio("sfx-player-crash",   "audio/sfx/choque.ogg");
    this.load.audio("sfx-click",          "audio/sfx/click.ogg");
    this.load.audio("sfx-countdown",      "audio/sfx/countdown-beep.ogg");
    this.load.audio("sfx-countdown-go",   "audio/sfx/countdown-go.ogg");
    this.load.audio("sfx-new-record",     "audio/sfx/nuevo-record.ogg");
    this.load.audio("sfx-shield-pickup",  "audio/sfx/escudo-recoger.ogg");
    this.load.audio("sfx-shield-absorb",  "audio/sfx/escudo-absorber.ogg");
    this.load.audio("sfx-shield-expire",  "audio/sfx/escudo-expirar.ogg");

    // ── Obstacles & UI ────────────────────────────────────────────────────
    // Loaded here so InstructionsScene can display real meteor sprites.
    this.load.image("meteor-small",  "assets/obstacles/meteorito_chico.png");
    this.load.image("meteor-medium", "assets/obstacles/meteorito_mediano.png");
    this.load.image("meteor-large",  "assets/obstacles/meteorito_grande.png");
    this.load.image("shield-icon",   "assets/ui/shield-icon.png");

    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: Phaser.Loader.File) => {
        console.warn(
          `[BootScene] No se pudo cargar "${file.key}" — el efecto quedará silenciado.`,
        );
      },
    );
  }

  create(): void {
    MusicManager.init();
    initSuraService().initialize();
    this.scene.start("MenuScene");
  }
}
