import type { TranslationKey } from "./es";

export const en: Record<TranslationKey, string> = {

  // ── Menu ──────────────────────────────────────────────────────────────────
  menu_subtitle:            "Dodge meteors\nand beat your record",
  menu_record_label:        "★  Personal best",
  menu_play:                "PLAY",
  menu_how_to_play:         "HOW TO PLAY",
  menu_version:             "MVP v1.0",

  // ── SURA status (MenuScene) ───────────────────────────────────────────────
  sura_waiting:             "Waiting for SURA session...",
  sura_validating:          "Validating session...",
  sura_ready:               "Ready!",
  sura_starting:            "Starting game...",
  sura_unauthorized:        "Session unauthorized.",
  sura_error:               "Error connecting to SURA.",

  // ── Instructions ──────────────────────────────────────────────────────────
  instr_title_1:            "HOW",
  instr_title_2:            "TO PLAY",
  instr_section_controls:   "CONTROLS",
  instr_section_objective:  "OBJECTIVE",
  instr_section_meteors:    "METEORS",
  instr_section_points:     "POINTS",
  instr_section_shield:     "SHIELD",
  instr_section_pause:      "PAUSE & AUDIO",
  instr_objective_text:     "Dodge and destroy meteors.\nSurvive as long as possible and beat your record.",
  instr_meteor_small:       "Small  —  1 hit to destroy",
  instr_meteor_medium:      "Medium  —  3 hits to destroy",
  instr_meteor_large:       "Large  —  7 hits to destroy",
  instr_points_text:        "Destroying meteors scores more than dodging them.\nLarge meteors are the most valuable.",
  instr_shield_line1:       "Collect the cyan icon falling from the sky",
  instr_shield_line2:       "to activate a temporary shield.",
  instr_shield_line3:       "It absorbs one hit, then disappears. Uncollected, it expires on its own.",
  instr_pause_line1:        "Use the PAUSE button to stop the game.",
  instr_pause_line2:        "The audio button mutes music and effects.",
  instr_back:               "BACK TO MENU",

  // Controls — labels
  ctrl_move:                "Move the ship",
  ctrl_shoot:               "Shoot",
  ctrl_pause:               "Pause",
  // Controls — keys / gestures
  ctrl_desktop_move_keys:   "← / →   or   A / D",
  ctrl_desktop_shoot_key:   "SPACE",
  ctrl_desktop_pause_keys:  "P",
  ctrl_touch_move_key:      "SWIPE",
  ctrl_touch_shoot_key:     "FIRE",
  ctrl_touch_pause_key:     "PAUSE",

  // ── HUD (GameScene) ───────────────────────────────────────────────────────
  hud_score:                "Score: {value}",
  hud_record:               "Best: {value}",
  hud_level:                "Level: {value}",
  hud_controls_hint:        "A / D · arrows · drag  |  P pause  |  SPACE shoot",
  countdown_go:             "GO!",

  // Tutorial popup (GameScene)
  tutorial_move_hint:       "to move",
  tutorial_shoot_hint:      "to shoot",

  // ── Pause overlay (GameScene) ─────────────────────────────────────────────
  pause_title:              "PAUSED",
  pause_resume:             "RESUME",
  pause_menu:               "BACK TO MENU",

  // ── Game Over ─────────────────────────────────────────────────────────────
  gameover_title:           "GAME OVER",
  gameover_score:           "SCORE: {score}",
  gameover_record:          "BEST: {record}",
  gameover_new_record:      "NEW RECORD!",
  gameover_time:            "TIME: {time}",
  gameover_destroyed:       "DESTROYED: {count}",
  gameover_level:           "LEVEL: {level}",
  gameover_retry:           "RETRY",
  gameover_back_sura:       "BACK TO SURA",
  gameover_mock_hint:       "Start a new session\nfrom the test host",
  gameover_play_again:      "PLAY AGAIN",
  gameover_menu:            "MENU",
  gameover_sura_sent:       "Result submitted ✓",
  gameover_sura_error:      "Session unavailable.",

  // ── Reward popup ──────────────────────────────────────────────────────────
  popup_winner_title:       "YOU WON!",
  popup_winner_stars:       "✦  ✦  ✦",
  popup_winner_score:       "Game score: {score}",
  popup_loser_title:        "NOT YET",
  popup_loser_brand:        "SURA POINTS",
  popup_loser_hint:         "Every {scoreUnit} points earns",
  popup_continue:           "CONTINUE",

};
