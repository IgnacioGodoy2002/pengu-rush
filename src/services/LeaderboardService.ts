import { getSuraService } from "../integration/sura/SuraIntegrationService";

export type LeaderboardEntry = {
  alias:            string;
  score:            number;
  isCurrentPlayer?: boolean;
};

type ApiLeaderboardEntry = {
  position:   number;
  alias:      string | null;
  best_score: number;
};

type ApiLeaderboardResponse = {
  data: {
    entries: ApiLeaderboardEntry[];
  };
};

/**
 * Standalone / preview fallback — shown only when there's no real SURA
 * session to fetch a board from (e.g. `npm run dev` opened alone in a tab,
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
 * endpoint — the game runs in a sandboxed iframe/WebView with no real player
 * session (INIT_GAME only carries a launch-correlation hash, not an access
 * token), so it can't call the authenticated leaderboard route.
 *
 * `gameId` and `apiBaseUrl` come from the host's INIT_GAME payload, not from
 * build-time config — the same build has to work in every environment,
 * including the native app, which has no fixed API host to hardcode.
 *
 * Falls back to a static preview board in standalone mode, before the
 * handshake completes, or if the fetch fails, so the screen never renders
 * empty.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  let service: ReturnType<typeof getSuraService> | null = null;
  try { service = getSuraService(); } catch { /* not initialised yet */ }

  const gameId     = service?.getGameId() ?? null;
  const apiBaseUrl = service?.getApiBaseUrl() ?? null;
  if (!service || service.mode === "standalone" || !gameId || !apiBaseUrl) {
    return PREVIEW_ENTRIES;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/minigames/v1/games/${gameId}/leaderboard?per_page=12`,
    );
    if (!response.ok) return PREVIEW_ENTRIES;

    const body = (await response.json()) as ApiLeaderboardResponse;
    const myNickname = service.getNickname();

    return body.data.entries.map((entry) => ({
      // A player with no nickname comes back as `alias: null` — a generic
      // placeholder, never an invented name.
      alias:           entry.alias ?? `Player ${entry.position}`,
      score:           entry.best_score,
      isCurrentPlayer: myNickname !== null && entry.alias === myNickname,
    }));
  } catch {
    return PREVIEW_ENTRIES;
  }
}
