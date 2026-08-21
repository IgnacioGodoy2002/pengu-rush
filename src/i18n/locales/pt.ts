import type { TranslationKey } from "./es";

export const pt: Record<TranslationKey, string> = {

  // ── Menu ──────────────────────────────────────────────────────────────────
  menu_subtitle:            "Desvie dos meteoros\ne bata seu recorde",
  menu_record_label:        "★  Melhor pontuação",
  menu_play:                "JOGAR",
  menu_how_to_play:         "COMO JOGAR",
  menu_version:             "MVP v1.0",
  leaderboard_title:        "🏆 TOP JOGADORES",
  leaderboard_you:          "você",
  leaderboard_view_ranking: "VER RANKING",
  leaderboard_back:         "← VOLTAR",

  // ── Estado SURA (MenuScene) ───────────────────────────────────────────────
  sura_waiting:             "Aguardando sessão SURA...",
  sura_validating:          "Validando sessão...",
  sura_ready:               "Pronto!",
  sura_starting:            "Iniciando partida...",
  sura_unauthorized:        "Sessão não autorizada.",
  sura_error:               "Erro ao conectar com SURA.",

  // ── Instruções ────────────────────────────────────────────────────────────
  instr_title_1:            "COMO",
  instr_title_2:            "JOGAR",
  instr_section_controls:   "CONTROLES",
  instr_section_objective:  "OBJETIVO",
  instr_section_meteors:    "METEOROS",
  instr_section_points:     "PONTUAÇÃO",
  instr_section_shield:     "ESCUDO",
  instr_section_pause:      "PAUSA E ÁUDIO",
  instr_objective_text:     "Desvie e destrua meteoros.\nSobreviva o maior tempo possível e bata seu recorde.",
  instr_meteor_small:       "Pequeno  —  1 golpe para destruir",
  instr_meteor_medium:      "Médio  —  3 golpes para destruir",
  instr_meteor_large:       "Grande  —  7 golpes para destruir",
  instr_points_text:        "Destruir meteoros dá mais pontos do que desviar.\nOs meteoros grandes são os mais valiosos.",
  instr_shield_line1:       "Colete o símbolo cyan que cai do céu",
  instr_shield_line2:       "para ativar um escudo temporário.",
  instr_shield_line3:       "Absorve um choque e desaparece. Sem uso, expira sozinho.",
  instr_pause_line1:        "Use o botão PAUSA para pausar a partida.",
  instr_pause_line2:        "O botão de áudio silencia música e efeitos.",
  instr_back:               "VOLTAR AO MENU",

  // Controles — etiquetas
  ctrl_move:                "Mover a nave",
  ctrl_shoot:               "Atirar",
  ctrl_pause:               "Pausar a partida",
  // Controles — teclas / gestos
  ctrl_desktop_move_keys:   "← / →   ou   A / D",
  ctrl_desktop_shoot_key:   "ESPAÇO",
  ctrl_desktop_pause_keys:  "P",
  ctrl_touch_move_key:      "DESLIZE",
  ctrl_touch_shoot_key:     "FIRE",
  ctrl_touch_pause_key:     "PAUSA",

  // ── HUD (GameScene) ───────────────────────────────────────────────────────
  hud_score:                "Pontos: {value}",
  hud_record:               "Recorde: {value}",
  hud_controls_hint:        "A / D · setas · arrastar  |  P pausar  |  ESPAÇO atirar",
  countdown_go:             "VAI!",

  // Tutorial popup (GameScene)
  tutorial_move_hint:       "para mover",
  tutorial_shoot_hint:      "para atirar",

  // ── Pausa (GameScene) ─────────────────────────────────────────────────────
  pause_title:              "PAUSADO",
  pause_resume:             "CONTINUAR",
  pause_menu:               "VOLTAR AO MENU",

  // ── Game Over ─────────────────────────────────────────────────────────────
  gameover_title:           "GAME OVER",
  gameover_score:           "PONTOS: {score}",
  gameover_record:          "RECORDE: {record}",
  gameover_new_record:      "NOVO RECORDE!",
  gameover_time:            "TEMPO: {time}",
  gameover_destroyed:       "DESTRUÍDOS: {count}",
  gameover_retry:           "TENTAR DE NOVO",
  gameover_back_sura:       "VOLTAR AO SURA",
  gameover_mock_hint:       "Inicie uma nova sessão\na partir do host de teste",
  gameover_play_again:      "JOGAR DE NOVO",
  gameover_menu:            "MENU",
  gameover_sura_sent:       "Resultado enviado ✓",
  gameover_sura_error:      "Sessão indisponível.",

  // ── Popup de recompensa ───────────────────────────────────────────────────
  popup_winner_title:       "VOCÊ GANHOU!",
  popup_winner_stars:       "✦  ✦  ✦",
  popup_winner_score:       "Pontuação da partida: {score}",
  popup_loser_title:        "AINDA NÃO",
  popup_loser_brand:        "SURA POINTS",
  popup_loser_hint:         "A cada {scoreUnit} pontos você ganha",
  popup_continue:           "CONTINUAR",

};
