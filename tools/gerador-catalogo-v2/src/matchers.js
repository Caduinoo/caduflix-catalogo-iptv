import { comparableTitle } from './normalizers.js';
import { yearFromDate } from './utils.js';

function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const matrix = Array.from({ length: left.length + 1 }, () => []);
  for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[left.length][right.length];
}
export function titleSimilarity(a, b) {
  const left = comparableTitle(a);
  const right = comparableTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const ratio = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  return Math.max(ratio, intersection / union);
}
function best(results, title, year, tv) {
  let winner = null;
  for (const item of results) {
    const itemTitle = tv ? item.name || item.original_name : item.title || item.original_title;
    const itemYear = yearFromDate(tv ? item.first_air_date : item.release_date);
    let score = titleSimilarity(title, itemTitle) * 100 + Math.min(Number(item.popularity || 0), 80) / 20;
    if (year && itemYear === year) score += 18;
    if (year && itemYear && Math.abs(itemYear - year) === 1) score += 6;
    if (!winner || score > winner.score) winner = { item, score };
  }
  return winner && winner.score >= 48 ? winner.item : null;
}
export async function matchMovie(tmdbClient, normalized) {
  if (!tmdbClient.enabled || !normalized.title) return null;
  return best(normalized.year ? await tmdbClient.searchMovie(normalized.title, normalized.year) : [], normalized.title, normalized.year, false) || best(await tmdbClient.searchMovie(normalized.title, null), normalized.title, normalized.year, false);
}
export async function matchSeries(tmdbClient, normalized) {
  if (!tmdbClient.enabled || !normalized.title) return null;
  return best(normalized.year ? await tmdbClient.searchSeries(normalized.title, normalized.year) : [], normalized.title, normalized.year, true) || best(await tmdbClient.searchSeries(normalized.title, null), normalized.title, normalized.year, true);
}
