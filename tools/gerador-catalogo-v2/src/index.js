import { getConfig } from './config.js';
import { XtreamClient } from './xtreamClient.js';
import { TmdbClient } from './tmdbClient.js';
import { mapGenres } from './genreMapper.js';
import { mapProducer } from './producerMapper.js';
import { normalizeMovie, normalizeSeries, comparableTitle } from './normalizers.js';
import { matchMovie, matchSeries } from './matchers.js';
import { writeCatalog } from './catalogWriter.js';
import { loadCatalogState, saveCatalogState, fingerprint } from './incrementalState.js';
import { imageOrPlaceholder, safeLogError, timestampFrom, toInteger, toNumber, yearFromDate } from './utils.js';

function catalogVersion(now) {
  const pad = (value) => String(value).padStart(2, '0');
  return now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + '.' + pad(now.getHours()) + pad(now.getMinutes());
}

function categoryMap(categories) {
  const map = new Map();
  for (const category of categories || []) {
    const id = category.category_id ?? category.id;
    if (id !== null && id !== undefined) map.set(String(id), category.category_name || category.name || '');
  }
  return map;
}

const limitItems = (items, limit) => limit ? items.slice(0, limit) : items;
const castFromCredits = (credits) => (credits?.cast || []).slice(0, 12).map((person) => ({ name: person.name, character: person.character || '', profile: person.profile_path ? 'https://image.tmdb.org/t/p/w185' + person.profile_path : '' }));
const directorFromCredits = (credits) => (credits?.crew || []).find((person) => person.job === 'Director')?.name || '';

function seasonsFromXtreamInfo(info) {
  return Object.entries(info?.episodes || {}).map(([seasonNumber, episodes]) => ({
    number: toInteger(seasonNumber, 0),
    episodes: (Array.isArray(episodes) ? episodes : []).map((episode) => ({
      id: 'episode_' + (episode.id ?? episode.episode_id),
      episodeId: toInteger(episode.id ?? episode.episode_id, 0),
      season: toInteger(episode.season ?? seasonNumber, toInteger(seasonNumber, 0)),
      episode: toInteger(episode.episode_num ?? episode.episode ?? episode.episode_number, 0),
      title: episode.title || episode.name || ('Episodio ' + (episode.episode_num ?? episode.episode ?? '')),
      containerExtension: episode.container_extension || episode.containerExtension || 'mp4'
    })).filter((episode) => episode.episodeId)
  })).filter((season) => season.episodes.length > 0).sort((a, b) => a.number - b.number);
}

function episodeFingerprintList(info) {
  return seasonsFromXtreamInfo(info).flatMap((season) => season.episodes.map((episode) => ({
    episodeId: episode.episodeId,
    season: episode.season,
    episode: episode.episode,
    title: episode.title,
    containerExtension: episode.containerExtension
  }))).sort((a, b) => a.episodeId - b.episodeId);
}

function movieFingerprint(raw, normalized) {
  const streamId = toInteger(raw.stream_id ?? raw.streamId ?? raw.id, null);
  return fingerprint({
    streamId,
    name: raw.name || raw.title || '',
    cleanTitle: normalized.title,
    year: normalized.year,
    containerExtension: raw.container_extension || raw.containerExtension || 'mp4',
    categoryId: raw.category_id ?? null,
    added: raw.added ?? null
  });
}

function seriesRawFingerprint(raw, normalized) {
  const seriesId = toInteger(raw.series_id ?? raw.seriesId ?? raw.id, null);
  return fingerprint({
    seriesId,
    name: raw.name || raw.title || '',
    cleanTitle: normalized.title,
    year: normalized.year,
    categoryId: raw.category_id ?? null,
    lastModified: raw.last_modified ?? null
  });
}

function seriesFingerprint(raw, normalized, xtreamInfo) {
  const seriesId = toInteger(raw.series_id ?? raw.seriesId ?? raw.id, null);
  return fingerprint({
    seriesId,
    name: raw.name || raw.title || '',
    cleanTitle: normalized.title,
    year: normalized.year,
    categoryId: raw.category_id ?? null,
    lastModified: raw.last_modified ?? null,
    episodes: episodeFingerprintList(xtreamInfo)
  });
}

function hasReliableLastModified(raw) {
  return raw.last_modified !== null && raw.last_modified !== undefined && raw.last_modified !== '';
}

