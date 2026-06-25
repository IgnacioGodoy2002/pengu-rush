// ─── Camera shake config ──────────────────────────────────────────────────────
// duration  : milliseconds the shake lasts
// intensity : fraction of camera dimension displaced (0–1); 0.01 ≈ 7 px on 720 px

export type ShakeConfig = {
  readonly duration:  number;
  readonly intensity: number;
};

export const CAMERA_SHAKE = {
  mediumDestroyed: { duration:  55, intensity: 0.0015 },
  largeDestroyed:  { duration:  90, intensity: 0.0025 },
  playerDeath:     { duration: 160, intensity: 0.006  },
} as const satisfies Record<string, ShakeConfig>;
