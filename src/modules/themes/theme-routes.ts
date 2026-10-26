/**
 * 主题路由工具：在 textmode / erudite / paper / retypeset 之间
 * 计算保持浏览位置（首页 / 卷 / 文章）的平行路径。
 *
 * 约定（见 AGENTS.md）：
 * - textmode 是默认主题：`/`、`/volume/{n}/`、`/volume/{n}/{slug}/`
 * - 其他主题：`/themes/{id}/...` 镜像同样的路径结构
 */

export type ThemeId = "textmode" | "erudite" | "paper" | "retypeset";

/** 计算目标主题下与当前浏览位置对应的路径 */
export function themeUrl(id: ThemeId, volume?: number, slug?: string): string {
  if (id === "textmode") {
    if (volume !== undefined && slug) {
      return `/volume/${volume}/${slug}/`;
    }
    if (volume !== undefined) {
      return `/volume/${volume}/`;
    }
    return "/";
  }

  if (volume !== undefined && slug) {
    return `/themes/${id}/volume/${volume}/${slug}/`;
  }
  if (volume !== undefined) {
    return `/themes/${id}/volume/${volume}/`;
  }
  return `/themes/${id}/`;
}