function dedupe(items) {
  const map = new Map();
  let duplicates = 0;
  for (const item of items) {
    const key = item.tmdbId ? 'tmdb:' + item.tmdbId : 'name:' + comparableTitle(item.title) + ':' + (item.year || '');
    if (map.has(key)) {
      duplicates += 1;
      const current = map.get(key);
      const score = (value) => (value.tmdbId ? 100000 : 0) + (value.rating || 0) * 1000 + (value.popularity || 0) + (value.addedAt || 0) / 100000000000;
      if (score(item) > score(current)) map.set(key, item);
    } else {
      map.set(key, item);
    }
  }
  return { items: [...map.values()], duplicates };
}

async function enrichMovie(raw, context, normalized = normalizeMovie(raw)) {
  const streamId = toInteger(raw.stream_id ?? raw.streamId ?? raw.id, null);
  if (!streamId) return null;
  const categoryName = context.movieCategories.get(String(raw.category_id)) || '';
  let tmdbMatch = null;
  let details = null;
  try {
    tmdbMatch = await matchMovie(context.tmdb, normalized);
    if (tmdbMatch?.id) details = await context.tmdb.movieDetails(tmdbMatch.id);
  } catch (error) {
    context.stats.movieErrors += 1;
    console.warn('[TMDB] filme com erro: ' + normalized.title + ' - ' + safeLogError(error, context.config));
  }
  if (tmdbMatch?.id) context.stats.moviesFound += 1;
  else context.stats.moviesMissing += 1;
  const genres = mapGenres('movie', [details?.genres || tmdbMatch?.genre_ids || [], categoryName, raw.name], { originalLanguage: details?.original_language || tmdbMatch?.original_language, originCountries: details?.origin_country || [] });
  const year = yearFromDate(details?.release_date || tmdbMatch?.release_date) || normalized.year;
  const poster = context.tmdb.image(details?.poster_path || tmdbMatch?.poster_path, 'w500') || raw.stream_icon || raw.cover || '';
  const backdrop = context.tmdb.image(details?.backdrop_path || tmdbMatch?.backdrop_path, 'w1280') || '';
  return {
    id: 'movie_' + streamId,
    type: 'movie',
    title: details?.title || tmdbMatch?.title || normalized.title || raw.name || 'Sem titulo',
    originalTitle: details?.original_title || tmdbMatch?.original_title || normalized.title || raw.name || '',
    year,
    poster: imageOrPlaceholder(poster, 'poster', context.config.publicBaseUrl),
    backdrop: imageOrPlaceholder(backdrop, 'backdrop', context.config.publicBaseUrl),
    overview: details?.overview || tmdbMatch?.overview || raw.plot || '',
    rating: toNumber(details?.vote_average ?? tmdbMatch?.vote_average ?? raw.rating, 0),
    runtime: toInteger(details?.runtime, null),
    genres,
    cast: castFromCredits(details?.credits),
    director: directorFromCredits(details?.credits),
    tmdbId: tmdbMatch?.id || null,
    popularity: toNumber(details?.popularity ?? tmdbMatch?.popularity, 0),
    voteCount: toInteger(details?.vote_count ?? tmdbMatch?.vote_count, 0),
    addedAt: timestampFrom(raw.added),
    xtream: { streamId, containerExtension: raw.container_extension || raw.containerExtension || 'mp4' }
  };
}

