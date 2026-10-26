/**
 * 构建期读取本地图片尺寸（零依赖，仅解析文件头）。
 *
 * 为 <img> 注入 width/height 属性以在图片加载前预留宽高比：
 *  - 消除懒加载图片加载后的布局位移（CLS）
 *  - 关键场景：目录锚点跳转后视口上方的懒图才加载，若无预留尺寸，
 *    图片从 0 高度长到实际高度会把目标节推出视口（跳转漂移），
 *    且 Chromium 的滚动锚定不补偿锚定节点内部的尺寸增长
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ImageSize = { width: number; height: number };

const sizeCache = new Map<string, ImageSize | null>();

/** 读取 public/ 下 /images/ 前缀的本地图片尺寸；找不到或格式不支持返回 null */
export function localImageSize(publicPath: string): ImageSize | null {
  if (!publicPath.startsWith("/images/")) {
    return null;
  }

  // markdown-it 会把中文文件名 URL 编码，文件系统需要解码后的真实路径
  let rel = publicPath.slice(1);
  try {
    rel = decodeURIComponent(rel);
  } catch {
    rel = publicPath.slice(1);
  }

  if (sizeCache.has(rel)) {
    return sizeCache.get(rel) ?? null;
  }

  let result: ImageSize | null = null;
  try {
    result = probeDimensions(readFileSync(join(process.cwd(), "public", rel)));
  } catch {
    result = null;
  }

  sizeCache.set(rel, result);
  return result;
}

/** 解析 PNG / GIF / JPEG / WebP 文件头中的像素尺寸 */
function probeDimensions(buf: Buffer): ImageSize | null {
  // PNG: IHDR 的宽高位于固定偏移（16/20，大端）
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: 逻辑屏幕尺寸（6/8，小端）
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // JPEG: 逐个 marker 扫描 SOFn 帧头
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      // SOF0-SOF15，排除 DHT/JPG/DAC（无尺寸字段）
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
    return null;
  }

  // WebP
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (fmt === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (fmt === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }

  return null;
}
