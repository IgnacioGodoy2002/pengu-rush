import {
  SURA_MSG,
  type GameResult,
  type InitPayload,
  type IntegrationMode,
  type SuraIntegrationState,
  type SuraServiceListener,
  type SuraSessionContext,
} from "./SuraTypes";
import { SURA_CONFIG } from "./SuraRuntimeConfig";
import { SuraBridge } from "./SuraBridge";

// Self-announced in MINIGAME_READY, before the host's INIT_GAME (and its real
// backend UUID) has arrived. Purely informational on the host's side.
const GAME_SLUG = "pengu_rush";

// ─── State machine (parent-submit flow) ──────────────────────────────────────
//
// disabled        → (standalone — no bridge, no transitions)
// waiting-context → ready        (received valid INIT_GAME)
// ready           → playing      (startGameSession called — MINIGAME_STARTED sent)
// playing         → completed    (completeGameSession called — GAME_COMPLETE sent)
// completed       → ready        (new INIT_GAME received)
// waiting-context
//   | ready
//   | completed    → error       (invalid INIT payload received)
//
// Parent-submit model: the game communicates ONLY via postMessage.
// No HTTP calls are made from the game (the leaderboard fetch is the one
// exception — see LeaderboardService — since it hits a public, unauthenticated
// endpoint and needs no session of its own).

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: SuraIntegrationService | null = null;

export function initSuraService(): SuraIntegrationService {
  if (!_instance) _instance = new SuraIntegrationService();
  return _instance;
}

