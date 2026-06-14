import { normalize, sanitizeText } from "./utils.js";

export const CHANNEL_KEYWORDS = {
  "Globo": ["globo", "rede globo", "globo sp", "globo rj"],
  "Sportv": ["sportv", "sportv 2", "sportv 3", "sportv hd", "sportv fhd"],
  "Premiere": ["premiere", "premiere clubes", "premiere hd", "premiere fhd"],
  "ESPN": ["espn", "espn brasil", "espn 2", "espn 3", "espn 4"],
  "TNT Sports": ["tnt sports", "tnt"],
  "SBT": ["sbt"],
  "Record": ["record"],
  "Band": ["band", "bandsports", "band sports"],
  "CazéTV": ["caze", "cazetv", "cazé tv", "cazé"],
  "Amazon Prime Video": ["prime video", "amazon prime"],
  "Disney Plus": ["disney plus", "disney+", "star plus", "star+"],
  "Paramount": ["paramount", "paramount+"],
  "Max": ["max", "hbo max", "hbo"],
  "OneFootball": ["onefootball", "one football"],
  "Canal GOAT": ["goat", "canal goat"],
  "UOL": ["uol"],
  "Nosso Futebol": ["nosso futebol"]
};

export function normalizeBroadcastName(value) {
  const clean = sanitizeText(value);
  const normalized = normalize(clean);
  for (const [name, keywords] of Object.entries(CHANNEL_KEYWORDS)) {
    if (normalize(name) === normalized || keywords.some((keyword) => normalized.includes(normalize(keyword)))) return name;
  }
  return clean;
}

export function broadcastForChannel(value) {
  const name = normalizeBroadcastName(value);
  return { name, keywords: CHANNEL_KEYWORDS[name] ?? [normalize(name)] };
}
