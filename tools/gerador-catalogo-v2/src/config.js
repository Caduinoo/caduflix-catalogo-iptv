import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskValue } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const parseLimit = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return !['0', 'false', 'no', 'nao', 'não', 'off'].includes(String(value).trim().toLowerCase());
};

function validateOutputDir(outputDir) {
  const normalized = path.resolve(outputDir).toLowerCase();
  if (path.basename(normalized) === 'caduflix-catalogo') throw new Error('CATALOG_OUTPUT_DIR aponta para a pasta antiga caduflix-catalogo. Use caduflix-catalogo-iptv.');
}

function resolveEnvFile() {
  const argIndex = process.argv.findIndex((arg) => arg === '--env' || arg === '--env-file');
  const argValue = argIndex >= 0 ? process.argv[argIndex + 1] : '';
  const value = process.env.ENV_FILE || argValue;
  return value ? path.resolve(projectRoot, value) : path.join(projectRoot, '.env');
}

function safeNamespace(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getConfig() {
  loadDotEnv(resolveEnvFile());
  const cacheNamespace = safeNamespace(process.env.CATALOG_CACHE_NAMESPACE);
  const cacheRoot = cacheNamespace ? path.join(projectRoot, '.cache', cacheNamespace) : path.join(projectRoot, '.cache');
  const outputDir = path.resolve(projectRoot, process.env.CATALOG_OUTPUT_DIR || '../caduflix-catalogo-iptv');
  validateOutputDir(outputDir);
  const xtream = {
    baseUrl: String(process.env.XTREAM_BASE_URL || '').replace(/\/$/, ''),
    username: process.env.XTREAM_USERNAME || '',
    password: process.env.XTREAM_PASSWORD || '',
    retryAttempts: parsePositiveInteger(process.env.XTREAM_RETRY_ATTEMPTS, 3),
    retryDelayMs: parsePositiveInteger(process.env.XTREAM_RETRY_DELAY_MS, 1500),
    requestTimeoutMs: parsePositiveInteger(process.env.XTREAM_REQUEST_TIMEOUT_MS, 30000),
    seriesInfoDelayMs: parsePositiveInteger(process.env.XTREAM_SERIES_INFO_DELAY_MS, 1500),
    seriesInfoConcurrency: parsePositiveInteger(process.env.XTREAM_SERIES_INFO_CONCURRENCY, 1)
  };
  const incremental = {
    enabled: parseBoolean(process.env.CATALOG_INCREMENTAL_ENABLED, true),
    stateFile: path.join(cacheRoot, 'catalog-state.json')
  };
  const tmdb = {
    apiKey: process.env.TMDB_API_KEY || '',
    language: process.env.TMDB_LANGUAGE || 'pt-BR',
    region: process.env.TMDB_REGION || 'BR',
    cacheEnabled: parseBoolean(process.env.TMDB_CACHE_ENABLED, true),
    cacheDir: path.join(cacheRoot, 'tmdb'),
    retryAttempts: parsePositiveInteger(process.env.TMDB_RETRY_ATTEMPTS, 3),
    retryDelayMs: parsePositiveInteger(process.env.TMDB_RETRY_DELAY_MS, 1000),
    timeoutMs: 30000
  };
  const hasAnyXtream = Boolean(xtream.baseUrl || xtream.username || xtream.password);
  const xtreamReady = Boolean(xtream.baseUrl && xtream.username && xtream.password);
  if (hasAnyXtream && !xtreamReady) {
    const missing = [];
    if (!xtream.baseUrl) missing.push('XTREAM_BASE_URL');
    if (!xtream.username) missing.push('XTREAM_USERNAME');
    if (!xtream.password) missing.push('XTREAM_PASSWORD');
    throw new Error('Configuracao Xtream incompleta: ' + missing.join(', '));
  }
  return {
    projectRoot,
    outputDir,
    cacheRoot,
    publicBaseUrl: process.env.CATALOG_PUBLIC_BASE_URL || 'https://caduinoo.github.io/caduflix-catalogo-iptv',
    xtream,
    tmdb,
    incremental,
    limits: { movies: parseLimit(process.env.CATALOG_LIMIT_MOVIES), series: parseLimit(process.env.CATALOG_LIMIT_SERIES) },
    xtreamReady,
    tmdbReady: Boolean(tmdb.apiKey),
    masked: { xtreamBaseUrl: xtream.baseUrl || '(vazio)', xtreamUsername: maskValue(xtream.username), xtreamPassword: maskValue(xtream.password), tmdbApiKey: maskValue(tmdb.apiKey) }
  };
}
