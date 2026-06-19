import type { PhileEntry, PhileRoute } from "./model";

const volumePathPattern = /^volume-(\d+)\/(.+?)(?:\.md)?$/;

export function routeForPhile(entry: PhileEntry): PhileRoute {
  const match = entry.id.match(volumePathPattern);

  if (!match) {
    throw new Error(`Invalid path "${entry.id}". Expected content/philes/volume-<number>/**/*.md.`);
  }

  const volume = Number(match[1]);
  const pathWithoutVolume = match[2];
  const basename = pathWithoutVolume.split("/").at(-1);
  const slug = entry.data.slug ?? basename?.toLowerCase();

  if (!slug) {
    throw new Error(`Unable to derive slug for "${entry.id}".`);
  }

  return {
    volume,
    slug,
    href: `/volume/${volume}/${slug}/`,
    volumeHref: `/volume/${volume}/`,
    sourcePath: entry.id
  };
}
