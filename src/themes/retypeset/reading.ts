/**
 * 阅读时长估算（中文约 300 字/分钟，英文约 200 词/分钟）。
 */

export function estimateReadingMinutes(body: string | undefined): number {
  if (!body) {
    return 1;
  }

  const cjkChars = (body.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) ?? []).length;
  const latinWords = (body.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, " ").match(/[a-zA-Z]+/g) ?? []).length;

  return Math.max(1, Math.round(cjkChars / 300 + latinWords / 200));
}
