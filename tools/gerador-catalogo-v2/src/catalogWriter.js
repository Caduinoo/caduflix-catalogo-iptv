import fs from 'node:fs/promises';
import path from 'node:path';
import { MOVIE_GENRES, SERIES_GENRES } from './genreMapper.js';
import { PRODUCERS } from './producerMapper.js';
import { chunkByFirstLetter, sortByTitle, writeJson } from './utils.js';

const CONTROLLED_DIRS = ['canais', 'filmes', 'series', 'busca'];
const YEARS = [2026, 2025, 2024];
const compactMovie = (item) => ({ id: item.id, type: 'movie', title: item.title, year: item.year, poster: item.poster, backdrop: item.backdrop, rating: item.rating, genres: item.genres, xtream: item.xtream });
const detailMovie = (item) => ({ id: item.id, type: 'movie', title: item.title, originalTitle: item.originalTitle, year: item.year, poster: item.poster, backdrop: item.backdrop, overview: item.overview, rating: item.rating, runtime: item.runtime, genres: item.genres, cast: item.cast || [], director: item.director || '', tmdbId: item.tmdbId, xtream: item.xtream });
const compactSeries = (item) => ({ id: item.id, type: 'series', title: item.title, year: item.year, poster: item.poster, backdrop: item.backdrop, rating: item.rating, producer: item.producer, genres: item.genres, xtream: item.xtream });
const detailSeries = (item) => ({ id: item.id, type: 'series', title: item.title, originalTitle: item.originalTitle, year: item.year, poster: item.poster, backdrop: item.backdrop, overview: item.overview, rating: item.rating, genres: item.genres, producer: item.producer, tmdbId: item.tmdbId, xtream: item.xtream, seasons: item.seasons || [] });
const SECTION_MIN_SIZE = 100;
const SECTION_AVOID_LIMIT = 60;
const currentYear = () => new Date().getFullYear();
const itemId = (item) => item?.id || item?.compact?.id || '';
const hasUsefulPoster = (item) => Boolean(item.poster && !String(item.poster).includes('placeholder-poster'));
const compactList = (items) => items.map((item) => item.compact);
const byPopularityItems = (items) => [...items].sort((a, b) => Number(hasUsefulPoster(b)) - Number(hasUsefulPoster(a)) || (b.popularity || 0) - (a.popularity || 0) || (b.voteCount || 0) - (a.voteCount || 0) || (b.rating || 0) - (a.rating || 0));
const trendScore = (item) => {
  const yearBonus = item.year ? Math.max(0, 6 - Math.max(0, currentYear() - item.year)) * 18 : 0;
  return (item.popularity || 0) + yearBonus + (item.rating || 0) * 5 + Math.min(item.voteCount || 0, 1500) / 120;
};
const byTrendingItems = (items) => [...items].sort((a, b) => trendScore(b) - trendScore(a) || (b.popularity || 0) - (a.popularity || 0));
const byLaunchItems = (items) => [...items]
  .filter((item) => YEARS.includes(item.year))
  .sort((a, b) => (b.year || 0) - (a.year || 0) || (b.popularity || 0) - (a.popularity || 0) || (b.rating || 0) - (a.rating || 0) || (b.voteCount || 0) - (a.voteCount || 0));
