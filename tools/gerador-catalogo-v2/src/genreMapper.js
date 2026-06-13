import { normalizeText, unique } from './utils.js';

export const MOVIE_GENRES = ['acao', 'aventura', 'animacao', 'anime', 'comedia', 'crime', 'documentario', 'drama', 'familia', 'fantasia', 'ficcao', 'guerra', 'historia', 'infantil', 'misterio', 'musica', 'nacionais', 'romance', 'suspense', 'terror', 'thriller', 'faroeste'];
export const SERIES_GENRES = ['acao', 'aventura', 'animacao', 'anime', 'comedia', 'crime', 'documentario', 'drama', 'familia', 'fantasia', 'ficcao', 'guerra', 'historia', 'infantil', 'misterio', 'musica', 'nacional', 'reality', 'romance', 'suspense', 'terror', 'thriller', 'faroeste'];
const MOVIE_IDS = { 28: ['acao'], 12: ['aventura'], 16: ['animacao'], 35: ['comedia'], 80: ['crime'], 99: ['documentario'], 18: ['drama'], 10751: ['familia', 'infantil'], 14: ['fantasia'], 36: ['historia'], 27: ['terror'], 10402: ['musica'], 9648: ['misterio'], 10749: ['romance'], 878: ['ficcao'], 53: ['suspense', 'thriller'], 10752: ['guerra'], 37: ['faroeste'] };
const SERIES_IDS = { 10759: ['acao', 'aventura'], 16: ['animacao'], 35: ['comedia'], 80: ['crime'], 99: ['documentario'], 18: ['drama'], 10751: ['familia', 'infantil'], 10762: ['infantil'], 9648: ['misterio'], 10763: ['documentario'], 10764: ['reality'], 10765: ['fantasia', 'ficcao'], 10766: ['drama', 'romance'], 10767: ['comedia'], 10768: ['guerra'], 37: ['faroeste'] };
const ALIASES = [
  [/\bacao\b|\baction\b|acao e aventura|action adventure/, ['acao']],
  [/\baventura\b|\badventure\b|acao e aventura|action adventure/, ['aventura']],
  [/\banimacao\b|\banimation\b|\banimado\b/, ['animacao']],
  [/\banime\b|\banimes\b/, ['anime', 'animacao']],
  [/\bcomedia\b|\bcomedy\b|\bhumor\b/, ['comedia']],
  [/\bcrime\b|\bpolicial\b/, ['crime']],
  [/\bdocumentario\b|\bdocumentary\b|\bdocs?\b/, ['documentario']],
  [/\bdrama\b/, ['drama']],
  [/\bfamilia\b|\bfamily\b/, ['familia']],
  [/\bfantasia\b|\bfantasy\b/, ['fantasia']],
  [/science fiction|sci fi|sci-fi|ficcao cientifica|ficcao|\bscifi\b/, ['ficcao']],
  [/\bguerra\b|\bwar\b/, ['guerra']],
  [/\bhistoria\b|\bhistory\b|\bhistorico\b/, ['historia']],
  [/\bkids\b|\binfantil\b|\bchildren\b|\bcriancas\b/, ['infantil']],
  [/\bmisterio\b|\bmystery\b/, ['misterio']],
  [/\bmusica\b|\bmusic\b|\bmusical\b/, ['musica']],
  [/\bromance\b/, ['romance']],
  [/\bsuspense\b/, ['suspense']],
  [/\bhorror\b|\bterror\b/, ['terror']],
  [/\bthriller\b/, ['thriller']],
  [/\bwestern\b|\bfaroeste\b/, ['faroeste']],
  [/\breality\b/, ['reality']],
  [/\bnacional\b|\bnacionais\b|\bbrasil\b|\bbrasileiro\b|\bbrasileira\b/, ['NATIONAL']]
];
function mapName(name, type) {
  const text = normalizeText(name).replace(/[^a-z0-9+\s-]/g, ' ');
  const out = [];
  for (const [pattern, genres] of ALIASES) if (pattern.test(text)) out.push(...genres);
  return out.map((genre) => genre === 'NATIONAL' ? (type === 'movie' ? 'nacionais' : 'nacional') : genre);
}
export function mapGenres(type, sources = [], extra = {}) {
  const allowed = type === 'movie' ? MOVIE_GENRES : SERIES_GENRES;
  const ids = type === 'movie' ? MOVIE_IDS : SERIES_IDS;
  const out = [];
  for (const source of sources.flat().filter((value) => value !== null && value !== undefined)) {
    if (typeof source === 'number' || /^\d+$/.test(String(source))) out.push(...(ids[Number(source)] || []));
    else if (typeof source === 'object') {
      if (source.id) out.push(...(ids[Number(source.id)] || []));
      if (source.name) out.push(...mapName(source.name, type));
    } else out.push(...mapName(source, type));
  }
  if (extra.originalLanguage === 'pt' || (extra.originCountries || []).includes('BR')) out.push(type === 'movie' ? 'nacionais' : 'nacional');
  return unique(out).filter((genre) => allowed.includes(genre));
}