async function enrichSeries(raw, context, normalized = normalizeSeries(raw), xtreamInfo = null) {
  const seriesId = toInteger(raw.series_id ?? raw.seriesId ?? raw.id, null);
  if (!seriesId) return null;
  const categoryName = context.seriesCategories.get(String(raw.category_id)) || '';
  let tmdbMatch = null;
  let details = null;
  let info = xtreamInfo || {};
  try {
    tmdbMatch = await matchSeries(context.tmdb, normalized);
    if (tmdbMatch?.id) details = await context.tmdb.seriesDetails(tmdbMatch.id);
  } catch (error) {
    context.stats.seriesErrors += 1;
    console.warn('[TMDB] serie com erro: ' + normalized.title + ' - ' + safeLogError(error, context.config));
  }
  if (!xtreamInfo) {
    try {
      info = await context.xtream.getSeriesInfo(seriesId);
    } catch (error) {
      context.stats.seriesErrors += 1;
      console.warn('[Xtream] episodios com erro: ' + normalized.title + ' - ' + safeLogError(error, context.config));
    }
  }
  if (tmdbMatch?.id) context.stats.seriesFound += 1;
  else context.stats.seriesMissing += 1;
  const genres = mapGenres('series', [details?.genres || tmdbMatch?.genre_ids || [], categoryName, raw.name], { originalLanguage: details?.original_language || tmdbMatch?.original_language, originCountries: details?.origin_country || [] });
  const year = yearFromDate(details?.first_air_date || tmdbMatch?.first_air_date) || normalized.year;
  const poster = context.tmdb.image(details?.poster_path || tmdbMatch?.poster_path, 'w500') || raw.cover || raw.series_icon || '';
  const backdrop = context.tmdb.image(details?.backdrop_path || tmdbMatch?.backdrop_path, 'w1280') || '';
  return {
    id: 'series_' + seriesId,
    type: 'series',
    title: details?.name || tmdbMatch?.name || normalized.title || raw.name || 'Sem titulo',
    originalTitle: details?.original_name || tmdbMatch?.original_name || normalized.title || raw.name || '',
    year,
    poster: imageOrPlaceholder(poster, 'poster', context.config.publicBaseUrl),
    backdrop: imageOrPlaceholder(backdrop, 'backdrop', context.config.publicBaseUrl),
    overview: details?.overview || tmdbMatch?.overview || raw.plot || '',
    rating: toNumber(details?.vote_average ?? tmdbMatch?.vote_average ?? raw.rating, 0),
    genres,
    producer: mapProducer(categoryName),
    tmdbId: tmdbMatch?.id || null,
    popularity: toNumber(details?.popularity ?? tmdbMatch?.popularity, 0),
    voteCount: toInteger(details?.vote_count ?? tmdbMatch?.vote_count, 0),
    addedAt: timestampFrom(raw.last_modified || raw.added),
    xtream: { seriesId },
    seasons: seasonsFromXtreamInfo(info)
  };
}

function reusableEntry(entry, fp) {
  return entry?.fingerprint === fp && entry.item && typeof entry.item === 'object';
}

async function loadRequiredXtreamLists(xtream) {
  const [moviesResult, seriesResult] = await Promise.allSettled([
    xtream.getMoviesRequired(),
    xtream.getSeriesRequired()
  ]);
  const failures = [];
  if (moviesResult.status === 'rejected') failures.push('get_vod_streams');
  if (seriesResult.status === 'rejected') failures.push('get_series');
  if (failures.length > 0) {
    console.error('[ERRO FATAL] geração abortada para proteger o catálogo existente. Chamadas obrigatórias falharam: ' + failures.join(', '));
    throw new Error('Falha critica no Xtream: ' + failures.join(', '));
  }
  return { moviesRaw: moviesResult.value, seriesRaw: seriesResult.value };
}

async function getSeriesInfoForFingerprint(raw, context, normalized) {
  const seriesId = toInteger(raw.series_id ?? raw.seriesId ?? raw.id, null);
  if (!seriesId) return { info: {}, failed: false };
  try {
    return { info: await context.xtream.getSeriesInfo(seriesId), failed: false };
  } catch (error) {
    context.stats.seriesErrors += 1;
    context.stats.seriesWithoutEpisodesByXtream += 1;
    console.warn('[Xtream] episodios com erro: ' + normalized.title + ' - ' + safeLogError(error, context.config));
    return { info: {}, failed: true };
  }
}

