import Phaser from "phaser";

type AnySound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

const MUTE_KEY    = "pengu-rush:music-muted";
const VOL_BG      = 0.30;
const FADE_OUT_MS = 380;

export class MusicManager {
  private static bg: Phaser.Sound.BaseSound | null = null;
  private static muted = false;
  private static pending = false;

  static init(): void {
    MusicManager.muted = localStorage.getItem(MUTE_KEY) === "true";
  }

  // Both menu and game use the same track — it plays continuously across scenes.
  static playMenuMusic(scene: Phaser.Scene): void {
    MusicManager.ensurePlaying(scene);
  }

  static playGameMusic(scene: Phaser.Scene): void {
    MusicManager.ensurePlaying(scene);
  }

  static pauseGameMusic(): void {
    if (MusicManager.bg?.isPlaying) MusicManager.bg.pause();
  }

  static resumeGameMusic(): void {
    if (MusicManager.bg?.isPaused) MusicManager.bg.resume();
  }

  static fadeOutGameMusic(scene: Phaser.Scene): void {
    const snd = MusicManager.bg as AnySound | null;
    if (!snd?.isPlaying) return;
    const proxy = { vol: snd.volume };
    scene.tweens.add({
      targets: proxy, vol: 0,
      duration: FADE_OUT_MS, ease: "Quad.In",
      onUpdate:   () => { snd.setVolume(proxy.vol); },
      onComplete: () => { snd.stop(); },
    });
  }

  static stopAll(): void {
    MusicManager.pending = false;
    const snd = MusicManager.bg;
    if (snd?.isPlaying || snd?.isPaused) snd.stop();
  }

  static get isMuted(): boolean { return MusicManager.muted; }

  static toggleMute(): boolean {
    MusicManager.muted = !MusicManager.muted;
    localStorage.setItem(MUTE_KEY, String(MusicManager.muted));
    if (MusicManager.bg) {
      (MusicManager.bg as AnySound).setVolume(MusicManager.muted ? 0 : VOL_BG);
    }
    return MusicManager.muted;
  }

  private static ensurePlaying(scene: Phaser.Scene): void {
    if (!MusicManager.bg) {
      if (!scene.cache.audio.exists("music-bg")) {
        console.warn('[MusicManager] Track "music-bg" not in cache — audio will be silent.');
        return;
      }
      try {
        MusicManager.bg = scene.sound.add("music-bg", {
          loop:   true,
          volume: MusicManager.muted ? 0 : VOL_BG,
        });
      } catch (err) {
        console.warn("[MusicManager] Failed to create sound:", err);
        return;
      }
    }

    if (MusicManager.bg.isPlaying) return;

    MusicManager.pending = true;
    const snd = MusicManager.bg;

    const doPlay = () => {
      if (!MusicManager.pending || snd.isPlaying) return;
      (snd as AnySound).setVolume(MusicManager.muted ? 0 : VOL_BG);
      snd.play();
    };

    if (scene.sound.locked) {
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, doPlay);
    } else {
      doPlay();
    }
  }
}
