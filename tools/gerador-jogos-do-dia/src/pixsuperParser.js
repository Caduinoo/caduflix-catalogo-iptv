import { broadcastForChannel, normalizeBroadcastName } from "./broadcastMapper.js";
import { localTimestamp, normalize, sanitizeText, slug, unique } from "./utils.js";

const CATEGORY_TOKENS = ["jogos do dia", "jogos", "futebol", "futebol ao vivo", "eventos", "eventos esportivos", "sports", "ao vivo"];
const QUALITY_RE = /\b(4K|UHD|FHD|HD|SD)\b/i;
const TIME_RE = /\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)\b/i;
const TEAM_RE = /(.+?)\s+(?:x|vs)\s+(.+)/i;

export function isGamesCategory(category) {
  const name = normalize(category.category_name ?? category.name ?? "");
  return CATEGORY_TOKENS.some((token) => name.includes(normalize(token)));
}

export function categoryDebugName(category) {
  return sanitizeText(category.category_name ?? category.name ?? category.category_id ?? "");
}

export function buildGamesFromStreams(streams, date, timezone) {
  const parsed = streams.map((stream) => parsePixsuperStream(stream.name ?? stream.title ?? stream.stream_name ?? "", date, timezone)).filter(Boolean);
  const groups = new Map();
  for (const item of parsed) {
    const key = `${normalize(item.title)}|${item.time}`;
    if (!groups.has(key)) groups.set(key, { ...item, indicatedChannels: [], availableQualities: [], rawNames: [] });
    const group = groups.get(key);
    group.indicatedChannels.push(...item.indicatedChannels);
    group.availableQualities.push(...item.availableQualities);
    group.rawNames.push(item.rawName);
  }
  return [...groups.values()].map((item) => finalizeGame(item, date, timezone)).sort((a, b) => a.time.localeCompare(b.time));
}

export function parsePixsuperStream(rawName, date, timezone) {
  const raw = sanitizeText(rawName);
  if (!raw) return null;
  const timeMatch = raw.match(TIME_RE);
  if (!timeMatch) return null;
  const time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const quality = raw.match(QUALITY_RE)?.[1]?.toUpperCase();
  const parenChannel = raw.match(/\(([^)]+)\)\s*$/)?.[1];
  const blocks = raw.split(/\s[-|]\s|\|/).map(sanitizeText).filter(Boolean);
  const fallbackChannel = blocks.slice().reverse().find((block) => !TIME_RE.test(block) && !QUALITY_RE.test(block) && !TEAM_RE.test(block) && !/^futebol|jogos|ao vivo$/i.test(block));
  const channel = sanitizeText(parenChannel || fallbackChannel || "");
  let title = raw
    .replace(/\([^)]*\)\s*$/g, " ")
    .replace(TIME_RE, " ")
    .replace(QUALITY_RE, " ")
    .replace(/\b(Futebol|Jogos|Ao Vivo)\b/gi, " ")
    .replace(/\s[-|]\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const teamCandidate = blocks.find((block) => TEAM_RE.test(block)) || title;
  const teamMatch = teamCandidate.match(TEAM_RE);
  if (!teamMatch) return null;
  const homeTeam = cleanTeam(teamMatch[1]);
  const awayTeam = cleanTeam(teamMatch[2]);
  if (!homeTeam || !awayTeam) return null;
  title = `${homeTeam} x ${awayTeam}`;
  return {
    title,
    homeTeam,
    awayTeam,
    time,
    timestamp: localTimestamp(date, time, timezone),
    competition: "",
    status: "scheduled",
    indicatedChannels: channel ? [normalizeBroadcastName(channel)] : [],
    availableQualities: quality ? [quality] : [],
    rawName: raw
  };
}

function finalizeGame(item, date, timezone) {
  const indicatedChannels = unique(item.indicatedChannels.map(sanitizeText));
  const availableQualities = sortQualities(unique(item.availableQualities));
  const broadcasts = indicatedChannels.map(broadcastForChannel);
  return {
    id: `game_${slug(item.title)}_${item.time.replace(":", "")}`,
    time: item.time,
    timestamp: localTimestamp(date, item.time, timezone),
    competition: item.competition || "",
    homeTeam: item.homeTeam,
    awayTeam: item.awayTeam,
    title: item.title,
    status: item.status,
    indicatedChannels,
    availableQualities,
    broadcasts,
    searchKeywords: unique([item.homeTeam, item.awayTeam, item.title, ...indicatedChannels]),
    sourceMeta: {
      provider: "pixsuper",
      rawNames: unique(item.rawNames)
    }
  };
}

function cleanTeam(value) {
  return sanitizeText(value).replace(/\b(4K|UHD|FHD|HD|SD)\b/gi, "").replace(/\s+/g, " ").trim();
}

function sortQualities(values) {
  const order = ["SD", "HD", "FHD", "4K", "UHD"];
  return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
