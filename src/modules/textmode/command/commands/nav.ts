/**
 * 博客导航命令集：cd / ls / cat
 * 基于博客 URL 结构模拟文件系统操作
 * 完全动态扫描，无硬编码路径 —— 新增文章/目录后自动识别
 */
import type { CommandResult } from "../types";

// ── 博客路径解析 ────────────────────────────────────────────────────────

/** 从当前 URL 解析博客路径 */
function currentPath(): string[] {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  return pathname === "/" ? [] : pathname.split("/").filter(Boolean);
}

/** 解析用户输入的路径，返回绝对路径段 */
function resolvePath(segments: string[], input: string): string[] | null {
  if (!input.trim()) return segments;
  if (input.startsWith("/")) {
    return input === "/" ? [] : input.split("/").filter(Boolean);
  }
  const parts = input.split("/").filter(Boolean);
  const result = [...segments];
  for (const part of parts) {
    if (part === "..") {
      if (result.length === 0) return null;
      result.pop();
    } else if (part !== ".") {
      result.push(part);
    }
  }
  return result;
}

/** 将路径段转为 URL 路径 */
function pathToUrl(segments: string[]): string {
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/** 模拟文件权限字符串 */
function mockPermissions(isDir: boolean): string {
  return isDir ? "drwxr-xr-x" : "-rw-r--r--";
}

/** 模拟文件大小（基于名称哈希） */
function mockSize(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return (Math.abs(hash) % 50000) + 100;
}

/** 模拟修改时间 */
function mockMtime(name: string): string {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = new Date();
  const daysAgo = hash % 90;
  const d = new Date(now.getTime() - daysAgo * 86400000);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
}

// ── 动态路由扫描 ─────────────────────────────────────────────────────────

/** 路由条目 */
interface RouteEntry {
  path: string;
  title: string;
  /** 路径段数组 */
  segs: string[];
}

/** 获取博客所有已知路由（从页面 <a> 标签动态扫描，无硬编码） */
function getKnownRoutes(): RouteEntry[] {
  const routes = new Map<string, RouteEntry>();
  const links = document.querySelectorAll("a[href]");
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("/") && !href.startsWith("//") && !href.includes("#")) {
      const clean = href.replace(/\/$/, "") || "/";
      if (!routes.has(clean)) {
        const segs = clean === "/" ? [] : clean.split("/").filter(Boolean);
        routes.set(clean, {
          path: clean,
          title: link.textContent?.trim() || link.getAttribute("title") || clean,
          segs
        });
      }
    }
  }
  return [...routes.values()];
}

/** 子项信息 */
interface ChildItem {
  name: string;
  path: string;
  isDir: boolean;
  title: string;
  size: number;
  mtime: string;
}

/**
 * 获取当前路径下的直接子项
 * 核心逻辑：扫描所有已知路由，按路径段前缀分组
 * 不依赖固定深度 —— 任意嵌套层级均能正确识别
 */
function getChildren(segments: string[]): ChildItem[] {
  const routes = getKnownRoutes();
  const children = new Map<string, ChildItem>();

  for (const route of routes) {
    const routeSegs = route.segs;

    // 跳过自身和不在当前路径下的路由
    if (routeSegs.length <= segments.length) continue;

    // 确认前缀完全匹配
    let prefixMatch = true;
    for (let i = 0; i < segments.length; i++) {
      if (routeSegs[i] !== segments[i]) {
        prefixMatch = false;
        break;
      }
    }
    if (!prefixMatch) continue;

    const childName = routeSegs[segments.length];

    if (!children.has(childName)) {
      // 判断是否为目录：存在更深层的路由，其前缀包含当前路由
      const isDir = routeSegs.length > segments.length + 1 ||
        routes.some((r) => {
          if (r.segs.length <= routeSegs.length) return false;
          for (let i = 0; i < routeSegs.length; i++) {
            if (r.segs[i] !== routeSegs[i]) return false;
          }
          return true;
        });

      children.set(childName, {
        name: childName,
        path: pathToUrl(routeSegs.slice(0, segments.length + 1)),
        isDir,
        title: isDir ? childName : route.title,
        size: mockSize(childName),
        mtime: mockMtime(childName)
      });
    }
    // 如果已存在但之前标记为非目录，现在发现是目录，更新
    else if (routeSegs.length > segments.length + 1) {
      const existing = children.get(childName);
      if (existing && !existing.isDir) {
        existing.isDir = true;
      }
    }
  }

  return [...children.values()];
}

