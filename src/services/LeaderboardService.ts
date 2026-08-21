export type LeaderboardEntry = {
  alias:            string;
  score:            number;
  isCurrentPlayer?: boolean;
};

/** TODO: replace with real SURA API endpoint */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return [
    { alias: "AgusM",      score: 1890                    },
    { alias: "Nacho",      score: 1250, isCurrentPlayer: true },
    { alias: "Player3",    score:  980                    },
    { alias: "SpeedRun_G", score:  870                    },
    { alias: "PenguFan22", score:  744                    },
    { alias: "AstroKid",   score:  693                    },
    { alias: "RocketBoy",  score:  587                    },
    { alias: "Cosmo_ML",   score:  542                    },
    { alias: "StarDriftr", score:  498                    },
    { alias: "NightOwl",   score:  431                    },
    { alias: "Viper_XP",   score:  388                    },
    { alias: "ZeroGravity",score:  345                    },
  ];
}
