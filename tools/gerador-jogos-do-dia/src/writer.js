import fs from "node:fs/promises";
import path from "node:path";
import { CHANNEL_KEYWORDS } from "./broadcastMapper.js";
import { toLocalIso } from "./utils.js";

export async function writeGamesCatalog(config, date, items) {
  const canaisDir = path.join(config.outputDir, "canais");
  await fs.mkdir(canaisDir, { recursive: true });
  const payload = {
    generatedAt: toLocalIso(new Date(), config.timezone),
    date,
    timezone: config.timezone,
    source: config.provider,
    items
  };
  await writeJson(path.join(canaisDir, "jogos-do-dia.json"), payload);
  await writeJson(path.join(canaisDir, "jogos-canais-map.json"), CHANNEL_KEYWORDS);
  return {
    gamesPath: path.join(canaisDir, "jogos-do-dia.json"),
    mapPath: path.join(canaisDir, "jogos-canais-map.json")
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}