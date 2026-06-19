import { textmodeConfig, volumeConfig } from "../../config";
import { escapeHtml, link, textHtml } from "../textmode/core/html";
import { cellWidth, padCells, truncateCells } from "../textmode/core/layout";
import { volumeTitle } from "./labels";
import type { Volume } from "./model";

const tocRightColumn = textmodeConfig.volumeRightColumn;
const tocInnerWidth = tocRightColumn - 1;
const tocContentWidth = tocInnerWidth - 2;

export function renderVolumePre(volume: Volume): string {
  const toc = renderToc(volume);
  const postscript = volumeConfig(volume.number).postscript ?? [];

  return `\n${toc}\n\n${textHtml(postscript.join("\n"))}\n`;
}

function renderToc(volume: Volume): string {
  const config = volumeConfig(volume.number);
  const title = config.subtitle ? `${volumeTitle(volume)} - ${config.subtitle}` : volumeTitle(volume);

  // 计算 entryLabel 的最大宽度（全局统一）
  const entryLabelWidth = Math.max(
    ...volume.philes.map((phile, index) => cellWidth(entryLabel(volume, index, phile.data.title, phile.data.date)))
  );

  const lines = [
    `┌${"─".repeat(tocInnerWidth)}┐`,
    `│ ${pad(title, tocContentWidth)} │`,
    `│ ${pad("                                    CONTENTS", tocContentWidth)} │`,
    frameLine("")
  ];

  const hasGroups = volume.groups.length > 1 || (volume.groups.length === 1 && volume.groups[0].dir !== "__root__");

  if (hasGroups) {
    // 树状多级目录
    let globalIndex = 0;
    for (const group of volume.groups) {
      // 分类标题行
      const groupLabel = group.label || "Root";
      const separator = `─ ${groupLabel} ${"─".repeat(Math.max(0, tocContentWidth - groupLabel.length - 3))}`;
      lines.push(`│ ${separator} │`);

      for (const phile of group.philes) {
        lines.push(
          renderTocLine(
            volume,
            globalIndex,
            phile.data.title,
            phile.data.date,
            phile.route.href,
            phile.data.author,
            entryLabelWidth
          )
        );
        globalIndex++;
      }

      lines.push(frameLine(""));
    }
  } else {
    // 扁平列表（无子目录或仅根目录）
    for (let i = 0; i < volume.philes.length; i++) {
      const phile = volume.philes[i];
      lines.push(
        renderTocLine(
          volume,
          i,
          phile.data.title,
          phile.data.date,
          phile.route.href,
          phile.data.author,
          entryLabelWidth
        )
      );
    }
    lines.push(frameLine(""));
  }

  lines.push(`└${"─".repeat(tocInnerWidth)}┘`);
  return lines.join("\n");
}

function renderTocLine(
  volume: Volume,
  index: number,
  title: string,
  date: Date,
  href: string,
  author: string,
  entryLabelWidth: number
): string {
  const config = volumeConfig(volume.number);
  const label = entryLabel(volume, index, title, date);
  const prefix = `${padCells(label, entryLabelWidth)}  `;
  const entryTitle = config.entryLabel === "year" ? title.replace(/^\d{4}\s+/, "") : title;
  const tail = ` ${author}`;
  const titleWidth = Math.max(1, tocInnerWidth - cellWidth(prefix) - cellWidth(tail) - 6);
  const displayTitle = truncateCells(entryTitle, titleWidth);
  const titleLink = link(href, displayTitle);
  const visibleLeft = `${prefix}${displayTitle}`;
  const dots = ".".repeat(Math.max(3, tocInnerWidth - cellWidth(visibleLeft) - cellWidth(tail) - 3));

  return `│ ${escapeHtml(prefix)}${titleLink} ${dots}${textHtml(tail)} │`;
}

function entryLabel(volume: Volume, index: number, title: string, date: Date): string {
  const config = volumeConfig(volume.number);
  const entryNumber = config.reverseEntryNumbers ? volume.philes.length - index - 1 : index;
  const titleYear = title.match(/^\d{4}\b/)?.[0];

  return config.entryLabel === "year"
    ? (titleYear ?? String(date.getUTCFullYear()))
    : `${config.entryPrefix ?? volume.number}.${entryNumber}`;
}

function pad(input: string, width: number): string {
  return padCells(input, width);
}

function frameLine(input: string): string {
  return `│ ${pad(input, tocContentWidth)} │`;
}
