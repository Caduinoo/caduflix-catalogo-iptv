import { config } from "./config.js";
import { fetchGames } from "./footballApiClient.js";
import { writeGamesCatalog } from "./writer.js";
import { todayInTimezone } from "./utils.js";

const startedAt = Date.now();

async function main() {
  const date = todayInTimezone(config.timezone);
  console.log("[Jogos] gerando jogos do dia");
  console.log(`[Jogos] provider: ${config.provider}`);
  console.log(`[Jogos] data: ${date}`);
  console.log(`[Jogos] timezone: ${config.timezone}`);
  console.log(`[Jogos] output: ${config.outputDir}`);

  if (process.env.GITHUB_ACTIONS === "true" && !config.apiKey) {
    throw new Error("FOOTBALL_API_KEY nao configurada nos Secrets do GitHub.");
  }

  const games = await fetchGames(config, date);
  games.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const written = await writeGamesCatalog(config, date, games);
  console.log(`[Jogos] jogos relevantes: ${games.length}`);
  console.log(`[Jogos] escrito: ${written.gamesPath}`);
  console.log(`[Jogos] escrito: ${written.mapPath}`);
  console.log(`[Jogos] tempo total: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error(`[Jogos] erro fatal: ${error.message}`);
  console.error("[Jogos] geracao abortada antes de escrever para preservar os arquivos antigos.");
  process.exitCode = 1;
});