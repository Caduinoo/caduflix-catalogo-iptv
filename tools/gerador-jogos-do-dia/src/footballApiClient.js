import { broadcastsForCompetition, searchKeywordsForGame } from "./broadcastMapper.js";
import { isRelevantGame } from "./gameFilter.js";
import { gameTime, localDateParts, slug, toLocalIso } from "./utils.js";

export async function fetchGames(config, date) {
  if (!config.apiKey) {
    if (config.useMockWhenNoKey) {
      console.warn("[Jogos] FOOTBALL_API_KEY vazio. Usando jogos mock para teste.");
      return mockGames(config, date);
    }
    console.warn("[Jogos] FOOTBALL_API_KEY vazio. Gerando lista vazia.");
    return [];
  }
  if (config.provider !== "api-football") {
    throw new Error(`Provider nao suportado nesta etapa: ${config.provider}`);
  }
  const fixtures = await fetchApiFootballFixtures(config, date);
  return fixtures
    .filter(isRelevantGame)
    .map((game) => normalizeGame(game, config))
    .filter((game) => game.homeTeam && game.awayTeam);
}

async function fetchApiFootballFixtures(config, date) {
  const url = new URL(`${config.baseUrl}/fixtures`);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", config.timezone);

  const json = await requestJson(url, {
    "x-apisports-key": config.apiKey
  });
  const response = Array.isArray(json.response) ? json.response : [];
  return response.map((item) => ({
    kickoff: new Date(item.fixture?.date ?? `${date}T00:00:00Z`),
    competition: item.league?.name ?? "",
    country: item.league?.country ?? "",
    homeTeam: item.teams?.home?.name ?? "",
    awayTeam: item.teams?.away?.name ?? "",
    status: mapApiFootballStatus(item.fixture?.status?.short),
    round: item.league?.round ?? ""
  }));
}

function normalizeGame(game, config) {
  const local = localDateParts(game.kickoff, config.timezone);
  const localDate = `${local.year}-${local.month}-${local.day}`;
  const time = gameTime(game.kickoff, config.timezone);
  const broadcasts = broadcastsForCompetition(game.competition);
  return {
    id: `game_${localDate}_${time.replace(":", "")}_${slug(game.homeTeam)}_${slug(game.awayTeam)}`,
    time,
    timestamp: toLocalIso(game.kickoff, config.timezone),
    competition: game.competition,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    status: game.status,
    round: game.round,
    broadcasts,
    searchKeywords: searchKeywordsForGame(game, broadcasts)
  };
}

function mockGames(config, date) {
  const base = [
    { time: "16:00", competition: "Brasileirao Serie A", homeTeam: "Flamengo", awayTeam: "Palmeiras", round: "Rodada 12" },
    { time: "19:30", competition: "Copa do Brasil", homeTeam: "Corinthians", awayTeam: "Sao Paulo", round: "" },
    { time: "21:00", competition: "Champions League", homeTeam: "Real Madrid", awayTeam: "Manchester City", round: "" }
  ];
  return base.map((item) => {
    const kickoff = new Date(`${date}T${item.time}:00-03:00`);
    return normalizeGame({ ...item, kickoff, status: "scheduled", country: "Brazil" }, config);
  });
}

async function requestJson(url, headers) {
  console.log(`[Jogos] GET ${url.pathname}${url.search}`);
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Football API HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return text.trim() ? JSON.parse(text) : {};
}

function mapApiFootballStatus(status) {
  const value = String(status ?? "").toUpperCase();
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(value)) return "live";
  if (["FT", "AET", "PEN"].includes(value)) return "finished";
  if (["PST", "CANC", "ABD", "SUSP"].includes(value)) return "postponed";
  return "scheduled";
}