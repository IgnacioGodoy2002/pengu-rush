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
import type { ISuraApiClient } from "./SuraApiClient";
import { RealSuraApiClient } from "./SuraApiClient";
import { MockSuraApiClient } from "./MockSuraApiClient";

// ─── State machine ────────────────────────────────────────────────────────────
//
// disabled        → (standalone, no transitions)
// waiting-context → validating     (received SURA_MINIGAME_INIT)
// validating      → ready          (validateSession succeeded)
// validating      → unauthorized   (401 / 403)
// validating      → error          (network / unexpected error)
// ready           → starting       (startGameSession called)
// starting        → playing        (startSession succeeded)
// starting        → unauthorized   (401 / 403)
// starting        → error          (network error)
// playing         → completing     (completeGameSession called)
// completing      → completed      (completeSession succeeded)
// completing      → error          (network error)
// error           → completing     (retry via completeGameSession)
// error / unauthorized / completed → validating  (new INIT received)

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: SuraIntegrationService | null = null;

export function initSuraService(): SuraIntegrationService {
  if (!_instance) _instance = new SuraIntegrationService();
  return _instance;
}

export function getSuraService(): SuraIntegrationService {
  if (!_instance) {
    throw new Error(
      "[SURA] SuraIntegrationService not initialised. Call initSuraService() first (from BootScene).",
    );
  }
  return _instance;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SuraIntegrationService {
  private state: SuraIntegrationState;
  private readonly bridge: SuraBridge;
  private readonly client: ISuraApiClient | null;
  private context:  SuraSessionContext | null = null;
  private lastResult: GameResult | null = null;
  private readonly subscribers = new Set<SuraServiceListener>();
  private initialised = false;

  constructor() {
    this.state  = SURA_CONFIG.mode === "standalone" ? "disabled" : "waiting-context";
    this.bridge = new SuraBridge(SURA_CONFIG);
    this.client = this.buildClient();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  get mode(): IntegrationMode {
    return SURA_CONFIG.mode;
  }

  getState(): SuraIntegrationState {
    return this.state;
  }

  /**
   * Called once from BootScene after Phaser initialises.
   * Attaches the postMessage bridge and notifies the host that the game
   * is ready to receive a session context.
   */
  initialize(): void {
    if (this.initialised || SURA_CONFIG.mode === "standalone") return;
    this.initialised = true;
    this.bridge.start();
    this.registerBridgeHandlers();
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
   * In standalone mode returns true immediately.
   * In sura/sura-mock mode calls the API and resolves true only on success.
   */
  async startGameSession(): Promise<boolean> {
    if (SURA_CONFIG.mode === "standalone") return true;
    if (this.state !== "ready") return false;
    if (!this.client || !this.context) return false;

    this.setState("starting");

    try {
      const response = await this.client.startSession(this.context);
      if (!response.success) {
        const isAuthError = response.message.includes("401") || response.message.includes("403");
        this.setState(isAuthError ? "unauthorized" : "error");
        return false;
      }
      this.setState("playing");
      this.bridge.sendToParent(SURA_MSG.STARTED, {
        session_id: this.context.sessionId,
        game_id:    this.context.gameId,
      });
      return true;
    } catch {
      this.setState("error");
      return false;
    }
  }

  /**
   * Called from GameOverScene to record the game result.
   * Safe to call from "playing" (first attempt) or "error" (retry).
   * Stores the result internally so retryCompleteSession() can reuse it.
   */
  async completeGameSession(result: GameResult): Promise<void> {
    if (SURA_CONFIG.mode === "standalone") return;
    if (this.state !== "playing" && this.state !== "error") return;
    if (!this.client || !this.context) return;

    this.lastResult = result;
    this.setState("completing");

    try {
      const response = await this.client.completeSession(this.context, result);
      if (!response.success) {
        this.setState("error");
        return;
      }
      this.setState("completed");
      this.bridge.sendToParent(SURA_MSG.COMPLETED, {
        session_id: this.context.sessionId,
        game_id:    this.context.gameId,
        score:      result.score,
      });
    } catch {
      this.setState("error");
      this.bridge.sendToParent(SURA_MSG.ERROR, {
        session_id: this.context?.sessionId ?? "",
        message:    "completeSession network error",
      });
    }
  }

  /**
   * Retry the last completeGameSession call after an error.
   * No-op if there is no stored result or state is not "error".
   */
  async retryCompleteSession(): Promise<void> {
    if (this.state !== "error" || !this.lastResult) return;
    await this.completeGameSession(this.lastResult);
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

  private buildClient(): ISuraApiClient | null {
    const { mode } = SURA_CONFIG;
    if (mode === "standalone") return null;
    if (mode === "sura-mock") {
      if (!import.meta.env.DEV) {
        throw new Error("[SuraIntegrationService] sura-mock is only allowed in development.");
      }
      return new MockSuraApiClient();
    }
    return new RealSuraApiClient(SURA_CONFIG.apiBaseUrl);
  }

  private registerBridgeHandlers(): void {
    this.bridge.on(SURA_MSG.INIT,   (env) => this.handleInit(env.payload));
    this.bridge.on(SURA_MSG.PAUSE,  ()    => this.handleHostPause());
    this.bridge.on(SURA_MSG.RESUME, ()    => this.handleHostResume());
  }

  private notifyReady(): void {
    if (!SURA_CONFIG.isEmbedded) return;
    this.bridge.sendToParent(SURA_MSG.READY, {
      game_id: SURA_CONFIG.gameId,
      version: SURA_CONFIG.gameVersion,
    });
  }

  private handleInit(payload: Record<string, unknown>): void {
    const resettable: SuraIntegrationState[] = [
      "waiting-context", "completed", "error", "unauthorized",
    ];
    if (!resettable.includes(this.state)) return;

    // Parse and validate the payload shape.
    const p = payload as Partial<InitPayload>;
    const token      = typeof p.token      === "string" ? p.token      : null;
    const session_id = typeof p.session_id === "string" ? p.session_id : null;
    const player_id  = typeof p.player_id  === "number" ? p.player_id  : null;
    const game_id    = typeof p.game_id    === "string" ? p.game_id    : null;

    if (!token || !session_id || player_id === null || !game_id) {
      this.setState("error");
      this.bridge.sendToParent(SURA_MSG.ERROR, { message: "Invalid SURA_MINIGAME_INIT payload." });
      return;
    }

    this.context = {
      token,
      sessionId: session_id,
      playerId:  player_id,
      gameId:    game_id,
      nickname:  typeof p.nickname === "string" ? p.nickname : undefined,
    };

    // Notify host that we received the context.
    this.bridge.sendToParent(SURA_MSG.SESSION_ACCEPTED, {
      session_id,
      game_id,
    });

    // Start validating.
    this.setState("validating");
    void this.runValidation();
  }

  private async runValidation(): Promise<void> {
    if (!this.client || !this.context) {
      this.setState("error");
      return;
    }
    try {
      const response = await this.client.validateSession(this.context);
      if (!response.success) {
        const isAuthError = response.message.includes("401") || response.message.includes("403");
        this.setState(isAuthError ? "unauthorized" : "error");
        return;
      }
      this.setState("ready");
    } catch {
      this.setState("error");
    }
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
