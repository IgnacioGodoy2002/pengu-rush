import Phaser from "phaser";
import { MusicManager } from "./MusicManager";

export type SoundEffectKey =
  | "sfx-shot"
  | "sfx-hit"
  | "sfx-destroy-small"
  | "sfx-destroy-medium"
  | "sfx-destroy-large"
  | "sfx-player-crash"
  | "sfx-click"
  | "sfx-countdown"
  | "sfx-countdown-go"
  | "sfx-new-record"
  | "sfx-shield-pickup"
  | "sfx-shield-absorb"
  | "sfx-shield-expire";

// Asset paths — used in BootScene preload (currently commented out).
// When a file is added to public/audio/sfx/, uncomment the matching line in BootScene.
export const SFX_PATHS: Record<SoundEffectKey, string> = {
  "sfx-shot":           "/audio/sfx/disparo.ogg",
  "sfx-hit":            "/audio/sfx/impacto.ogg",
  "sfx-destroy-small":  "/audio/sfx/destruccion-chico.ogg",
  "sfx-destroy-medium": "/audio/sfx/destruccion-mediano.ogg",
  "sfx-destroy-large":  "/audio/sfx/destruccion-grande.ogg",
  "sfx-player-crash":   "/audio/sfx/choque.ogg",
  "sfx-click":          "/audio/sfx/click.ogg",
  "sfx-countdown":      "/audio/sfx/countdown-beep.ogg",
  "sfx-countdown-go":   "/audio/sfx/countdown-go.ogg",
  "sfx-new-record":     "/audio/sfx/nuevo-record.ogg",
  "sfx-shield-pickup":  "/audio/sfx/escudo-recoger.ogg",
  "sfx-shield-absorb":  "/audio/sfx/escudo-absorber.ogg",
  "sfx-shield-expire":  "/audio/sfx/escudo-expirar.ogg",
};

// Volume per effect. Single source of truth — do not hardcode volumes at call sites.
const SFX_VOLUME: Record<SoundEffectKey, number> = {
  "sfx-shot":           0.20,
  "sfx-hit":            0.18,
  "sfx-destroy-small":  0.25,
  "sfx-destroy-medium": 0.30,
  "sfx-destroy-large":  0.38,
  "sfx-player-crash":   0.45,
  "sfx-click":          0.22,
  "sfx-countdown":      0.25,
  "sfx-countdown-go":   0.32,
  "sfx-new-record":     0.38,
  "sfx-shield-pickup":  0.32,
  "sfx-shield-absorb":  0.42,
  "sfx-shield-expire":  0.20,
};

// Subtle rate (pitch) variation range [min, max] for shot and impact.
// 0.96–1.04 = ±4% — barely perceptible per shot, natural under rapid fire.
const PITCH_RANGE: Partial<Record<SoundEffectKey, [number, number]>> = {
  "sfx-shot": [0.96, 1.04],
  "sfx-hit":  [0.96, 1.04],
};

// Minimum ms between consecutive impact sounds.
// Prevents pile-up when two bullets hit the same meteor in the same frame.
const HIT_THROTTLE_MS = 35;

export class SoundEffectsManager {
  // Each missing key is warned exactly once per browser session.
  private static readonly warnedMissing = new Set<SoundEffectKey>();

  // Timestamp (performance.now) of last impact sound played.
  private static lastHitTime = 0;

  /**
   * Play a sound effect. Safe to call unconditionally:
   * - returns immediately when muted;
   * - returns immediately when audio context is locked (browser autoplay policy);
   * - warns once and returns when the asset is not in cache.
   */
  static play(scene: Phaser.Scene, key: SoundEffectKey): void {
    if (MusicManager.isMuted) return;

    // When the audio context is locked, skip instantaneous effects.
    // Queuing them would replay stale shots/clicks after the lock resolves.
    if (scene.sound.locked) return;

    if (!scene.cache.audio.exists(key)) {
      if (!SoundEffectsManager.warnedMissing.has(key)) {
        SoundEffectsManager.warnedMissing.add(key);
        console.warn(`[SFX] Audio no disponible: ${key}`);
      }
      return;
    }

    try {
      const range = PITCH_RANGE[key];
      const config: Phaser.Types.Sound.SoundConfig = {
        volume: SFX_VOLUME[key],
        ...(range ? { rate: range[0] + Math.random() * (range[1] - range[0]) } : {}),
      };
      scene.sound.play(key, config);
    } catch (err) {
      console.warn(`[SFX] Error al reproducir "${key}":`, err);
    }
  }

  /**
   * Throttled impact sound: at most one per HIT_THROTTLE_MS window.
   * Does NOT block the actual damage — call this independently of HP logic.
   */
  static playHit(scene: Phaser.Scene): void {
    const now = performance.now();
    if (now - SoundEffectsManager.lastHitTime < HIT_THROTTLE_MS) return;
    SoundEffectsManager.lastHitTime = now;
    SoundEffectsManager.play(scene, "sfx-hit");
  }
}
