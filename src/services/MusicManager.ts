import Phaser from "phaser";

// BaseSound doesn't expose setVolume / volume in its TS definition.
// Both concrete subclasses do, so we cast to this union when needed.
type AnySound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

const MUTE_KEY    = "pengu-rush:music-muted";
const VOL_MENU    = 0.28;
const VOL_GAME    = 0.33;
const FADE_OUT_MS = 380;   // used only on game-over

export class MusicManager {
  // One instance per track, stored as static refs so they survive scene
  // transitions (Phaser's sound manager is game-level, not scene-level).
  private static menu: Phaser.Sound.BaseSound | null = null;
  private static game: Phaser.Sound.BaseSound | null = null;
  private static muted = false;

  // Guards against a pending "unlocked" callback starting the wrong track
  // when the user navigates before the browser autoplay lock resolves.
  private static pendingKey: "music-menu" | "music-game" | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  static init(): void {
    MusicManager.muted = localStorage.getItem(MUTE_KEY) === "true";
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // InstructionsScene also calls this. Because ensure() returns the same
  // instance every time, the track continues from the same position — it
  // never restarts when navigating between Menu and How-to-Play.
  static playMenuMusic(scene: Phaser.Scene): void {
    MusicManager.stopTrack(MusicManager.game);
    const snd = MusicManager.ensure(scene, "music-menu", VOL_MENU);
    if (!snd || snd.isPlaying) return;   // null = not in cache; skip duplicates
    MusicManager.startTrack(scene, snd, VOL_MENU, "music-menu");
  }

  // Called from MenuScene's JUGAR button (within the user-gesture handler so
  // the browser autoplay policy is satisfied) and from GameScene.create() as
  // a fallback for the "JUGAR DE NUEVO" flow (no-op if already playing).
  static playGameMusic(scene: Phaser.Scene): void {
    MusicManager.stopTrack(MusicManager.menu);
    const snd = MusicManager.ensure(scene, "music-game", VOL_GAME);
    if (!snd || snd.isPlaying) return;
    MusicManager.startTrack(scene, snd, VOL_GAME, "music-game");
  }

  static pauseGameMusic(): void {
    if (MusicManager.game?.isPlaying) MusicManager.game.pause();
  }

  static resumeGameMusic(): void {
    if (MusicManager.game?.isPaused) MusicManager.game.resume();
  }

  // Smooth exit on game-over only. Not used for menu↔game transitions.
  static fadeOutGameMusic(scene: Phaser.Scene): void {
    const snd = MusicManager.game as AnySound | null;
    if (!snd?.isPlaying) return;
    const proxy = { vol: snd.volume };
    scene.tweens.add({
      targets: proxy, vol: 0,
      duration: FADE_OUT_MS, ease: "Quad.In",
      onUpdate:   () => { snd.setVolume(proxy.vol); },
      onComplete: () => { snd.stop(); },
    });
  }

  // Hard stop of both tracks (GameOverScene).
  static stopAll(): void {
    MusicManager.pendingKey = null;
    MusicManager.stopTrack(MusicManager.menu);
    MusicManager.stopTrack(MusicManager.game);
  }

  static get isMuted(): boolean { return MusicManager.muted; }

  static toggleMute(): boolean {
    MusicManager.muted = !MusicManager.muted;
    localStorage.setItem(MUTE_KEY, String(MusicManager.muted));
    MusicManager.applyMute();
    return MusicManager.muted;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Returns null instead of throwing when a track is unavailable.
  // Music is optional — a missing or corrupt OGG must never break the menu
  // or the game. All callers guard with `if (!snd) return`.
  private static ensure(
    scene: Phaser.Scene,
    key: "music-menu" | "music-game",
    volume: number,
  ): Phaser.Sound.BaseSound | null {
    const isMenu   = key === "music-menu";
    const existing = isMenu ? MusicManager.menu : MusicManager.game;
    if (existing) return existing;

    // Verify the asset was loaded before attempting to create a sound.
    // BootScene.preload() loads both OGG tracks before MenuScene runs.
    if (!scene.cache.audio.exists(key)) {
      console.warn(`[MusicManager] Track "${key}" not in cache — audio will be silent.`);
      return null;
    }

    try {
      // loop: true = native Phaser/Web Audio loop with no manual restart.
      // One instance per key; it lives at game level and is reused forever.
      const snd = scene.sound.add(key, {
        loop:   true,
        volume: MusicManager.muted ? 0 : volume,
      });
      if (isMenu) MusicManager.menu = snd;
      else        MusicManager.game = snd;
      return snd;
    } catch (err) {
      console.warn(`[MusicManager] Failed to create sound "${key}":`, err);
      return null;
    }
  }

  private static stopTrack(snd: Phaser.Sound.BaseSound | null): void {
    if (snd?.isPlaying || snd?.isPaused) snd.stop();
  }

  private static applyMute(): void {
    if (MusicManager.menu) (MusicManager.menu as AnySound).setVolume(MusicManager.muted ? 0 : VOL_MENU);
    if (MusicManager.game) (MusicManager.game as AnySound).setVolume(MusicManager.muted ? 0 : VOL_GAME);
  }

  // Plays at full volume immediately — no fade-in ramp on scene transitions.
  // Handles the browser autoplay lock: if audio context is locked we wait
  // for the "unlocked" event. pendingKey prevents a stale listener from
  // starting the wrong track after a scene change.
  private static startTrack(
    scene: Phaser.Scene,
    snd: Phaser.Sound.BaseSound,
    targetVol: number,
    key: "music-menu" | "music-game",
  ): void {
    MusicManager.pendingKey = key;

    const doPlay = () => {
      if (MusicManager.pendingKey !== key || snd.isPlaying) return;
      (snd as AnySound).setVolume(MusicManager.muted ? 0 : targetVol);
      snd.play();
    };

    if (scene.sound.locked) {
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, doPlay);
    } else {
      doPlay();
    }
  }
}
