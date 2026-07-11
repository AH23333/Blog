import { getCollection } from "astro:content";
import type { Phile } from "./model";
import { routeForPhile } from "./routing";
import { comparePhiles } from "./sort";

/** 生产模式缓存 */
let productionPhileCache: Phile[] | undefined;

/** 开发模式缓存 TTL（毫秒），避免每次请求重新加载全部集合 */
const DEV_CACHE_TTL_MS = 5_000;

let devCache: { philes: Phile[]; timestamp: number } | undefined;

export async function getAllPhiles(): Promise<Phile[]> {
  if (import.meta.env.PROD && productionPhileCache) {
    return productionPhileCache;
  }

  // 开发模式：使用带 TTL 的缓存，避免每次 HMR 或请求都重新加载
  if (import.meta.env.DEV) {
    const now = Date.now();
    if (devCache && now - devCache.timestamp < DEV_CACHE_TTL_MS) {
      return devCache.philes;
    }
  }

  const entries = await getCollection("philes");
  const philes = entries.map((entry) => ({
    ...entry,
    route: routeForPhile(entry)
  }));

  assertUniqueSlugs(philes);

  const sorted = philes.sort(comparePhiles);

  if (import.meta.env.PROD) {
    productionPhileCache = sorted;
  }

  if (import.meta.env.DEV) {
    devCache = { philes: sorted, timestamp: Date.now() };
  }

  return sorted;
}

export async function getPhilesByVolume(volume: number): Promise<Phile[]> {
  return (await getAllPhiles()).filter((phile) => phile.route.volume === volume);
}

export async function getPhileByRoute(volume: number, slug: string): Promise<Phile | undefined> {
  return (await getAllPhiles()).find((phile) => phile.route.volume === volume && phile.route.slug === slug);
}

function assertUniqueSlugs(philes: Phile[]): void {
  const seen = new Map<string, string>();

  for (const phile of philes) {
    const key = `${phile.route.volume}/${phile.route.slug}`;
    const existing = seen.get(key);

    if (existing) {
      throw new Error(`Duplicate phile route "${key}" in "${existing}" and "${phile.route.sourcePath}".`);
    }

    seen.set(key, phile.route.sourcePath);
  }
}
