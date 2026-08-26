// ─── Local SURA reward configuration ─────────────────────────────────────────
//
// Used to preview SURA Points in the post-game popup.
// This is a LOCAL simulation only — the SURA backend is the authority on
// actual accrued points. These values will eventually be overridden by
// configuration received from the SURA back office.

export const LOCAL_SURA_REWARD_CONFIG = {
  scoreUnit:     300,
  pointsPerUnit: 50,
  currencyLabel: "SURA Points",
  popupEnabled:  false,
} as const;

/**
 * Estimated SURA Points earned in a session.
 *
 * Points are awarded only for crossing NEW scoreUnit thresholds in the
 * all-time best score. If this session didn't beat the previous record,
 * returns 0.
 *
 * Formula (only when sessionScore > prevBestScore):
 *   (floor(sessionScore / scoreUnit) − floor(prevBestScore / scoreUnit)) * pointsPerUnit
 *
 * Examples (scoreUnit=300, pointsPerUnit=50):
 *   prevBest=1275, session=315  → 0   (didn't beat record)
 *   prevBest=0,    session=315  → 50  (crossed 1 new threshold)
 *   prevBest=900,  session=1200 → 50  (floor(1200/300)=4 − floor(900/300)=3 → 1 tramo)
 *   prevBest=850,  session=1300 → 100 (floor(1300/300)=4 − floor(850/300)=2 → 2 tramos)
 *
 * This is a local preview only. The SURA backend calculates the
 * authoritative value after receiving MINIGAME_COMPLETED.
 */
export function calcSuraPoints(sessionScore: number, prevBestScore: number): number {
  if (sessionScore <= prevBestScore) return 0;
  const { scoreUnit, pointsPerUnit } = LOCAL_SURA_REWARD_CONFIG;
  const tramosAntes = Math.floor(prevBestScore / scoreUnit);
  const tramosAhora = Math.floor(sessionScore / scoreUnit);
  return (tramosAhora - tramosAntes) * pointsPerUnit;
}
