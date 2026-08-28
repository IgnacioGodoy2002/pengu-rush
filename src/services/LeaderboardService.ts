import { getSuraService } from "../integration/sura/SuraIntegrationService";
import { SURA_CONFIG } from "../integration/sura/SuraRuntimeConfig";

export type LeaderboardEntry = {
  alias:            string;
  score:            number;
  isCurrentPlayer?: boolean;
};

type ApiLeaderboardEntry = {
  alias:      string;
  best_score: number;
};

type ApiLeaderboardResponse = {
  data: {
    entries: ApiLeaderboardEntry[];
  };
};

/**
 * Standalone / preview fallback — shown only when there's no real SURA
 * session to fetch a board from (e.g. `npm run dev` with no `?sura_mode`,
 * or the standalone Vercel preview). Never shown once embedded.
 */
const PREVIEW_ENTRIES: LeaderboardEntry[] = [
  { alias: "AgusM",      score: 1890 },
  { alias: "Player3",    score:  980 },
  { alias: "SpeedRun_G", score:  870 },
  { alias: "PenguFan22", score:  744 },
  { alias: "AstroKid",   score:  693 },
  { alias: "RocketBoy",  score:  587 },
  { alias: "Cosmo_ML",   score:  542 },
  { alias: "StarDriftr", score:  498 },
  { alias: "NightOwl",   score:  431 },
  { alias: "Viper_XP",   score:  388 },
  { alias: "ZeroGravity",score:  345 },
];

/**
 * Real leaderboard for this mini-game, via the PUBLIC (unauthenticated)
 * endpoint — the game runs in a sandboxed iframe with no real player
 * session (INIT_GAME only carries a launch-identification hash, not an
 * access token), so it can't call the authenticated leaderboard route.
 * Falls back to a static preview board in standalone mode, or if the fetch
 * fails, so the screen never renders empty. Doesn't need to wait for the
 * SURA "ready" handshake — no token required.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  let service: ReturnType<typeof getSuraService> | null = null;
  try { service = getSuraService(); } catch { /* not initialised yet */ }

  if (!service || service.mode === "standalone" || !SURA_CONFIG.apiBaseUrl) {
    return PREVIEW_ENTRIES;
  }

  try {
    const response = await fetch(
      `${SURA_CONFIG.apiBaseUrl}/minigames/v1/games/${SURA_CONFIG.gameId}/leaderboard?per_page=12`,
    );
    if (!response.ok) return PREVIEW_ENTRIES;

    const body = (await response.json()) as ApiLeaderboardResponse;
    const myNickname = service.getNickname();

    return body.data.entries.map((entry) => ({
      alias:           entry.alias,
      score:           entry.best_score,
      isCurrentPlayer: myNickname !== null && entry.alias === myNickname,
    }));
  } catch {
    return PREVIEW_ENTRIES;
  }
}
