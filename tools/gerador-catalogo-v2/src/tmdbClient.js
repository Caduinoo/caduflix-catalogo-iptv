import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const RETRY_STATUS = new Set([500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'sem_query';
}

function hashObject(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 10);
}

export class TmdbClient {
  constructor(config) {
    this.config = config;
    this.memory = new Map();
    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      retries: 0,
      failuresAfterRetry: 0,
      notFoundCacheHits: 0
    };
  }

  get enabled() {
    return Boolean(this.config.tmdb.apiKey);
  }

  getStats() {
    return { ...this.stats };
  }

  async ensureCacheDir() {
    if (this.config.tmdb.cacheEnabled) await fs.mkdir(this.config.tmdb.cacheDir, { recursive: true });
  }

  image(pathValue, size = 'w780') {
    return pathValue ? 'https://image.tmdb.org/t/p/' + size + pathValue : '';
  }

  cacheFileName(kind, params = {}) {
    const language = this.config.tmdb.language || 'pt-BR';
    if (kind === 'search_movie') return 'search_movie_' + slug(params.query) + (params.year ? '_' + params.year : '') + '_' + language + '_' + hashObject(params) + '.json';
    if (kind === 'search_tv') return 'search_tv_' + slug(params.query) + (params.first_air_date_year ? '_' + params.first_air_date_year : '') + '_' + language + '_' + hashObject(params) + '.json';
    if (kind === 'movie_details') return 'movie_details_' + params.id + '_' + language + '.json';
    if (kind === 'tv_details') return 'tv_details_' + params.id + '_' + language + '.json';
    return slug(kind) + '_' + hashObject(params) + '.json';
  }

  cachePath(kind, params) {
    return path.join(this.config.tmdb.cacheDir, this.cacheFileName(kind, params));
  }

  async readCache(kind, params) {
    if (!this.config.tmdb.cacheEnabled) return null;
    const file = this.cachePath(kind, params);
    if (this.memory.has(file)) {
      this.stats.cacheHits += 1;
      const cached = this.memory.get(file);
      if (cached?.notFound) this.stats.notFoundCacheHits += 1;
      return cached;
    }
    try {
      const cached = JSON.parse(await fs.readFile(file, 'utf8'));
      this.memory.set(file, cached);
      this.stats.cacheHits += 1;
      if (cached?.notFound) this.stats.notFoundCacheHits += 1;
      return cached;
    } catch (error) {
      if (error?.code !== 'ENOENT') console.warn('[TMDB] cache invalido ignorado: ' + file);
      return null;
    }
  }

  async writeCache(kind, params, data) {
    if (!this.config.tmdb.cacheEnabled) return;
    const file = this.cachePath(kind, params);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    this.memory.set(file, data);
  }

  buildUrl(endpoint, params = {}) {
    const url = new URL('https://api.themoviedb.org/3' + endpoint);
    url.searchParams.set('api_key', this.config.tmdb.apiKey);
    url.searchParams.set('language', this.config.tmdb.language);
    if (this.config.tmdb.region) url.searchParams.set('region', this.config.tmdb.region);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
    }
    return url;
  }

  async fetchOnce(endpoint, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.tmdb.timeoutMs);
    try {
      this.stats.apiCalls += 1;
      const response = await fetch(this.buildUrl(endpoint, params), { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) {
        const error = new Error('TMDB HTTP ' + response.status + ' em ' + endpoint);
        error.status = response.status;
        throw error;
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  isRetryable(error) {
    return error?.name === 'AbortError' || error?.status === undefined || RETRY_STATUS.has(error.status);
  }

  async fetchWithRetry(endpoint, params) {
    const attempts = this.config.tmdb.retryAttempts;
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        if (attempt > 1) console.log('[TMDB] tentativa ' + attempt + '/' + attempts + ' em ' + endpoint);
        return await this.fetchOnce(endpoint, params);
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt >= attempts) break;
        this.stats.retries += 1;
        const label = error.status || error.name || 'rede';
        console.warn('[TMDB] erro ' + label + ' em ' + endpoint + ', tentativa ' + attempt + '/' + attempts);
        console.warn('[TMDB] aguardando ' + this.config.tmdb.retryDelayMs + 'ms antes de tentar novamente');
        await sleep(this.config.tmdb.retryDelayMs);
      }
    }
    if (lastError && this.isRetryable(lastError)) this.stats.failuresAfterRetry += 1;
    throw lastError;
  }

  async cachedRequest(kind, endpoint, params = {}, options = {}) {
    if (!this.enabled) return null;
    const cacheParams = { ...params };
    const cached = await this.readCache(kind, cacheParams);
    if (cached) return cached;
    const data = await this.fetchWithRetry(endpoint, params);
    if (options.cacheNotFound && (!Array.isArray(data?.results) || data.results.length === 0)) {
      const notFound = { notFound: true, query: params.query || '', year: params.year || params.first_air_date_year || null, cachedAt: new Date().toISOString() };
      await this.writeCache(kind, cacheParams, notFound);
      return notFound;
    }
    await this.writeCache(kind, cacheParams, data);
    return data;
  }

  async searchMovie(query, year) {
    const params = { query, year, include_adult: 'false' };
    const data = await this.cachedRequest('search_movie', '/search/movie', params, { cacheNotFound: true });
    return data?.notFound ? [] : data?.results || [];
  }

  async searchSeries(query, year) {
    const params = { query, first_air_date_year: year, include_adult: 'false' };
    const data = await this.cachedRequest('search_tv', '/search/tv', params, { cacheNotFound: true });
    return data?.notFound ? [] : data?.results || [];
  }

  movieDetails(id) {
    return this.cachedRequest('movie_details', '/movie/' + id, { id, append_to_response: 'credits' });
  }

  seriesDetails(id) {
    return this.cachedRequest('tv_details', '/tv/' + id, { id, append_to_response: 'credits' });
  }
}
