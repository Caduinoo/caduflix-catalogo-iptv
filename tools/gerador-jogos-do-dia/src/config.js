import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
loadDotEnv(path.join(projectRoot, ".env"));

export const config = {
  projectRoot,
  source: env("GAMES_SOURCE", "pixsuper").trim().toLowerCase(),
  pixsuperBaseUrl: env("PIXSUPER_BASE_URL", "").replace(/\/+$/, ""),
  pixsuperUsername: env("PIXSUPER_USERNAME", ""),
  pixsuperPassword: env("PIXSUPER_PASSWORD", ""),
  outputDir: path.resolve(projectRoot, env("GAMES_OUTPUT_DIR", "../..")),
  timezone: env("GAMES_TIMEZONE", "America/Sao_Paulo"),
  useMockWhenNoKey: env("GAMES_USE_MOCK_WHEN_NO_KEY", "true").toLowerCase() === "true"
};

export function hasPixsuperConfig() {
  return Boolean(config.pixsuperBaseUrl && config.pixsuperUsername && config.pixsuperPassword);
}

function env(name, fallback) {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^[\"']|[\"']$/g, "");
  }
}
