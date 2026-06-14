import { normalize } from "./utils.js";

const IMPORTANT_COMPETITIONS = [
  "brasileirao serie a",
  "brasileirao serie b",
  "campeonato brasileiro serie a",
  "campeonato brasileiro serie b",
  "copa do brasil",
  "libertadores",
  "sul americana",
  "sudamericana",
  "champions league",
  "copa do mundo",
  "world cup",
  "eliminatorias",
  "qualifiers",
  "premier league",
  "la liga",
  "laliga",
  "serie a italia",
  "serie a italy",
  "italian serie a",
  "bundesliga",
  "ligue 1",
  "mundial de clubes",
  "club world cup"
];

const BRAZILIAN_MARKERS = [
  "brazil",
  "brasil",
  "brasileira",
  "brasileiro"
];

const BRAZILIAN_TEAMS = [
  "flamengo", "palmeiras", "corinthians", "sao paulo", "santos", "vasco", "botafogo",
  "fluminense", "gremio", "internacional", "atletico mineiro", "cruzeiro", "bahia",
  "fortaleza", "ceara", "sport", "vitoria", "athletico", "coritiba", "goias",
  "atletico goianiense", "bragantino", "juventude", "cuiaba", "america mineiro",
  "chapecoense", "avai", "criciuma", "ponte preta", "guarani", "remo", "paysandu"
];

export function isRelevantGame(game) {
  const competition = normalize(game.competition);
  const home = normalize(game.homeTeam);
  const away = normalize(game.awayTeam);
  const country = normalize(game.country);

  if (IMPORTANT_COMPETITIONS.some((token) => competition.includes(normalize(token)))) return true;
  if (BRAZILIAN_MARKERS.some((token) => country.includes(token) || competition.includes(token))) return true;
  if (home === "brazil" || home === "brasil" || away === "brazil" || away === "brasil") return true;
  if (home.includes("selecao brasileira") || away.includes("selecao brasileira")) return true;
  if (BRAZILIAN_TEAMS.some((team) => home.includes(team) || away.includes(team))) return true;
  return false;
}