const byRecentItems = (items) => [...items].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
const byTopRatedItems = (items) => {
  const sorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.voteCount || 0) - (a.voteCount || 0) || (b.popularity || 0) - (a.popularity || 0));
  const reliable = sorted.filter((item) => (item.voteCount || 0) >= 100);
  if (reliable.length >= SECTION_MIN_SIZE) return reliable;
  const reliableIds = new Set(reliable.map(itemId));
  return [...reliable, ...sorted.filter((item) => !reliableIds.has(itemId(item)))];
};
const seriesTrendScore = (item) => (item.popularity || 0) + (item.year ? Math.max(0, 8 - Math.abs(new Date().getFullYear() - item.year)) * 12 : 0) + (item.rating || 0) * 4 + Math.min(item.voteCount || 0, 1000) / 100;
const byPopularity = (items) => [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).map((item) => item.compact);
const byTrending = (items) => [...items].sort((a, b) => seriesTrendScore(b) - seriesTrendScore(a)).map((item) => item.compact);
const byLaunch = (items) => [...items].filter((item) => item.year && item.year >= 2025).sort((a, b) => (b.year || 0) - (a.year || 0) || (b.popularity || 0) - (a.popularity || 0)).map((item) => item.compact);
const byRecent = (items) => [...items].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).map((item) => item.compact);
const byTopRated = (items) => [...items].filter((item) => (item.voteCount || 0) >= 20 || item.tmdbId === null).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.voteCount || 0) - (a.voteCount || 0)).map((item) => item.compact);
function reduceRepeats(items, sectionsToAvoid, limitToAvoid = SECTION_AVOID_LIMIT, minSize = SECTION_MIN_SIZE) {
  const avoid = new Set(sectionsToAvoid.flatMap((section) => section.slice(0, limitToAvoid).map(itemId)));
  const kept = [];
  const fallback = [];
  for (const item of items) {
    if (avoid.has(itemId(item))) fallback.push(item);
    else kept.push(item);
  }
  let removed = fallback.length;
  if (kept.length < minSize) {
    const restored = fallback.slice(0, minSize - kept.length);
    kept.push(...restored);
    removed -= restored.length;
  }
  return { items: kept, removed };
}
function buildMovieSections(movieItems) {
  const lancamentosItems = byLaunchItems(movieItems);
  const popularesBase = byPopularityItems(movieItems);
  const popularesReduced = reduceRepeats(popularesBase, [lancamentosItems], SECTION_AVOID_LIMIT);
  const tendenciasBase = byTrendingItems(movieItems);
  const tendenciasReduced = reduceRepeats(tendenciasBase, [lancamentosItems, popularesReduced.items], 40);
  const recentesItems = byRecentItems(movieItems);
  const topAvaliadosItems = byTopRatedItems(movieItems);
  return {
    populares: compactList(popularesReduced.items),
    tendencias: compactList(tendenciasReduced.items),
    lancamentos: compactList(lancamentosItems),
    recentes: compactList(recentesItems),
    topAvaliados: compactList(topAvaliadosItems),
    stats: {
      populares: popularesReduced.items.length,
      tendencias: tendenciasReduced.items.length,
      lancamentos: lancamentosItems.length,
      recentes: recentesItems.length,
      topAvaliados: topAvaliadosItems.length,
      popularesRemovidosPorRepeticao: popularesReduced.removed,
      tendenciasRemovidosPorRepeticao: tendenciasReduced.removed
    }
  };
}
function manifest() {
  return {
    schemaVersion: 1,
    paths: {
      version: 'version.json',
      home: 'home.json',
      canais: { jogosDoDia: 'canais/jogos-do-dia.json', jogosCanaisMap: 'canais/jogos-canais-map.json' },
      filmes: { index: 'filmes/index.json', populares: 'filmes/populares.json', tendencias: 'filmes/tendencias.json', lancamentos: 'filmes/lancamentos.json', recentes: 'filmes/recentes.json', topAvaliados: 'filmes/top-avaliados.json', porAno: YEARS.map((year) => 'filmes/por-ano/' + year + '.json'), generos: MOVIE_GENRES.map((genre) => 'filmes/generos/' + genre + '.json') },
      series: { index: 'series/index.json', populares: 'series/populares.json', tendencias: 'series/tendencias.json', lancamentos: 'series/lancamentos.json', recentes: 'series/recentes.json', topAvaliadas: 'series/top-avaliadas.json', porAno: YEARS.map((year) => 'series/por-ano/' + year + '.json'), produtoras: PRODUCERS.map((producer) => 'series/produtoras/' + producer + '.json'), generos: SERIES_GENRES.map((genre) => 'series/generos/' + genre + '.json') },
      busca: { filmesAM: 'busca/filmes-a-m.json', filmesNZ: 'busca/filmes-n-z.json', seriesAM: 'busca/series-a-m.json', seriesNZ: 'busca/series-n-z.json' }
    }
  };
}
const home = () => ({ sections: [
  { id: 'jogos_do_dia', title: 'Jogos do Dia', type: 'channel', path: 'canais/jogos-do-dia.json' },
  { id: 'filmes_populares', title: 'Filmes Populares', type: 'movie', path: 'filmes/populares.json' },
  { id: 'filmes_tendencias', title: 'Filmes em Tendencia', type: 'movie', path: 'filmes/tendencias.json' },
  { id: 'filmes_lancamentos', title: 'Lancamentos', type: 'movie', path: 'filmes/lancamentos.json' },
  { id: 'series_populares', title: 'Series Populares', type: 'series', path: 'series/populares.json' },
  { id: 'series_tendencias', title: 'Series em Tendencia', type: 'series', path: 'series/tendencias.json' },
  { id: 'series_lancamentos', title: 'Series Recentes', type: 'series', path: 'series/lancamentos.json' },
  { id: 'filmes_acao', title: 'Filmes de Acao', type: 'movie', path: 'filmes/generos/acao.json' },
  { id: 'filmes_comedia', title: 'Comedia', type: 'movie', path: 'filmes/generos/comedia.json' },
  { id: 'series_netflix', title: 'Netflix', type: 'series', path: 'series/produtoras/netflix.json' },
  { id: 'series_prime_video', title: 'Prime Video', type: 'series', path: 'series/produtoras/prime_video.json' },
  { id: 'series_hbo_max', title: 'HBO Max', type: 'series', path: 'series/produtoras/hbo_max.json' }
] });
async function clean(outputDir) {
  const normalized = path.resolve(outputDir).toLowerCase();
  if (path.basename(normalized) === 'caduflix-catalogo') throw new Error('Recusando limpar a pasta antiga caduflix-catalogo.');
  await fs.mkdir(outputDir, { recursive: true });
  for (const dir of CONTROLLED_DIRS) await fs.rm(path.join(outputDir, dir), { recursive: true, force: true });
}
export async function writeCatalog({ outputDir, version, movies, series }) {
  let written = 0;
  await clean(outputDir);
  await fs.mkdir(path.join(outputDir, 'filmes/detalhes'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'series/detalhes'), { recursive: true });
  const movieItems = movies.map((item) => ({ ...item, compact: compactMovie(item) }));
  const seriesItems = series.map((item) => ({ ...item, compact: compactSeries(item) }));
  const write = async (relative, data) => { await writeJson(path.join(outputDir, relative), data); written += 1; };
  await write('version.json', version);
  await write('manifest.json', manifest());
  await write('home.json', home());
  await write('canais/jogos-do-dia.json', { generatedAt: version.generatedAt, date: version.generatedAt.slice(0, 10), items: [] });
  await write('canais/jogos-canais-map.json', { Premiere: ['premiere', 'premiere clubes'], Sportv: ['sportv', 'sportv hd'], ESPN: ['espn', 'espn brasil'], TNT: ['tnt sports'], Globo: ['globo'], 'CazéTV': ['caze', 'cazetv'] });
  const movieSections = buildMovieSections(movieItems);
  await write('filmes/index.json', movieItems.map((item) => item.compact).sort(sortByTitle));
  await write('filmes/populares.json', movieSections.populares);
  await write('filmes/tendencias.json', movieSections.tendencias);
  await write('filmes/lancamentos.json', movieSections.lancamentos);
  await write('filmes/recentes.json', movieSections.recentes);
  await write('filmes/top-avaliados.json', movieSections.topAvaliados);
  for (const year of YEARS) await write('filmes/por-ano/' + year + '.json', movieItems.filter((item) => item.year === year).map((item) => item.compact));
  for (const genre of MOVIE_GENRES) await write('filmes/generos/' + genre + '.json', movieItems.filter((item) => item.genres.includes(genre)).map((item) => item.compact));
  for (const item of movieItems) await write('filmes/detalhes/' + item.id + '.json', detailMovie(item));
  await write('series/index.json', seriesItems.map((item) => item.compact).sort(sortByTitle));
  await write('series/populares.json', byPopularity(seriesItems));
  await write('series/tendencias.json', byTrending(seriesItems));
  await write('series/lancamentos.json', byLaunch(seriesItems));
  await write('series/recentes.json', byRecent(seriesItems));
  await write('series/top-avaliadas.json', byTopRated(seriesItems));
  for (const year of YEARS) await write('series/por-ano/' + year + '.json', seriesItems.filter((item) => item.year === year).map((item) => item.compact));
  for (const producer of PRODUCERS) await write('series/produtoras/' + producer + '.json', seriesItems.filter((item) => item.producer === producer).map((item) => item.compact));
  for (const genre of SERIES_GENRES) await write('series/generos/' + genre + '.json', seriesItems.filter((item) => item.genres.includes(genre)).map((item) => item.compact));
  for (const item of seriesItems) await write('series/detalhes/' + item.id + '.json', detailSeries(item));
  const movieSearch = movieItems.map((item) => item.compact).sort(sortByTitle);
  const seriesSearch = seriesItems.map((item) => item.compact).sort(sortByTitle);
  await write('busca/filmes-a-m.json', chunkByFirstLetter(movieSearch, 'a', 'm'));
  await write('busca/filmes-n-z.json', chunkByFirstLetter(movieSearch, 'n', 'z'));
  await write('busca/series-a-m.json', chunkByFirstLetter(seriesSearch, 'a', 'm'));
  await write('busca/series-n-z.json', chunkByFirstLetter(seriesSearch, 'n', 'z'));
  return { written, movieGenres: MOVIE_GENRES, seriesGenres: SERIES_GENRES, producers: PRODUCERS, movieSectionStats: movieSections.stats };
}
