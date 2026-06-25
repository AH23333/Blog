import { getCollection } from "astro:content";
import type { Phile } from "./model";
import { routeForPhile } from "./routing";
import { comparePhiles } from "./sort";

let productionPhileCache: Phile[] | undefined;

export async function getAllPhiles(): Promise<Phile[]> {
  if (import.meta.env.PROD && productionPhileCache) {
    return productionPhileCache;
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
