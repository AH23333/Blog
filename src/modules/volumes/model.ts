import type { Phile } from "../philes/model";

export type PhileGroup = {
  /** 目录名（如 "write-ups"） */
  dir: string;
  /** 显示标签（如 "Write-ups"） */
  label: string;
  philes: Phile[];
};

export type Volume = {
  number: number;
  href: string;
  philes: Phile[];
  /** 按子目录分组的树状结构，无子目录時为空 */
  groups: PhileGroup[];
};
