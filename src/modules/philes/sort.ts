import type { VolumePhileSort } from "../../config/volumes.ts";
import { volumeConfig } from "../../config/volumes.ts";
import type { Phile } from "./model.ts";

/**
 * 跨 volume 全量排序比较器。
 *
 * 先按 volume 编号升序，再按各 volume 配置的 phileSort 规则排序，
 * 最后按 slug 字典序作为稳定 tiebreaker。
 */
export function comparePhiles(left: Phile, right: Phile): number {
  if (left.route.volume !== right.route.volume) {
    return left.route.volume - right.route.volume;
  }

  const config = volumeConfig(left.route.volume);
  const sort = config.phileSort ?? { by: "date", direction: "desc" };
  const sorted = compareByVolumeSort(left, right, sort);

  if (sorted !== 0) {
    return sorted;
  }

  return left.route.slug.localeCompare(right.route.slug);
}

/**
 * 单 volume 内按配置排序规则比较。
 *
 * - by: "date" → 按日期比较
 * - by: "order" → 按 order 权值比较
 *   - 两者都有 order 且不同 → 按 order 比较
 *   - 一方有 order 一方无 → 有 order 的排前面
 *   - 两者都无 order 或 order 相同 → 回退到日期比较（使用 volume 的 direction）
 */
export function compareByVolumeSort(left: Phile, right: Phile, sort: VolumePhileSort): number {
  if (sort.by === "date") {
    return compareDates(left, right, sort.direction);
  }

  const leftHasOrder = left.data.order !== undefined;
  const rightHasOrder = right.data.order !== undefined;

  const leftOrder = left.data.order;
  const rightOrder = right.data.order;

  if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
    return compareNumbers(leftOrder, rightOrder, sort.direction);
  }

  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1;
  }

  return compareDates(left, right, sort.direction);
}

function compareDates(left: Phile, right: Phile, direction: VolumePhileSort["direction"]): number {
  return compareNumbers(left.data.date.getTime(), right.data.date.getTime(), direction);
}

function compareNumbers(left: number, right: number, direction: VolumePhileSort["direction"]): number {
  return direction === "asc" ? left - right : right - left;
}