/** 递归获取所有子项（用于树状显示） */
function getTreeChildren(segments: string[], prefix = "", depth = 0, maxDepth = 5): string[] {
  if (depth >= maxDepth) return [];
  const children = getChildren(segments);
  const lines: string[] = [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    const isLast = i === children.length - 1;
    const connector = isLast ? "\u2514\u2500 " : "\u251c\u2500 ";
    const entryPrefix = prefix + connector;
    if (c.isDir) {
      lines.push(`${entryPrefix}\u2502\u2500 ${c.name}/`);
      const subSegs = c.path.split("/").filter(Boolean);
      const subPrefix = prefix + (isLast ? "    " : "\u2502   ");
      const subLines = getTreeChildren(subSegs, subPrefix, depth + 1, maxDepth);
      lines.push(...subLines);
    } else {
      lines.push(`${entryPrefix}    ${c.name}  (${formatSize(c.size)})`);
    }
  }
  return lines;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// ── cd 命令 ──────────────────────────────────────────────────────────────

export function cdCommand(args: string[]): CommandResult {
  const current = currentPath();
  const input = args.join(" ") || "/";
  const resolved = resolvePath(current, input);

  if (resolved === null) {
    return { success: false, message: "cd: 已在根目录，无法返回上级" };
  }

  const targetUrl = pathToUrl(resolved);
  const currentUrl = window.location.pathname.replace(/\/$/, "") || "/";

  if (targetUrl === currentUrl) {
    return { success: true, message: `已在目录: ${targetUrl}` };
  }

  // 根目录始终有效
  if (targetUrl === "/") {
    window.location.href = "/";
    return { success: true, message: "正在导航到: / (欢迎页)" };
  }

  const routes = getKnownRoutes();

  // 检查目标页面是否存在
  const pageExists = routes.some((r) => r.path === targetUrl);

  if (pageExists) {
    window.location.href = targetUrl;
    return { success: true, message: `正在导航到: ${targetUrl}` };
  }

  // 目标页面不存在，检查是否为有效目录（有子页面）
  const hasChildren = routes.some((r) => {
    const t = targetUrl.split("/").filter(Boolean);
    if (r.segs.length <= t.length) return false;
    for (let i = 0; i < t.length; i++) {
      if (r.segs[i] !== t[i]) return false;
    }
    return true;
  });

  if (hasChildren) {
    // 中间目录没有独立页面，返回到根目录
    window.location.href = "/";
    return { success: true, message: `cd: ${targetUrl} 无独立页面，已返回根目录` };
  }

  return { success: false, message: `cd: 路径不存在或无权限访问: ${targetUrl}` };
}

// ── ls 命令 ──────────────────────────────────────────────────────────────

export function lsCommand(args: string[]): CommandResult {
  let target = currentPath();
  let sortBy = "name";
  let reverse = false;
  let longFormat = false;
  let treeFormat = false;

  const flagArgs: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("-")) {
      flagArgs.push(arg);
    } else {
      const resolved = resolvePath(target, arg);
      if (resolved !== null) target = resolved;
    }
  }

  for (const flag of flagArgs) {
    for (let i = 1; i < flag.length; i++) {
      const ch = flag[i];
      if (ch === "t") sortBy = "time";
      else if (ch === "S") sortBy = "size";
      else if (ch === "r") reverse = true;
      else if (ch === "l") longFormat = true;
      else if (ch === "T") treeFormat = true;
    }
  }

  const cwd = pathToUrl(target);

  // ── 树状显示 ──
  if (treeFormat) {
    const treeLines = getTreeChildren(target);
    if (treeLines.length === 0) {
      return {
        success: true,
        message: `\u250c${"\u2500".repeat(48)}\u2510\n\u2502 ${"DIR: ".padEnd(2)}${cwd.padEnd(44)} \u2502\n\u2502 ${"(空目录)".padEnd(44)} \u2502\n\u2514${"\u2500".repeat(48)}\u2518`
      };
    }
    const lines = [
      `\u250c${"\u2500".repeat(48)}\u2510`,
      `\u2502 ${"DIR: ".padEnd(2)}${cwd.padEnd(44)} \u2502`,
      `\u2502 ${cwd === "/" ? "/" : (cwd.split("/").pop() ?? "/")}\u2502`,
      ...treeLines.map((l) => `\u2502 ${l.padEnd(44)} \u2502`),
      `\u2502${" ".repeat(44)}\u2502`,
      `\u2502 ${`${treeLines.length} 项`.padEnd(44)} \u2502`,
      `\u2514${"\u2500".repeat(48)}\u2518`
    ];
    return { success: true, message: lines.join("\n") };
  }

  // ── 获取子项并排序 ──
  const children = getChildren(target);

  if (children.length === 0) {
    return { success: true, message: `${cwd}\n(空目录)` };
  }

  children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "time":
        cmp = a.mtime.localeCompare(b.mtime);
        break;
      case "size":
        cmp = a.size - b.size;
        break;
    }
    return reverse ? -cmp : cmp;
  });

  // ── 详细列表显示 (-l) ──
  if (longFormat) {
    const maxSize = Math.max(...children.map((c) => formatSize(c.size).length));
    const lines = [
      `\u250c${"\u2500".repeat(68)}\u2510`,
      `\u2502 ${"DIR: ".padEnd(2)}${cwd.padEnd(64)} \u2502`,
      `\u2502${" ".repeat(64)}\u2502`,
      `\u2502 ${"PERMISSIONS".padEnd(12)} ${"SIZE".padStart(maxSize)}  ${"MODIFIED".padEnd(19)} ${"NAME".padEnd(20)} \u2502`,
      `\u2502 ${"-".repeat(12)} ${"-".repeat(maxSize)}  ${"-".repeat(19)} ${"-".repeat(20)} \u2502`,
      ...children.map((c) => {
        const perm = mockPermissions(c.isDir);
        const size = formatSize(c.size).padStart(maxSize);
        const name = c.isDir ? `${c.name}/` : c.name;
        return `\u2502 ${perm}  ${size}  ${c.mtime}  ${name.padEnd(20)} \u2502`;
      }),
      `\u2502${" ".repeat(64)}\u2502`,
      `\u2502 ${`${children.length} 项 (${children.filter((c) => c.isDir).length} 目录, ${children.filter((c) => !c.isDir).length} 文件)`.padEnd(64)} \u2502`,
      `\u2514${"\u2500".repeat(68)}\u2518`
    ];
    return { success: true, message: lines.join("\n") };
  }

  // ── 基础列表 ──
  const maxLen = Math.max(...children.map((c) => c.name.length), 8);
  const lines = [
    `\u250c${"\u2500".repeat(52)}\u2510`,
    `\u2502 ${`DIR: ${cwd}`.padEnd(50)} \u2502`,
    `\u2502${" ".repeat(50)}\u2502`,
    ...children.map(
      (c) =>
        `\u2502 ${`${c.isDir ? "\u251c\u2500 " : "    "}${c.name.padEnd(maxLen + 4)}${c.isDir ? "/" : " "}`.padEnd(50)} \u2502`
    ),
    `\u2502${" ".repeat(50)}\u2502`,
    `\u2502 ${`${children.length} 项`.padEnd(50)} \u2502`,
    `\u2514${"\u2500".repeat(52)}\u2518`
  ];

  return { success: true, message: lines.join("\n") };
}

