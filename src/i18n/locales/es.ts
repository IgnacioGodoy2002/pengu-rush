// Español (Rioplatense) — archivo base; TranslationKey se deriva de este objeto.
export const es = {

  // ── Menú ──────────────────────────────────────────────────────────────────
  menu_subtitle:            "Esquivá los meteoritos\ny superá tu récord",
  menu_record_label:        "★  Récord personal",
  menu_play:                "JUGAR",
  menu_how_to_play:         "CÓMO JUGAR",
  menu_version:             "MVP v1.0",

  // ── Estado SURA (MenuScene) ───────────────────────────────────────────────
  sura_waiting:             "Esperando sesión SURA...",
  sura_validating:          "Validando sesión...",
  sura_ready:               "¡Listo!",
  sura_starting:            "Iniciando partida...",
  sura_unauthorized:        "Sesión no autorizada.",
  sura_error:               "Error al conectar con SURA.",

  // ── Instrucciones ─────────────────────────────────────────────────────────
  instr_title_1:            "CÓMO",
  instr_title_2:            "JUGAR",
  instr_section_controls:   "CONTROLES",
  instr_section_objective:  "OBJETIVO",
  instr_section_meteors:    "METEORITOS",
  instr_section_points:     "PUNTOS",
  instr_section_shield:     "ESCUDO",
  instr_section_pause:      "PAUSA Y AUDIO",
  instr_objective_text:     "Esquivá y destruí meteoritos.\nSobreviví el mayor tiempo posible y superá tu récord.",
  instr_meteor_small:       "Pequeño  —  1 golpe para destruir",
  instr_meteor_medium:      "Mediano  —  3 golpes para destruir",
  instr_meteor_large:       "Grande  —  7 golpes para destruir",
  instr_points_text:        "Destruir meteoritos da más puntos que esquivarlos.\nLos meteoritos grandes son los más valiosos.",
  instr_shield_line1:       "Recogé el símbolo cyan que cae del cielo",
  instr_shield_line2:       "para activar un escudo temporal.",
  instr_shield_line3:       "Absorbe un choque y desaparece. Sin usarlo, expira solo.",
  instr_pause_line1:        "Usá el botón PAUSA para detener la partida.",
  instr_pause_line2:        "El botón de audio silencia música y efectos.",
  instr_back:               "VOLVER AL MENÚ",

  // Controles — etiquetas (iguales para touch y desktop)
  ctrl_move:                "Mover la nave",
  ctrl_shoot:               "Disparar",
  ctrl_pause:               "Pausar la partida",
  // Controles — teclas / gestos (específicos por dispositivo)
  ctrl_desktop_move_keys:   "← / →   ó   A / D",
  ctrl_desktop_shoot_key:   "ESPACIO",
  ctrl_desktop_pause_keys:  "P",
  ctrl_touch_move_key:      "DESLIZÁ",
  ctrl_touch_shoot_key:     "FIRE",
  ctrl_touch_pause_key:     "PAUSA",

  // ── HUD (GameScene) ───────────────────────────────────────────────────────
  hud_score:                "Puntaje: {value}",
  hud_record:               "Récord: {value}",
  hud_controls_hint:        "A / D · flechas · arrastrar  |  P pausa  |  ESPACIO disparar",
  countdown_go:             "YA!",

  // Tutorial popup (GameScene)
  tutorial_move_hint:       "para moverte",
  tutorial_shoot_hint:      "para disparar",

  // ── Pausa (GameScene) ─────────────────────────────────────────────────────
  pause_title:              "PAUSA",
  pause_resume:             "CONTINUAR",
  pause_menu:               "VOLVER AL MENÚ",

  // ── Game Over ─────────────────────────────────────────────────────────────
  gameover_title:           "GAME OVER",
  gameover_score:           "PUNTAJE: {score}",
  gameover_record:          "RÉCORD: {record}",
  gameover_new_record:      "¡NUEVO RÉCORD!",
  gameover_time:            "TIEMPO: {time}",
  gameover_destroyed:       "DESTRUIDOS: {count}",
  gameover_retry:           "REINTENTAR",
  gameover_back_sura:       "VOLVER A SURA",
  gameover_mock_hint:       "Iniciá una nueva sesión\ndesde el host de prueba",
  gameover_play_again:      "JUGAR DE NUEVO",
  gameover_menu:            "MENÚ",
  gameover_sura_sent:       "Resultado enviado ✓",
  gameover_sura_error:      "Sesión no disponible.",

  // ── Popup de recompensa ───────────────────────────────────────────────────
  popup_winner_title:       "¡GANASTE!",
  popup_winner_stars:       "✦  ✦  ✦",
  popup_winner_score:       "Puntaje de la partida: {score}",
  popup_loser_title:        "AÚN NO GANASTE",
  popup_loser_brand:        "SURA POINTS",
  popup_loser_hint:         "Cada {scoreUnit} puntos sumás",
  popup_continue:           "CONTINUAR",

} as const;

export type TranslationKey = keyof typeof es;
