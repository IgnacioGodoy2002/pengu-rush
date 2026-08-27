// ─── API response envelope (SURA contract) ───────────────────────────────────

export type ApiSuccess<T> = {
  success: true;
  data:    T;
  message: string;
};

export type ApiFailure = {
  success: false;
  errors:  unknown[];
  message: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ApiPagination = {
  total:        number;
  per_page:     number;
  current_page: number;
  last_page:    number;
  from:         number;
  to:           number;
};

// ─── Integration modes ────────────────────────────────────────────────────────

export type IntegrationMode = "standalone" | "sura-mock" | "sura";

// ─── Integration state machine ────────────────────────────────────────────────

export type SuraIntegrationState =
  | "disabled"           // standalone — no bridge, no transitions
  | "waiting-context"    // sura/mock  — waiting for SURA_MINIGAME_INIT
  | "validating"         // received INIT, calling validateSession
  | "ready"              // session valid, waiting for JUGAR
  | "starting"           // startGameSession called, awaiting response
  | "playing"            // session started, game running
  | "completing"         // completeGameSession called, awaiting response
  | "completed"          // result sent, waiting for new INIT or exit
  | "unauthorized"       // 401/403 from validateSession or startSession
  | "error";             // network error or unexpected server failure

// ─── Session context ────────────────────────────────────────────────────────
//
// gameId is not sent by the host — it's the game's own known SURA_CONFIG.gameId.
// The host has no concept of playerId in its INIT payload either.

export type SuraSessionContext = {
  token:      string;
  sessionId:  string;
  gameId:     string;
  nickname?:  string;
};

// ─── Game result ──────────────────────────────────────────────────────────────

export type GameResult = {
  score:               number;
  level?:              number;
  survivedMs?:         number;
  meteorsDestroyed?:   number;
  isNewRecord?:        boolean;
  // Local reward preview — SURA backend is the authority on actual points.
  estimatedSuraPoints?: number;
  rewardScoreUnit?:    number;
  rewardPointsPerUnit?: number;
};

// ─── API response data shapes (provisional — subject to change by SURA) ───────

export type ValidatedSession = {
  session_id: string;
  player_id:  number;
  game_id:    string;
};

export type StartedSession = {
  session_id: string;
  game_id:    string;
};

export type CompletedSession = {
  session_id: string;
  game_id:    string;
  score:      number;
  status:     string;
};

// ─── postMessage event names ──────────────────────────────────────────────────
//
// Confirmed against the real host contract in sura-universal
// (MiniGamePlayerScreen.web.tsx): INIT_GAME is sent as { type, payload }, and
// the host listens for a completion message that is NOT enveloped — just
// { type: 'GAME_COMPLETE', sessionId, score, provider } flat on the message.
// All event strings are centralised here. Do NOT reference raw strings anywhere.

export const SURA_MSG = {
  // Host (SURA app) → game (iframe)
  INIT:             "INIT_GAME",
  PAUSE:            "SURA_MINIGAME_PAUSE",
  RESUME:           "SURA_MINIGAME_RESUME",
  // Game (iframe) → host (SURA app)
  READY:            "MINIGAME_READY",
  SESSION_ACCEPTED: "MINIGAME_SESSION_ACCEPTED",
  STARTED:          "MINIGAME_STARTED",
  COMPLETED:        "GAME_COMPLETE",
  ERROR:            "MINIGAME_ERROR",
  EXIT_REQUESTED:   "MINIGAME_EXIT_REQUESTED",
} as const;

export type SuraMsgType = typeof SURA_MSG[keyof typeof SURA_MSG];

// ─── postMessage envelope ─────────────────────────────────────────────────────
//
// Only inbound host → game messages use this { type, payload } shape. The
// outbound completion message to the host is flat (see SuraBridge.sendCompletion).

export type SuraEnvelope = {
  type:    SuraMsgType;
  payload: Record<string, unknown>;
};

// ─── Inbound payload for INIT_GAME ─────────────────────────────────────────────
//
// Matches buildInitMessage() in MiniGamePlayerScreen.web.tsx — camelCase,
// no player_id/game_id (the host doesn't send them).

export type InitPayload = {
  token:               string;
  sessionId:           string;
  username?:           string;
  referral?:           string;
  referredByNickname?: string;
};

// ─── Events emitted by SuraIntegrationService to scene subscribers ────────────

export type SuraServiceEvent =
  | { type: "state-changed"; state: SuraIntegrationState }
  | { type: "host-pause" }
  | { type: "host-resume" };

export type SuraServiceListener = (event: SuraServiceEvent) => void;
