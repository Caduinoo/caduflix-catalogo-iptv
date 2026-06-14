import { sanitizeText } from "./utils.js";

export class PixsuperClient {
  constructor(config) {
    this.baseUrl = config.pixsuperBaseUrl;
    this.username = config.pixsuperUsername;
    this.password = config.pixsuperPassword;
  }

  async getLiveCategories() {
    return this.request("get_live_categories");
  }

  async getLiveStreams(categoryId) {
    return this.request("get_live_streams", categoryId ? { category_id: categoryId } : {});
  }

  async request(action, params = {}) {
    const url = new URL(this.baseUrl.endsWith("/player_api.php") ? this.baseUrl : `${this.baseUrl}/player_api.php`);
    url.searchParams.set("username", this.username);
    url.searchParams.set("password", this.password);
    url.searchParams.set("action", action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    console.log(`[Pixsuper] GET ${action} ${maskUrl(url.toString())}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Pixsuper HTTP ${response.status} em ${action}`);
    const json = text.trim() ? JSON.parse(text) : [];
    if (!Array.isArray(json)) throw new Error(`Resposta Pixsuper invalida em ${action}`);
    return json.map((item) => sanitizeObject(item));
  }
}

function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? sanitizeText(item) : sanitizeObject(item)]));
  return value;
}

function maskUrl(value) {
  return value.replace(/([?&]username=)[^&]+/i, "$1***").replace(/([?&]password=)[^&]+/i, "$1***");
}