async function main() {
  const started = Date.now();
  const now = new Date();
  const config = getConfig();
  const version = { schemaVersion: 1, catalogVersion: catalogVersion(now), generatedAt: now.toISOString() };
  const stats = { moviesFound: 0, seriesFound: 0, moviesMissing: 0, seriesMissing: 0, movieErrors: 0, seriesErrors: 0, seriesWithoutEpisodesByXtream: 0 };
  const incrementalStats = { moviesReused: 0, seriesReused: 0, moviesProcessed: 0, seriesProcessed: 0, moviesUpdated: 0, seriesUpdated: 0, moviesRemoved: 0, seriesRemoved: 0 };
  const tmdb = new TmdbClient(config);
  let xtream = null;
  const previousState = await loadCatalogState(config);
  const nextState = { generatedAt: now.toISOString(), movies: {}, series: {} };

  console.log('carregando Xtream');
  console.log('Xtream base: ' + config.masked.xtreamBaseUrl);
  console.log('Xtream usuario: ' + config.masked.xtreamUsername);
  console.log('Xtream senha: ' + config.masked.xtreamPassword);
  console.log('TMDB: ' + config.masked.tmdbApiKey);
  console.log('cache TMDB: ' + (config.tmdb.cacheEnabled ? 'ativo em ' + config.tmdb.cacheDir : 'desativado'));
  console.log('retry TMDB: ' + config.tmdb.retryAttempts + ' tentativa(s), delay ' + config.tmdb.retryDelayMs + 'ms');
  console.log('incremental: ' + (config.incremental.enabled ? 'ativo em ' + config.incremental.stateFile : 'desativado'));
  await tmdb.ensureCacheDir();

  let movies = [];
  let series = [];
  let shouldSaveState = false;
  if (!config.xtreamReady) {
    console.error('[ERRO FATAL] Configuracao Xtream ausente. Geracao abortada para proteger o catalogo existente.');
    throw new Error('Configuracao Xtream ausente');
  } else {
    shouldSaveState = true;
    xtream = new XtreamClient(config);
    if (!config.tmdbReady) console.warn('TMDB_API_KEY ausente. Itens serao gerados com fallback Xtream.');
    const [movieCategoriesRaw, seriesCategoriesRaw] = await Promise.all([xtream.getMovieCategories(), xtream.getSeriesCategories()]);
    const { moviesRaw, seriesRaw } = await loadRequiredXtreamLists(xtream);
    console.log('total de filmes Xtream: ' + moviesRaw.length);
    console.log('total de series Xtream: ' + seriesRaw.length);
    if (moviesRaw.length === 0 && seriesRaw.length === 0) {
      console.error('[ERRO FATAL] Xtream retornou 0 filmes e 0 séries. Geração abortada para proteger o catálogo existente.');
      throw new Error('Xtream retornou catalogo vazio');
    }
    const context = { config, xtream, tmdb, movieCategories: categoryMap(movieCategoriesRaw), seriesCategories: categoryMap(seriesCategoriesRaw), stats };

    for (const raw of limitItems(moviesRaw, config.limits.movies)) {
      try {
        const normalized = normalizeMovie(raw);
        const streamId = toInteger(raw.stream_id ?? raw.streamId ?? raw.id, null);
        if (!streamId) continue;
        const id = 'movie_' + streamId;
        const fp = movieFingerprint(raw, normalized);
        const previous = previousState.movies[id];
        if (config.incremental.enabled && reusableEntry(previous, fp)) {
          movies.push(previous.item);
          nextState.movies[id] = { ...previous, rawFingerprint: fp };
          incrementalStats.moviesReused += 1;
          continue;
        }
        const item = await enrichMovie(raw, context, normalized);
        if (item) {
          movies.push(item);
          nextState.movies[id] = { fingerprint: fp, rawFingerprint: fp, item };
          incrementalStats.moviesProcessed += 1;
          if (previous) incrementalStats.moviesUpdated += 1;
        }
      } catch (error) {
        stats.movieErrors += 1;
        console.warn('[Filme] erro no item: ' + safeLogError(error, config));
      }
    }

    for (const raw of limitItems(seriesRaw, config.limits.series)) {
      try {
        const normalized = normalizeSeries(raw);
        const seriesId = toInteger(raw.series_id ?? raw.seriesId ?? raw.id, null);
        if (!seriesId) continue;
        const id = 'series_' + seriesId;
        const rawFp = seriesRawFingerprint(raw, normalized);
        const previous = previousState.series[id];
        if (config.incremental.enabled && previous?.rawFingerprint === rawFp && hasReliableLastModified(raw) && previous.item) {
          series.push(previous.item);
          nextState.series[id] = { ...previous, rawFingerprint: rawFp };
          incrementalStats.seriesReused += 1;
          continue;
        }
        const xtreamInfoResult = await getSeriesInfoForFingerprint(raw, context, normalized);
        const xtreamInfo = xtreamInfoResult.info;
        const fp = seriesFingerprint(raw, normalized, xtreamInfo);
        if (config.incremental.enabled && reusableEntry(previous, fp)) {
          series.push(previous.item);
          nextState.series[id] = { ...previous, rawFingerprint: rawFp };
          incrementalStats.seriesReused += 1;
          continue;
        }
        const item = await enrichSeries(raw, context, normalized, xtreamInfo);
        if (item) {
          if (xtreamInfoResult.failed && previous?.item?.seasons?.length) item.seasons = previous.item.seasons;
          series.push(item);
          nextState.series[id] = { fingerprint: xtreamInfoResult.failed && previous?.fingerprint ? previous.fingerprint : fp, rawFingerprint: rawFp, item };
          incrementalStats.seriesProcessed += 1;
          if (previous) incrementalStats.seriesUpdated += 1;
        }
      } catch (error) {
        stats.seriesErrors += 1;
        console.warn('[Serie] erro no item: ' + safeLogError(error, config));
      }
    }

    const currentMovieIds = new Set(Object.keys(nextState.movies));
    const currentSeriesIds = new Set(Object.keys(nextState.series));
    incrementalStats.moviesRemoved = Object.keys(previousState.movies).filter((id) => !currentMovieIds.has(id)).length;
    incrementalStats.seriesRemoved = Object.keys(previousState.series).filter((id) => !currentSeriesIds.has(id)).length;
  }

  const movieDedupe = dedupe(movies);
  const seriesDedupe = dedupe(series);
  const result = await writeCatalog({ outputDir: config.outputDir, version, movies: movieDedupe.items, series: seriesDedupe.items });
  if (shouldSaveState) await saveCatalogState(config, nextState);

  console.log('total de filmes encontrados no TMDB: ' + stats.moviesFound);
  console.log('total de series encontradas no TMDB: ' + stats.seriesFound);
  console.log('total de filmes sem TMDB: ' + stats.moviesMissing);
  console.log('total de series sem TMDB: ' + stats.seriesMissing);
  const tmdbStats = tmdb.getStats();
  console.log('cache TMDB usado: ' + tmdbStats.cacheHits);
  console.log('chamadas TMDB reais: ' + tmdbStats.apiCalls);
  console.log('retries TMDB: ' + tmdbStats.retries);
  console.log('falhas TMDB apos retry: ' + tmdbStats.failuresAfterRetry);
  console.log('itens nao encontrados usando cache: ' + tmdbStats.notFoundCacheHits);
  const xtreamStats = xtream?.getStats() || { retries: 0, failuresAfterRetry: 0, successfulCalls: 0 };
  console.log('retries Xtream: ' + xtreamStats.retries);
  console.log('falhas Xtream apos retry: ' + xtreamStats.failuresAfterRetry);
  console.log('chamadas Xtream com sucesso: ' + xtreamStats.successfulCalls);
  console.log('series sem episodios por erro Xtream: ' + stats.seriesWithoutEpisodesByXtream);
  console.log('incremental: ' + (config.incremental.enabled ? 'ativo' : 'desativado'));
  console.log('filmes reutilizados: ' + incrementalStats.moviesReused);
  console.log('series reutilizadas: ' + incrementalStats.seriesReused);
  console.log('filmes novos/processados: ' + incrementalStats.moviesProcessed);
  console.log('series novas/processadas: ' + incrementalStats.seriesProcessed);
  console.log('filmes atualizados: ' + incrementalStats.moviesUpdated);
  console.log('series atualizadas: ' + incrementalStats.seriesUpdated);
  console.log('filmes removidos: ' + incrementalStats.moviesRemoved);
  console.log('series removidas: ' + incrementalStats.seriesRemoved);
  console.log('duplicados filmes: ' + movieDedupe.duplicates);
  console.log('duplicados series: ' + seriesDedupe.duplicates);
  if (result.movieSectionStats) {
    console.log('filmes em Populares: ' + result.movieSectionStats.populares);
    console.log('filmes em Lancamentos: ' + result.movieSectionStats.lancamentos);
    console.log('filmes em Tendencias: ' + result.movieSectionStats.tendencias);
    console.log('filmes removidos de Populares por repeticao com Lancamentos: ' + result.movieSectionStats.popularesRemovidosPorRepeticao);
    console.log('filmes removidos de Tendencias por repeticao: ' + result.movieSectionStats.tendenciasRemovidosPorRepeticao);
  }
  console.log('erros filmes: ' + stats.movieErrors);
  console.log('erros series: ' + stats.seriesErrors);
  console.log('generos gerados filmes: ' + result.movieGenres.join(', '));
  console.log('generos gerados series: ' + result.seriesGenres.join(', '));
  console.log('produtoras geradas: ' + result.producers.join(', '));
  console.log('arquivos escritos: ' + result.written);
  console.log('catalogo gerado em: ' + config.outputDir);
  console.log('tempo total: ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
}

main().catch((error) => {
  console.error('Falha no gerador: ' + (error?.stack || error?.message || String(error)));
  process.exitCode = 1;
});
