import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value ?? null;
}

export function fingerprint(value) {
  return crypto.createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
}

export async function loadCatalogState(config) {
  if (!config.incremental.enabled) return { generatedAt: null, movies: {}, series: {} };
  try {
    const state = JSON.parse(await fs.readFile(config.incremental.stateFile, 'utf8'));
    return {
      generatedAt: state.generatedAt || null,
      movies: state.movies && typeof state.movies === 'object' ? state.movies : {},
      series: state.series && typeof state.series === 'object' ? state.series : {}
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('[incremental] estado invalido ignorado: ' + error.message);
    return { generatedAt: null, movies: {}, series: {} };
  }
}

export async function saveCatalogState(config, state) {
  await fs.mkdir(path.dirname(config.incremental.stateFile), { recursive: true });
  await fs.writeFile(config.incremental.stateFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
