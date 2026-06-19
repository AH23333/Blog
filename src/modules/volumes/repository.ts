import type { Phile } from "../philes/model";
import { getAllPhiles, getPhilesByVolume } from "../philes/repository";
import type { PhileGroup, Volume } from "./model";

/**
 * 从 sourcePath 中提取子目录名。
 * 例如 "volume-1/programming-language/C.md" → "programming-language"
 * 如果在 volume 根目录下，返回 undefined。
 */
function extractCategory(sourcePath: string): string | undefined {
  // sourcePath: "volume-1/programming-language/C.md"
  const parts = sourcePath.split("/");
  // parts[0] = "volume-1", parts[1] = "programming-language", parts[2] = "C.md"
  if (parts.length <= 2) {
    return undefined; // 直接在 volume 根目录下
  }
  return parts[1];
}

/** 将目录名转换为显示标签，如 "write-ups" → "Write-ups" */
function categoryLabel(dir: string): string {
  return dir
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupPhiles(philes: Phile[]): PhileGroup[] {
  const groupMap = new Map<string, Phile[]>();

  for (const phile of philes) {
    const category = extractCategory(phile.route.sourcePath) ?? "__root__";
    const existing = groupMap.get(category);
    if (existing) {
      existing.push(phile);
    } else {
      groupMap.set(category, [phile]);
    }
  }

  return [...groupMap.entries()].map(([dir, groupPhiles]) => ({
    dir,
    label: dir === "__root__" ? "" : categoryLabel(dir),
    philes: groupPhiles
  }));
}

export async function getAllVolumes(philes?: Phile[]): Promise<Volume[]> {
  const allPhiles = philes ?? (await getAllPhiles());
  const philesByVolume = new Map<number, Phile[]>();

  for (const phile of allPhiles) {
    const volumePhiles = philesByVolume.get(phile.route.volume);

    if (volumePhiles) {
      volumePhiles.push(phile);
    } else {
      philesByVolume.set(phile.route.volume, [phile]);
    }
  }

  return [...philesByVolume.entries()]
    .sort(([left], [right]) => compareVolumes(left, right))
    .map(([number, volumePhiles]) => ({
      number,
      href: `/volume/${number}/`,
      philes: volumePhiles,
      groups: groupPhiles(volumePhiles)
    }));
}

function compareVolumes(left: number, right: number): number {
  return left - right;
}

export async function getVolume(number: number): Promise<Volume | undefined> {
  const philes = await getPhilesByVolume(number);

  if (philes.length === 0) {
    return undefined;
  }

  return {
    number,
    href: `/volume/${number}/`,
    philes,
    groups: groupPhiles(philes)
  };
}
