import { normalizeText } from './utils.js';

export const PRODUCERS = ['netflix', 'prime_video', 'hbo_max', 'disney_plus', 'star_plus', 'paramount', 'globoplay', 'crunchyroll', 'discovery_plus', 'apple_tv_plus', 'amc_plus', 'lionsgate', 'universal', 'outras_produtoras'];
const RULES = [
  [/\bnetflix\b/, 'netflix'],
  [/\bprime video\b|\bamazon prime video\b|\bamazon prime\b/, 'prime_video'],
  [/\bhbo max\b|\bmax\b/, 'hbo_max'],
  [/\bdisney plus\b|\bdisney\+\b|\bdisney\b/, 'disney_plus'],
  [/\bstar plus\b|\bstar\+\b|\bstarplus\b/, 'star_plus'],
  [/\bparamount\b|\bparamount\+\b/, 'paramount'],
  [/\bgloboplay\b|\bglobo play\b/, 'globoplay'],
  [/\bcrunchyroll\b/, 'crunchyroll'],
  [/\bdiscovery plus\b|\bdiscovery\+\b/, 'discovery_plus'],
  [/\bapple tv plus\b|\bapple tv\+\b|\bapple tv\b/, 'apple_tv_plus'],
  [/\bamc plus\b|\bamc\+\b|\bamc\b/, 'amc_plus'],
  [/\blionsgate\b/, 'lionsgate'],
  [/\buniversal\b/, 'universal']
];
export function mapProducer(categoryName) {
  const text = normalizeText(categoryName).replace(/[^a-z0-9+\s]/g, ' ');
  for (const [pattern, producer] of RULES) if (pattern.test(text)) return producer;
  return 'outras_produtoras';
}
