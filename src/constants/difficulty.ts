export type DifficultyConfig = {
  level: number;
  speed: number;
  delay: number;
};

export function getDifficultyForScore(score: number): DifficultyConfig {
  if (score >= 700) {
    const t = Math.min((score - 700) / 600, 1);
    return {
      level: 5,
      speed: Math.round(820 + 180 * t),
      delay: Math.round(540 - 190 * t),
    };
  }
  if (score >= 400) return { level: 4, speed: 720, delay: 540 };
  if (score >= 200) return { level: 3, speed: 600, delay: 650 };
  if (score >= 100) return { level: 2, speed: 500, delay: 750 };
  return { level: 1, speed: 420, delay: 850 };
}

// ─── Meteor size distribution by time survived ─────────────────────────────
// Weights must be non-negative integers summing to exactly 100.
// Each stage applies from `fromSeconds` until the next threshold.

export interface MeteorWeightStage {
  readonly fromSeconds: number;
  readonly small:       number;
  readonly medium:      number;
  readonly large:       number;
}

export const METEOR_WEIGHT_STAGES: readonly MeteorWeightStage[] = [
  { fromSeconds:  0, small: 75, medium: 25, large:  0 },
  { fromSeconds: 20, small: 55, medium: 35, large: 10 },
  { fromSeconds: 40, small: 45, medium: 35, large: 20 },
  { fromSeconds: 60, small: 35, medium: 40, large: 25 },
  { fromSeconds: 90, small: 30, medium: 38, large: 32 },
];

/**
 * Returns the weight stage for the given elapsed time.
 * Falls back to the first (safest) stage if configuration is invalid.
 */
export function getMeteorWeights(survivedSeconds: number): MeteorWeightStage {
  let stage = METEOR_WEIGHT_STAGES[0];
  for (const s of METEOR_WEIGHT_STAGES) {
    if (survivedSeconds >= s.fromSeconds) stage = s;
  }
  const total = stage.small + stage.medium + stage.large;
  if (total !== 100 || stage.small < 0 || stage.medium < 0 || stage.large < 0) {
    console.warn(
      `[getMeteorWeights] Invalid weights (${stage.small}/${stage.medium}/${stage.large}), using fallback.`,
    );
    return METEOR_WEIGHT_STAGES[0];
  }
  return stage;
}
