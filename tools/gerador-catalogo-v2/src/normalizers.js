import { compactWhitespace, normalizeText, yearFromDate } from './utils.js';

const QUALITY_PATTERN = /\b(FHD|FULL\s*HD|HD|SD|4K|UHD|HDR|HDR10|HEVC|H265|H\.265|H264|H\.264|WEB[-\s]?DL|WEBRIP|BLURAY|BRRIP|DVDRIP|CAM|TS)\b/gi;
const TAG_PATTERN = /\b(L|LEG|DUB|DUAL|DUBLADO|LEGENDADO)\b/gi;
const PREFIX_PATTERN = /^(FILMES?|MOVIES?|SERIES?|SERIADOS?|CANAIS?|VOD|TV)\s*[:\-|]+\s*/i;
const SEASON_PATTERN = /\bS\d{1,2}(E\d{1,3})?\b|\b\d{1,2}x\d{1,3}\b|\bTEMP(?:ORADA)?\s*\d+\b/gi;

export function extractYear(...values) {
  for (const value of values) {
    if (!value) continue;
    const dateYear = yearFromDate(value);
    if (dateYear) return dateYear;
    const match = String(value).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
    if (match) return Number(match[1]);
  }
  return null;
}
function cleanSegment(segment, options = {}) {
  let text = String(segment ?? '');
  text = text.replace(PREFIX_PATTERN, ' ');
  text = text.replace(/[\[(]\s*(L|LEG|DUB|DUAL|DUBLADO|LEGENDADO)\s*[\])]/gi, ' ');
  text = text.replace(QUALITY_PATTERN, ' ').replace(TAG_PATTERN, ' ');
  if (options.removeSeason) text = text.replace(SEASON_PATTERN, ' ');
  text = text.replace(/[\[(]\s*(19|20)\d{2}\s*[\])]/g, ' ').replace(/\b(19|20)\d{2}\b\s*$/g, ' ');
  text = text.replace(/[._]+/g, ' ').replace(/[|/\\]+/g, ' ').replace(/\s*[-:]+\s*$/g, ' ');
  return compactWhitespace(text);
}
export function cleanXtreamName(name, options = {}) {
  const segments = String(name ?? '').split('|').map((part) => cleanSegment(part, options)).filter(Boolean);
  return segments.length > 1 ? segments[segments.length - 1] : cleanSegment(name, options);
}
export function comparableTitle(value) {
  return normalizeText(cleanXtreamName(value, { removeSeason: true })).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export const normalizeMovie = (item) => ({ rawTitle: item?.name || item?.title || '', title: cleanXtreamName(item?.name || item?.title, { removeSeason: false }), comparableTitle: comparableTitle(item?.name || item?.title), year: extractYear(item?.year, item?.releaseDate, item?.release_date, item?.name, item?.title) });
export const normalizeSeries = (item) => ({ rawTitle: item?.name || item?.title || '', title: cleanXtreamName(item?.name || item?.title, { removeSeason: true }), comparableTitle: comparableTitle(item?.name || item?.title), year: extractYear(item?.year, item?.releaseDate, item?.release_date, item?.first_air_date, item?.name, item?.title) });