export function getSuraService(): SuraIntegrationService {
  if (!_instance) {
    throw new Error(
      "[SURA] SuraIntegrationService not initialised. Call initSuraService() first (from main.ts).",
    );
  }
  return _instance;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SuraIntegrationService {
  private state: SuraIntegrationState;
  private readonly bridge: SuraBridge;
  private context:  SuraSessionContext | null = null;
  private readonly subscribers = new Set<SuraServiceListener>();
  private initialised = false;

  constructor() {
    this.state  = SURA_CONFIG.mode === "standalone" ? "disabled" : "waiting-context";
    this.bridge = new SuraBridge(SURA_CONFIG);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  get mode(): IntegrationMode {
    return SURA_CONFIG.mode;
  }

  getState(): SuraIntegrationState {
    return this.state;
  }

  /** Correlation hash from the host's INIT_GAME — NOT a bearer token, never sent as one. */
  getSessionToken(): string | null {
    return this.context?.token ?? null;
  }

  /** The player's own display name, as sent by the host — used to flag "me" in a leaderboard. */
  getNickname(): string | null {
    return this.context?.nickname ?? null;
  }

  /** The mini-game's backend UUID, from INIT_GAME — null until the handshake completes. */
  getGameId(): string | null {
    return this.context?.gameId || null;
  }

  /** Base URL for the (public) leaderboard fetch, from INIT_GAME — null until the handshake completes. */
  getApiBaseUrl(): string | null {
    return this.context?.apiBaseUrl || null;
  }

  /**
   * Called once from main.ts, before Phaser even boots.
   * Attaches the postMessage bridge and notifies the host that the game
   * is ready to receive a session context.
   *
   * Must run before the host's INIT_GAME arrives, which can be as early as
   * the iframe's own `load` event — well before BootScene.preload() finishes
   * loading audio/image assets, so this can't wait for that.
   */
  initialize(): void {
    if (this.initialised || SURA_CONFIG.mode === "standalone") return;
    this.initialised = true;
    this.bridge.start();
    this.registerBridgeHandlers();
    this.notifyReady();
  }

  /**
   * Asks the host for a new session by re-sending MINIGAME_READY — the same
   * message that opens the handshake the first time. Per the host's
   * contract, it re-sends INIT_GAME "when it receives your MINIGAME_READY",
   * so this is also how a *second* session gets requested.
   *
   * Needed because after GAME_COMPLETE the state is "completed" and nothing
   * else moves it back to "ready": MenuScene gates the JUGAR button on
   * `state === "ready"`, so without this, returning to the menu after
   * finishing a run leaves JUGAR permanently disabled — there's no reason
   * for the host to volunteer a fresh INIT_GAME on its own, since nothing
   * asked it to.
   *
   * No-op outside the states where asking again makes sense (mid-game, or
   * already waiting for the first context).
   */
  requestFreshSession(): void {
    if (SURA_CONFIG.mode === "standalone") return;
    const resettable: SuraIntegrationState[] = ["completed", "error", "unauthorized"];
    if (!resettable.includes(this.state)) return;

    this.setState("waiting-context");
    this.notifyReady();
  }

  /**
   * Subscribe to service events (state changes, host pause/resume).
   * Scenes should unsubscribe on their SHUTDOWN event.
   */
  subscribe(listener: SuraServiceListener): void {
    this.subscribers.add(listener);
  }

  unsubscribe(listener: SuraServiceListener): void {
    this.subscribers.delete(listener);
  }

  /**
   * Called from MenuScene before transitioning to GameScene.
   *
   * Standalone: returns true immediately.
   * SURA (parent-submit): sends MINIGAME_STARTED, transitions to "playing".
   * This now actually matters to the host — it stamps the run's real start
   * time server-side, instead of anti-cheat timing it from screen-open.
   */
  async startGameSession(): Promise<boolean> {
    if (SURA_CONFIG.mode === "standalone") return true;
    if (this.state !== "ready") return false;
    if (!this.context) return false;

    this.setState("playing");
    this.bridge.sendToParent(SURA_MSG.STARTED, {
      session_id: this.context.sessionId,
      game_id:    this.context.gameId,
    });
    return true;
  }

  /**
   * Called from GameOverScene to report the game result.
   *
   * SURA (parent-submit): sends GAME_COMPLETE via postMessage.
   * The host receives the score and is responsible for persisting it.
   * No HTTP calls are made from the game.
   */
  async completeGameSession(result: GameResult): Promise<void> {
    if (SURA_CONFIG.mode === "standalone") return;
    if (this.state !== "playing") return;
    if (!this.context) return;

    // Flat, unenveloped — matches what the host listens for. duration_ms is
    // optional but worth sending: the server takes min(its own measured
    // time, duration_ms), so an honest report can only lower the anti-cheat
    // ceiling, never raise it, and gets the run judged against how long it
    // actually lasted instead of how long the screen was open.
    this.bridge.sendCompletion({
      sessionId:  this.context.sessionId,
      score:      result.score,
      provider:   "tingz",
      durationMs: result.survivedMs,
    });
    this.setState("completed");
  }

  /**
   * Ask the parent (SURA app) to close the minigame iframe.
   * Used in real "sura" mode by the "VOLVER A SURA" button.
   */
  requestExit(): void {
    if (SURA_CONFIG.mode !== "sura") return;
    this.bridge.sendToParent(SURA_MSG.EXIT_REQUESTED, {});
  }

  destroy(): void {
    this.bridge.destroy();
    this.subscribers.clear();
    _instance = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private registerBridgeHandlers(): void {
    this.bridge.on(SURA_MSG.INIT,   (env) => this.handleInit(env.payload));
    this.bridge.on(SURA_MSG.PAUSE,  ()    => this.handleHostPause());
    this.bridge.on(SURA_MSG.RESUME, ()    => this.handleHostResume());
  }

  private notifyReady(): void {
    // Always targets "*" — the host's origin isn't known until its own
    // INIT_GAME arrives, and this is the message that has to go out first to
    // start that handshake. Carries nothing sensitive.
    this.bridge.sendReady({ game_id: GAME_SLUG, version: SURA_CONFIG.gameVersion });
  }

  private handleInit(payload: Record<string, unknown>): void {
    const resettable: SuraIntegrationState[] = [
      "waiting-context", "completed", "error", "unauthorized",
    ];
    if (!resettable.includes(this.state)) return;

    // Validate required INIT fields. gameId/apiBaseUrl are new (§5 of the
    // host's integration spec) and optional in the type only so an older
    // host that hasn't rolled them out yet doesn't hard-fail the handshake —
    // the leaderboard fetch just falls back to the preview board without them.
    const p = payload as Partial<InitPayload>;
    const token     = typeof p.token     === "string" ? p.token     : null;
    const sessionId = typeof p.sessionId === "string" ? p.sessionId : null;

    if (!token || !sessionId) {
      this.setState("error");
      this.bridge.sendToParent(SURA_MSG.ERROR, { message: "Invalid INIT_GAME payload." });
      return;
    }

    // Store context in memory only — never logged, never persisted.
    this.context = {
      token,
      sessionId,
      gameId:     typeof p.gameId === "string" ? p.gameId : "",
      apiBaseUrl: typeof p.apiBaseUrl === "string" ? p.apiBaseUrl : "",
      // The display name to show — may legitimately be empty (player with no
      // nickname). Callers show a generic placeholder, never an invented one.
      nickname:   typeof p.username === "string" ? p.username : undefined,
    };

    // Acknowledge receipt of the context.
    this.bridge.sendToParent(SURA_MSG.SESSION_ACCEPTED, {
      session_id: sessionId,
      game_id:    this.context.gameId,
    });

    // parent-submit: context is trusted as-is — no backend validation needed.
    // Enable the JUGAR button immediately.
    this.setState("ready");
  }

  private handleHostPause(): void {
    this.emit({ type: "host-pause" });
  }

  private handleHostResume(): void {
    this.emit({ type: "host-resume" });
  }

  private setState(next: SuraIntegrationState): void {
    this.state = next;
    this.emit({ type: "state-changed", state: next });
  }

  private emit(event: Parameters<SuraServiceListener>[0]): void {
    for (const listener of this.subscribers) {
      listener(event);
    }
  }
}
