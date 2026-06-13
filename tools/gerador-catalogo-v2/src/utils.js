import fs from 'node:fs/promises';
import path from 'node:path';

export const normalizeText = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const compactWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
export const unique = (values) => [...new Set(values.filter(Boolean))];
export const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const toInteger = (value, fallback = null) => {
  const parsed = toNumber(value, fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};
export function timestampFrom(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value > 9999999999 ? value : value * 1000;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return numeric > 9999999999 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}
export const yearFromDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};
export const chunkByFirstLetter = (items, start, end) => items.filter((item) => {
  const first = normalizeText(item.title).charAt(0);
  return first >= start && first <= end;
});
export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
export async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
export function maskValue(value) {
  const text = String(value ?? '');
  if (!text) return '(vazio)';
  if (text.length <= 4) return '*'.repeat(text.length);
  return text.slice(0, 2) + '***' + text.slice(-2);
}
export function stripCredentialsFromText(value, config) {
  let text = String(value ?? '');
  for (const secret of [config?.xtream?.username, config?.xtream?.password]) {
    if (secret) text = text.split(secret).join(maskValue(secret));
  }
  return text;
}
export const imageOrPlaceholder = (value, kind, publicBaseUrl) => value || String(publicBaseUrl || '').replace(/\/$/, '') + '/assets/' + (kind === 'backdrop' ? 'placeholder-backdrop.png' : 'placeholder-poster.png');
export const sortByTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
export const safeLogError = (error, config) => stripCredentialsFromText(error?.stack || error?.message || String(error), config);
