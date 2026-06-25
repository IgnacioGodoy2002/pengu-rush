// TODO: In production, best score and rewards must be validated and saved by the server.

const KEYS = {
  bestScore: "dodge-rush:best-score",
  bestMilestoneScore: "dodge-rush:best-milestone",
  totalRewards: "dodge-rush:total-rewards",
} as const;

type Milestone = { score: number; totalReward: number };

const MILESTONE_TABLE: Milestone[] = [
  { score: 200, totalReward: 1 },
  { score: 400, totalReward: 3 },
  { score: 600, totalReward: 5 },
  { score: 800, totalReward: 7 },
  { score: 1000, totalReward: 10 },
  { score: 1200, totalReward: 13 },
];

export type SavedData = {
  bestScore: number;
  bestMilestoneScore: number;
  totalRewards: number;
};

export type SessionResult = {
  isNewBestScore: boolean;
  newBestScore: number;
  unlockedMilestoneScore: number | null;
  rewardsEarned: number;
  newTotalRewards: number;
  nextMilestoneScore: number;
};

function highestMilestoneReached(score: number): Milestone | null {
  let best: Milestone | null = null;

  for (const m of MILESTONE_TABLE) {
    if (score >= m.score) best = m;
  }

  // Milestones beyond 1200: every 200 pts adds +3 total reward
  if (score >= 1400) {
    const extraSteps = Math.floor((score - 1200) / 200);
    const candidate: Milestone = {
      score: 1200 + extraSteps * 200,
      totalReward: 13 + extraSteps * 3,
    };
    if (best === null || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

function nextMilestoneScore(currentScore: number): number {
  for (const m of MILESTONE_TABLE) {
    if (currentScore < m.score) return m.score;
  }
  const extraSteps = Math.floor((currentScore - 1200) / 200);
  return 1200 + (extraSteps + 1) * 200;
}

export const RecordsService = {
  // TODO: In production, replace with GET /api/player/records.
  load(): SavedData {
    return {
      bestScore: Number(
        localStorage.getItem(KEYS.bestScore) ?? 0,
      ),
      bestMilestoneScore: Number(
        localStorage.getItem(KEYS.bestMilestoneScore) ?? 0,
      ),
      totalRewards: Number(
        localStorage.getItem(KEYS.totalRewards) ?? 0,
      ),
    };
  },

  // TODO: In production, replace with POST /api/player/records (server validates and persists).
  save(data: SavedData): void {
    localStorage.setItem(KEYS.bestScore, String(data.bestScore));
    localStorage.setItem(
      KEYS.bestMilestoneScore,
      String(data.bestMilestoneScore),
    );
    localStorage.setItem(
      KEYS.totalRewards,
      String(data.totalRewards),
    );
  },

  computeSessionResult(
    sessionScore: number,
    saved: SavedData,
  ): SessionResult {
    const isNewBestScore = sessionScore > saved.bestScore;
    const newBestScore = Math.max(sessionScore, saved.bestScore);
    const reached = highestMilestoneReached(sessionScore);

    let unlockedMilestoneScore: number | null = null;
    let rewardsEarned = 0;
    let newTotalRewards = saved.totalRewards;

    if (
      reached !== null &&
      reached.score > saved.bestMilestoneScore
    ) {
      unlockedMilestoneScore = reached.score;
      rewardsEarned = reached.totalReward - saved.totalRewards;
      newTotalRewards = reached.totalReward;
    }

    return {
      isNewBestScore,
      newBestScore,
      unlockedMilestoneScore,
      rewardsEarned,
      newTotalRewards,
      nextMilestoneScore: nextMilestoneScore(sessionScore),
    };
  },

  nextMilestoneScore,
};
