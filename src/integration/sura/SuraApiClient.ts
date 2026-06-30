import type {
  ApiResponse,
  CompletedSession,
  GameResult,
  StartedSession,
  SuraSessionContext,
  ValidatedSession,
} from "./SuraTypes";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISuraApiClient {
  validateSession(
    context: SuraSessionContext,
  ): Promise<ApiResponse<ValidatedSession>>;

  startSession(
    context: SuraSessionContext,
  ): Promise<ApiResponse<StartedSession>>;

  completeSession(
    context: SuraSessionContext,
    result: GameResult,
  ): Promise<ApiResponse<CompletedSession>>;
}

// ─── Real (stub) implementation ───────────────────────────────────────────────

/**
 * RealSuraApiClient — stub for future SURA backend integration.
 *
 * ⚠ STUB: Endpoints have not been provided by SURA yet.
 * All methods return a configuration error. The class exists so the
 * integration architecture is wire-ready once the backend becomes available.
 * Replace each method body with the real fetch call when endpoints are known.
 */
export class RealSuraApiClient implements ISuraApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    if (!baseUrl) throw new Error("[RealSuraApiClient] apiBaseUrl is required.");
    this.baseUrl = baseUrl;
  }

  async validateSession(
    _context: SuraSessionContext,
  ): Promise<ApiResponse<ValidatedSession>> {
    return this.notImplemented<ValidatedSession>();
  }

  async startSession(
    _context: SuraSessionContext,
  ): Promise<ApiResponse<StartedSession>> {
    return this.notImplemented<StartedSession>();
  }

  async completeSession(
    _context: SuraSessionContext,
    _result: GameResult,
  ): Promise<ApiResponse<CompletedSession>> {
    return this.notImplemented<CompletedSession>();
  }

  private notImplemented<T>(): ApiResponse<T> {
    return {
      success: false,
      errors:  [],
      message: `[RealSuraApiClient] Real endpoint not yet configured. Base URL: ${this.baseUrl}`,
    };
  }
}
