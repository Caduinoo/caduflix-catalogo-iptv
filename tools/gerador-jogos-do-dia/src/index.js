import { config, hasPixsuperConfig } from "./config.js";
import { PixsuperClient } from "./pixsuperClient.js";
import { buildGamesFromStreams, categoryDebugName, isGamesCategory, parsePixsuperStream } from "./pixsuperParser.js";
import { writeGamesCatalog } from "./writer.js";
import { localTimestamp, todayInTimezone } from "./utils.js";

const startedAt = Date.now();

async function main() {
  const date = todayInTimezone(config.timezone);
  console.log("[Jogos] gerando jogos do dia");
  console.log(`[Jogos] source: ${config.source}`);
  console.log(`[Jogos] data: ${date}`);
  console.log(`[Jogos] timezone: ${config.timezone}`);

  let games;
  if (config.source === "pixsuper" && hasPixsuperConfig()) {
    games = await loadPixsuperGames(date);
  } else if (config.useMockWhenNoKey) {
    console.warn("[Jogos] Pixsuper nao configurado. Usando mock para teste.");
    games = mockGames(date);
  } else {
    throw new Error("Pixsuper nao configurado e mock desativado.");
  }

  if (config.source === "pixsuper" && hasPixsuperConfig() && games.length === 0) {
    throw new Error("Pixsuper retornou 0 jogos. Geracao abortada para preservar JSON antigo.");
  }

  const written = await writeGamesCatalog(config, date, games);
  console.log(`[Jogos] jogos gerados: ${games.length}`);
  console.log(`[Jogos] escrito: ${written.gamesPath}`);
  console.log(`[Jogos] escrito: ${written.mapPath}`);
  console.log(`[Jogos] tempo total: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

async function loadPixsuperGames(date) {
  const client = new PixsuperClient(config);
  const categories = await client.getLiveCategories();
  const matched = categories.filter(isGamesCategory);
  if (matched.length === 0) {
    console.error("[Pixsuper] nenhuma categoria de jogos encontrada. Categorias disponiveis:");
    categories.slice(0, 80).forEach((category) => console.error(` - ${categoryDebugName(category)}`));
    throw new Error("Categoria Jogos do Dia nao encontrada no Pixsuper.");
  }
  console.log(`[Pixsuper] categorias de jogos: ${matched.map(categoryDebugName).join(", ")}`);
  const streams = [];
  for (const category of matched) {
    const categoryId = String(category.category_id ?? category.id ?? "");
    if (!categoryId) continue;
    const list = await client.getLiveStreams(categoryId);
    console.log(`[Pixsuper] streams categoria=${categoryDebugName(category)} total=${list.length}`);
    streams.push(...list);
  }
  const deduped = [...new Map(streams.map((stream) => [String(stream.stream_id ?? stream.id ?? stream.name), stream])).values()];
  return buildGamesFromStreams(deduped, date, config.timezone);
}

function mockGames(date) {
  const names = [
    "Brasil x Marrocos - 19h00 - SD (Globo)",
    "Brasil x Marrocos - 19h00 - HD (Globo)",
    "Brasil x Marrocos - 19h00 - FHD (Sportv)",
    "Palmeiras x Corinthians - 21h30 - FHD (Premiere)",
    "19h00 - Flamengo x Vasco - Globo"
  ];
  return buildGamesFromStreams(names.map((name, index) => ({ stream_id: `mock_${index}`, name })), date, config.timezone);
}

main().catch((error) => {
  console.error(`[Jogos] erro fatal: ${error.message}`);
  console.error("[Jogos] geracao abortada antes de commitar para preservar os arquivos antigos.");
  process.exitCode = 1;
});
