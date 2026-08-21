import { test, expect, Page } from "@playwright/test";

const LOCALE_KEY = "pengu-rush:locale";

// Chip coordinates in Phaser canvas space (720×1280).
// With viewport exactly 720×1280 and autoCenter:CENTER_BOTH the canvas
// sits at CSS (0,0), so Phaser coords == CSS pixel coords.
//
// Computed from MenuScene layout (panelCY=614.40, top=94.40, PANEL_H=1040):
//   comoY≈803.4, TOP3+rankBtn section, langY≈1053.4
//   totalW=172 (3×52 + 2×8), startX=360-86=274
//   ES: kx=300  EN: kx=360  PT: kx=420
const CHIPS = {
  es: { x: 300, y: 1053 },
  en: { x: 360, y: 1053 },
  pt: { x: 420, y: 1053 },
} as const;

/** Resolves when I18nService sets window.__penguLocale__ (fires at bundle load). */
async function waitForLocale(page: Page): Promise<string> {
  await page.waitForFunction(
    () => typeof (window as any).__penguLocale__ === "string",
    { timeout: 8000 },
  );
  return page.evaluate(() => (window as any).__penguLocale__ as string);
}

/**
 * Resolves when the MenuScene w3 tween completes (all UI including chips
 * fully visible and interactive). Phaser blocks pointer events on alpha=0
 * objects, so we must wait for the fade to finish before clicking.
 */
async function waitForSceneReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as any).__penguSceneReady__ === true,
    { timeout: 10000 },
  );
}

// ── 1. Auto-detection from navigator.language ─────────────────────────────────

test.describe("i18n auto-detection via navigator.language", () => {
  const cases: [string, string][] = [
    ["es-AR", "es"],
    ["en-US", "en"],
    ["pt-BR", "pt"],
    ["fr-FR", "en"], // unsupported locale → fallback to English
  ];

  for (const [navLang, expected] of cases) {
    test(`navigator.language "${navLang}" → locale "${expected}"`, async ({ browser }) => {
      // Each newContext() starts with empty storage (isolated, no cross-test bleed).
      const ctx = await browser.newContext({ locale: navLang });
      const page = await ctx.newPage();
      // Belt-and-suspenders: clear localStorage before the bundle runs.
      await page.addInitScript(() => localStorage.clear());
      await page.goto("/");
      const detected = await waitForLocale(page);
      expect(detected).toBe(expected);
      await ctx.close();
    });
  }
});

// ── 2. localStorage preference persists over navigator.language ───────────────

test.describe("i18n localStorage persistence", () => {
  test("pre-saved locale overrides navigator.language on load", async ({ browser }) => {
    // navigator.language says Spanish but we pre-set Portuguese in storage.
    const ctx = await browser.newContext({ locale: "es-AR" });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("pengu-rush:locale", "pt");
    });
    await page.goto("/");
    expect(await waitForLocale(page)).toBe("pt");
    await ctx.close();
  });

  test("locale survives a hard reload", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "en-US" });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("pengu-rush:locale", "pt");
    });
    await page.goto("/");
    await waitForLocale(page);

    // Hard reload — addInitScript does NOT re-run, real localStorage is used.
    await page.reload();
    expect(await waitForLocale(page)).toBe("pt");
    await ctx.close();
  });
});

// ── 3. Chip click saves to localStorage and survives reload ───────────────────

test.describe("i18n chip selection", () => {
  test("clicking EN chip saves locale and persists after reload", async ({ browser }) => {
    // Use exact canvas size so Phaser coords == CSS pixels (no scaling offset).
    const ctx = await browser.newContext({
      locale: "es-AR",
      viewport: { width: 720, height: 1280 },
    });
    const page = await ctx.newPage();
    // newContext() guarantees empty storage — no addInitScript needed.
    // addInitScript re-runs on every navigation (including reload), which
    // would wipe the locale we just saved via the chip click.
    await page.goto("/");

    // Wait for chips to be fully visible (alpha=1) and interactive.
    await waitForSceneReady(page);
    expect(await waitForLocale(page)).toBe("es");

    // Reset the ready flag before clicking so we can detect the post-restart scene.
    await page.evaluate(() => { (window as any).__penguSceneReady__ = false; });

    // Click EN chip — triggers setLocale('en') + scene.restart().
    await page.mouse.click(CHIPS.en.x, CHIPS.en.y);

    // setLocale() sets __penguLocale__ synchronously before restart.
    await page.waitForFunction(
      () => (window as any).__penguLocale__ === "en",
      { timeout: 6000 },
    );

    const saved = await page.evaluate(() => localStorage.getItem("pengu-rush:locale"));
    expect(saved).toBe("en");

    // Reload — real localStorage persists; addInitScript does not re-run.
    await page.reload();
    expect(await waitForLocale(page)).toBe("en");

    await ctx.close();
  });

  test("clicking PT chip saves locale and persists after reload", async ({ browser }) => {
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 720, height: 1280 },
    });
    const page = await ctx.newPage();
    await page.goto("/");

    await waitForSceneReady(page);
    expect(await waitForLocale(page)).toBe("en");

    await page.evaluate(() => { (window as any).__penguSceneReady__ = false; });
    await page.mouse.click(CHIPS.pt.x, CHIPS.pt.y);

    await page.waitForFunction(
      () => (window as any).__penguLocale__ === "pt",
      { timeout: 6000 },
    );

    const saved = await page.evaluate(() => localStorage.getItem("pengu-rush:locale"));
    expect(saved).toBe("pt");

    await page.reload();
    expect(await waitForLocale(page)).toBe("pt");

    await ctx.close();
  });
});
