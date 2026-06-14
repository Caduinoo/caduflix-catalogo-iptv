export function todayInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function localTimestamp(date, time, timezone) {
  const [hour, minute] = time.split(":").map(Number);
  const base = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
  const parts = localDateParts(base, timezone);
  const utcLike = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMinutes = Math.round((utcLike - base.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
}

export function localDateParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

export function nowLocalIso(timezone) {
  const now = new Date();
  const parts = localDateParts(now, timezone);
  const utcLike = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMinutes = Math.round((utcLike - now.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function sanitizeText(value) {
  if (value == null) return "";
  let text = String(value);
  for (let i = 0; i < 2 && /[ÃÂâ¬]/.test(text); i += 1) text = repairMojibakeOnce(text);
  return text
    .replace(/â€¢/g, " - ")
    .replace(/â€“|â€”/g, "-")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/â€¦/g, "...")
    .replace(/[Â¬]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function repairMojibakeOnce(value) {
  const replacements = { "Ã§": "ç", "Ã£": "ã", "Ã¡": "á", "Ã©": "é", "Ãª": "ê", "Ã³": "ó", "Ãº": "ú", "Ã­": "í", "Ã´": "ô", "Ãµ": "õ", "Ã ": "à", "Â°": "°" };
  let text = value;
  for (const [bad, good] of Object.entries(replacements)) text = text.split(bad).join(good);
  return text;
}

export function normalize(value) {
  return sanitizeText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace("+", " plus ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function slug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function unique(values) {
  return [...new Set(values.filter((item) => item != null && String(item).trim() !== ""))];
}

export function sanitizeDeep(value) {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [sanitizeText(key), sanitizeDeep(item)]));
  return typeof value === "string" ? sanitizeText(value) : value;
}
