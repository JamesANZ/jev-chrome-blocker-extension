import { JEV_MODEL } from "./types";

/** FNV-1a 32-bit, hex. Stable across Node tests and the service worker. */
export function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** hash(normalized text + rule ids + model) */
export function cacheKey(
  text: string,
  ruleIds: string[],
  model: string = JEV_MODEL,
): string {
  const payload = `${normalizeText(text)}\0${[...ruleIds].sort().join(",")}\0${model}`;
  return hashString(payload);
}

export class JudgmentCache {
  private readonly map = new Map<string, Record<string, number>>();

  constructor(private readonly max = 500) {}

  get(key: string): Record<string, number> | undefined {
    const value = this.map.get(key);
    if (value) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, scores: Record<string, number>): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, scores);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
