import type { IntegrationMode } from "./SuraTypes";

// Provisional identifiers — replace with SURA-confirmed values when available.
const PROVISIONAL_GAME_ID      = "pengu_rush";
const PROVISIONAL_GAME_VERSION = "1.0.0";

export type SuraConfig = {
  readonly mode:          IntegrationMode;
  readonly gameId:        string;
  readonly gameVersion:   string;
  readonly parentOrigin:  string;
  readonly apiBaseUrl:    string;
  readonly isEmbedded:    boolean;
  readonly isDev:         boolean;
};

function buildConfig(): SuraConfig {
  const isDev      = import.meta.env.DEV as boolean;
  const isEmbedded = window.parent !== window;

  const gameId      = (import.meta.env.VITE_SURA_GAME_ID       as string | undefined) ?? PROVISIONAL_GAME_ID;
  const gameVersion = (import.meta.env.VITE_SURA_GAME_VERSION  as string | undefined) ?? PROVISIONAL_GAME_VERSION;
  const envOrigin   = (import.meta.env.VITE_SURA_PARENT_ORIGIN as string | undefined) ?? "";
  const envBaseUrl  = (import.meta.env.VITE_SURA_API_BASE_URL  as string | undefined) ?? "";

  // ── Mode detection ─────────────────────────────────────────────────────
  let mode: IntegrationMode;

  if (!isDev) {
    // Production: only "sura" or "standalone" — "sura-mock" is never allowed.
    const envMode = import.meta.env.VITE_SURA_INTEGRATION_MODE as string | undefined;
    mode = envMode === "sura" ? "sura" : "standalone";
  } else {
    // Development: ?sura_mode=mock activates the mock bridge.
    const params = new URLSearchParams(window.location.search);
    mode = params.get("sura_mode") === "mock" ? "sura-mock" : "standalone";
  }

  // ── Parent origin ──────────────────────────────────────────────────────
  let parentOrigin = envOrigin;
  if (mode === "sura-mock" && !parentOrigin) {
    // Game and test-host are both served by Vite on the same origin.
    parentOrigin = window.location.origin;
  }

  // ── Validation for real sura mode ─────────────────────────────────────
  // parentOrigin is required for postMessage security (origin-pinning).
  // A missing value falls back to standalone so the game still loads visibly
  // rather than crashing with a blank screen.
  if (mode === "sura" && !parentOrigin) {
    console.error(
      "[SuraRuntimeConfig] VITE_SURA_PARENT_ORIGIN is required when " +
      "VITE_SURA_INTEGRATION_MODE=sura. Falling back to standalone mode.",
    );
    mode = "standalone";
  }

  // apiBaseUrl is not required for the parent-submit flow (the host
  // persists the score; the game only communicates via postMessage).

  return { mode, gameId, gameVersion, parentOrigin, apiBaseUrl: envBaseUrl, isEmbedded, isDev };
}

// Singleton — built once at module load time.
export const SURA_CONFIG: SuraConfig = buildConfig();
