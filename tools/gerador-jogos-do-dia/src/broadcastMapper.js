import { normalize, unique } from "./utils.js";

export const CHANNEL_KEYWORDS = {
  "Globo": ["globo", "rede globo", "globo sp", "globo rj"],
  "Sportv": ["sportv", "sportv hd", "sportv fhd", "sportv 2", "sportv 3"],
  "Premiere": ["premiere", "premiere clubes", "premiere hd", "premiere fhd"],
  "ESPN": ["espn", "espn brasil", "espn hd", "espn fhd", "espn 2", "espn 3", "espn 4"],
  "TNT Sports": ["tnt sports", "tnt"],
  "HBO Max": ["hbo max", "max"],
  "SBT": ["sbt"],
  "Caz\u00e9TV": ["caze", "cazetv", "caz\u00e9 tv"],
  "Band": ["band", "band sports", "bandsports"],
  "Record": ["record", "record tv"],
  "Amazon Prime Video": ["prime video", "amazon prime"],
  "Disney Plus": ["disney plus", "disney+", "star plus", "star+"],
  "Paramount": ["paramount", "paramount+"],
  "OneFootball": ["onefootball", "one football"]
};

const RULES = [
  { tokens: ["brasileirao serie a", "campeonato brasileiro serie a"], channels: ["Globo", "Sportv", "Premiere"] },
  { tokens: ["brasileirao serie b", "campeonato brasileiro serie b"], channels: ["Sportv", "Premiere"] },
  { tokens: ["copa do brasil"], channels: ["Globo", "Sportv", "Premiere", "Amazon Prime Video"] },
  { tokens: ["libertadores"], channels: ["Globo", "ESPN", "Disney Plus", "Paramount"] },
  { tokens: ["sul americana", "sudamericana"], channels: ["ESPN", "Disney Plus", "Paramount"] },
  { tokens: ["champions league"], channels: ["TNT Sports", "HBO Max", "SBT"] },
  { tokens: ["copa do mundo", "world cup"], channels: ["Globo", "Sportv", "Caz\u00e9TV"] },
  { tokens: ["eliminatorias", "qualifiers"], channels: ["Globo", "Sportv"] },
  { tokens: ["premier league"], channels: ["ESPN", "Disney Plus"] },
  { tokens: ["la liga", "laliga"], channels: ["ESPN", "Disney Plus"] },
  { tokens: ["serie a italia", "serie a italy", "italian serie a"], channels: ["ESPN", "Disney Plus"] },
  { tokens: ["bundesliga"], channels: ["Caz\u00e9TV", "OneFootball", "Sportv"] },
  { tokens: ["ligue 1"], channels: ["ESPN", "Disney Plus"] }
];

export function broadcastsForCompetition(competition) {
  const normalized = normalize(competition);
  const rule = RULES.find((item) => item.tokens.some((token) => normalized.includes(normalize(token))));
  return (rule?.channels ?? []).map((name) => ({
    name,
    keywords: CHANNEL_KEYWORDS[name] ?? [normalize(name)]
  }));
}

export function searchKeywordsForGame(game, broadcasts) {
  const competitionTokens = competitionSearchTokens(game.competition);
  return unique([
    game.homeTeam,
    game.awayTeam,
    game.competition,
    ...competitionTokens,
    ...broadcasts.map((item) => item.name)
  ]);
}

function competitionSearchTokens(competition) {
  const normalized = normalize(competition);
  if (normalized.includes("brasileirao")) return ["Brasileirao"];
  if (normalized.includes("libertadores")) return ["Libertadores"];
  if (normalized.includes("sul americana") || normalized.includes("sudamericana")) return ["Sul-Americana"];
  if (normalized.includes("champions")) return ["Champions League"];
  return [];
}