// ── cat 命令 ──────────────────────────────────────────────────────────────

export function catCommand(args: string[]): CommandResult {
  if (args.length === 0) {
    return { success: false, message: "cat: 缺少参数\n用法: cat <路径>\n示例: cat /volume/0/test" };
  }

  const current = currentPath();
  const input = args.join(" ");
  const resolved = resolvePath(current, input);

  if (resolved === null) {
    return { success: false, message: "cat: 无效路径" };
  }

  const targetUrl = pathToUrl(resolved);
  const routes = getKnownRoutes();
  const found = routes.find((r) => r.path === targetUrl);

  if (!found) {
    return { success: false, message: `cat: 文件不存在: ${targetUrl}` };
  }

  const isDir = routes.some((r) => {
    const t = targetUrl.split("/").filter(Boolean);
    if (r.segs.length <= t.length) return false;
    for (let i = 0; i < t.length; i++) {
      if (r.segs[i] !== t[i]) return false;
    }
    return true;
  });

  if (isDir) {
    return { success: false, message: `cat: ${targetUrl}: 是一个目录` };
  }

  window.location.href = targetUrl;
  return { success: true, message: `正在打开: ${found.title} (${targetUrl})` };
}

// ── 路径补全 ─────────────────────────────────────────────────────────────

/** 获取路径补全候选项 */
export function getPathCompletions(prefix: string): { text: string; description: string }[] {
  const current = currentPath();
  const lastSlash = prefix.lastIndexOf("/");
  const dirPart = lastSlash >= 0 ? prefix.slice(0, lastSlash + 1) : "";
  const namePart = lastSlash >= 0 ? prefix.slice(lastSlash + 1) : prefix;

  let targetSegs = current;
  if (dirPart) {
    const resolved = resolvePath(current, dirPart);
    if (resolved === null) return [];
    targetSegs = resolved;
  }

  const children = getChildren(targetSegs);
  const lower = namePart.toLowerCase();

  return children
    .filter((c) => c.name.toLowerCase().startsWith(lower))
    .map((c) => ({
      text: `${dirPart}${c.name}${c.isDir ? "/" : ""}`,
      description: c.isDir ? "目录" : "文章"
    }));
}