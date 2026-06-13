import { safeLogError } from './utils.js';

const RETRY_STATUS = new Set([500, 502, 503, 504, 520, 522, 524]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class XtreamClient {
  constructor(config) {
    this.config = config;
    this.stats = {
      retries: 0,
      failuresAfterRetry: 0,
      successfulCalls: 0
    };
  }

  getStats() {
    return { ...this.stats };
  }

  buildUrl(action, params = {}) {
    const url = new URL(this.config.xtream.baseUrl + '/player_api.php');
    url.searchParams.set('username', this.config.xtream.username);
    url.searchParams.set('password', this.config.xtream.password);
    if (action) url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
    }
    return url;
  }

  async fetchOnce(action, params = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.xtream.requestTimeoutMs);
    try {
      const response = await fetch(this.buildUrl(action, params), { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) {
        const error = new Error('Xtream HTTP ' + response.status + ' em action=' + action);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      this.stats.successfulCalls += 1;
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  isRetryable(error) {
    return error?.name === 'AbortError' || error?.status === undefined || RETRY_STATUS.has(error.status);
  }

  async request(action, params = {}) {
    const attempts = this.config.xtream.retryAttempts;
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        if (attempt > 1) console.log('[Xtream] tentativa ' + attempt + '/' + attempts + ' em ' + action);
        return await this.fetchOnce(action, params);
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt >= attempts) break;
        this.stats.retries += 1;
        const label = error.status || error.name || 'rede';
        console.warn('[Xtream] erro ' + label + ' em ' + action + ', tentativa ' + attempt + '/' + attempts);
        console.warn('[Xtream] aguardando ' + this.config.xtream.retryDelayMs + 'ms antes de tentar novamente');
        await sleep(this.config.xtream.retryDelayMs);
      }
    }
    if (lastError && this.isRetryable(lastError)) this.stats.failuresAfterRetry += 1;
    throw lastError;
  }

  async safeRequest(action, params = {}, fallback = [], options = {}) {
    try {
      return await this.request(action, params) ?? fallback;
    } catch (error) {
      console.warn('[Xtream] erro em ' + action + ': ' + safeLogError(error, this.config));
      if (options.throwOnFailure) throw error;
      return fallback;
    }
  }

  async requiredArrayRequest(action, params = {}) {
    try {
      const data = await this.request(action, params);
      if (!Array.isArray(data)) throw new Error('Xtream resposta invalida em action=' + action);
      return data;
    } catch (error) {
      console.error('[Xtream] chamada obrigatoria falhou: ' + action);
      throw error;
    }
  }

  getMovieCategories() { return this.safeRequest('get_vod_categories'); }
  getSeriesCategories() { return this.safeRequest('get_series_categories'); }
  getLiveCategories() { return this.safeRequest('get_live_categories'); }
  getMovies() { return this.safeRequest('get_vod_streams'); }
  getSeries() { return this.safeRequest('get_series'); }
  getMoviesRequired() { return this.requiredArrayRequest('get_vod_streams'); }
  getSeriesRequired() { return this.requiredArrayRequest('get_series'); }
  getLiveStreams() { return this.safeRequest('get_live_streams'); }
  getSeriesInfo(seriesId) { return this.safeRequest('get_series_info', { series_id: seriesId }, {}, { throwOnFailure: true }); }
}
