/**
 * 主题系统模块
 * 5 种预设主题 + 自定义配置 + 预览 + 导入/导出
 */
import type { CommandResult } from "../types";

// ── 主题类型定义 ──────────────────────────────────────────────────────────

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  /** CSS 自定义属性映射 */
  vars: Record<string, string>;
  /** 是否为预设主题 */
  preset: boolean;
}

// ── 5 种预设主题 ──────────────────────────────────────────────────────────

export const PRESET_THEMES: ThemeConfig[] = [
  {
    id: "default",
    name: "默认主题",
    description: "经典暗色终端风格，绿色系配色",
    preset: true,
    vars: {
      "--bg": "#0c0d10",
      "--home-bg": "#0a0b11",
      "--fg": "#fefefe",
      "--link": "#93ffd7",
      "--link-hover-bg": "#153329",
      "--link-hover": "#c7ffe9",
      "--ansi-black": "#15161e",
      "--ansi-red": "#f7768e",
      "--ansi-green": "#9ece6a",
      "--ansi-yellow": "#e0af68",
      "--ansi-blue": "#7aa2f7",
      "--ansi-magenta": "#bb9af7",
      "--ansi-cyan": "#7dcfff",
      "--ansi-white": "#a9b1d6",
      "--ansi-bright-black": "#414868",
      "--ansi-bright-red": "#ff899d",
      "--ansi-bright-green": "#b4f9a8",
      "--ansi-bright-yellow": "#e0c989",
      "--ansi-bright-blue": "#8db0ff",
      "--ansi-bright-magenta": "#c7a9ff",
      "--ansi-bright-cyan": "#a4daff",
      "--ansi-bright-white": "#c0caf5",
      "--cmd-bg": "#0a0b11",
      "--cmd-input-bg": "#0c0d10",
      "--cmd-border": "#414868"
    }
  },
  {
    id: "dark",
    name: "深色主题",
    description: "深色背景 + 浅色文字，降低视觉疲劳",
    preset: true,
    vars: {
      "--bg": "#1a1b26",
      "--home-bg": "#16161e",
      "--fg": "#c0caf5",
      "--link": "#7dcfff",
      "--link-hover-bg": "#1a3a4a",
      "--link-hover": "#a4daff",
      "--ansi-black": "#1a1b26",
      "--ansi-red": "#f7768e",
      "--ansi-green": "#9ece6a",
      "--ansi-yellow": "#e0af68",
      "--ansi-blue": "#7aa2f7",
      "--ansi-magenta": "#ad8ee7",
      "--ansi-cyan": "#7dcfff",
      "--ansi-white": "#a9b1d6",
      "--ansi-bright-black": "#565f89",
      "--ansi-bright-red": "#ff899d",
      "--ansi-bright-green": "#b4f9a8",
      "--ansi-bright-yellow": "#e0c989",
      "--ansi-bright-blue": "#8db0ff",
      "--ansi-bright-magenta": "#c7a9ff",
      "--ansi-bright-cyan": "#a4daff",
      "--ansi-bright-white": "#c0caf5",
      "--cmd-bg": "#16161e",
      "--cmd-input-bg": "#1a1b26",
      "--cmd-border": "#565f89"
    }
  },
  {
    id: "light",
    name: "浅色主题",
    description: "浅色背景 + 深色文字，适合明亮环境",
    preset: true,
    vars: {
      "--bg": "#f5f5f5",
      "--home-bg": "#eeeeee",
      "--fg": "#1a1a1a",
      "--link": "#0066cc",
      "--link-hover-bg": "#ddeeff",
      "--link-hover": "#004499",
      "--ansi-black": "#2e2e2e",
      "--ansi-red": "#cc0000",
      "--ansi-green": "#008800",
      "--ansi-yellow": "#886600",
      "--ansi-blue": "#2244cc",
      "--ansi-magenta": "#8822aa",
      "--ansi-cyan": "#008899",
      "--ansi-white": "#666666",
      "--ansi-bright-black": "#999999",
      "--ansi-bright-red": "#ff4444",
      "--ansi-bright-green": "#22cc22",
      "--ansi-bright-yellow": "#ccaa00",
      "--ansi-bright-blue": "#4466ff",
      "--ansi-bright-magenta": "#cc44ff",
      "--ansi-bright-cyan": "#22ccdd",
      "--ansi-bright-white": "#333333",
      "--cmd-bg": "#eeeeee",
      "--cmd-input-bg": "#f5f5f5",
      "--cmd-border": "#cccccc"
    }
  },
  {
    id: "high-contrast",
    name: "高对比度主题",
    description: "极致对比度，适合视力障碍用户",
    preset: true,
    vars: {
      "--bg": "#000000",
      "--home-bg": "#000000",
      "--fg": "#ffffff",
      "--link": "#ffff00",
      "--link-hover-bg": "#333300",
      "--link-hover": "#ffff88",
      "--ansi-black": "#000000",
      "--ansi-red": "#ff3333",
      "--ansi-green": "#33ff33",
      "--ansi-yellow": "#ffff33",
      "--ansi-blue": "#3388ff",
      "--ansi-magenta": "#ff33ff",
      "--ansi-cyan": "#33ffff",
      "--ansi-white": "#ffffff",
      "--ansi-bright-black": "#666666",
      "--ansi-bright-red": "#ff6666",
      "--ansi-bright-green": "#66ff66",
      "--ansi-bright-yellow": "#ffff66",
      "--ansi-bright-blue": "#66aaff",
      "--ansi-bright-magenta": "#ff66ff",
      "--ansi-bright-cyan": "#66ffff",
      "--ansi-bright-white": "#ffffff",
      "--cmd-bg": "#000000",
      "--cmd-input-bg": "#111111",
      "--cmd-border": "#ffffff"
    }
  },
  {
    id: "eye-care",
    name: "护眼模式",
    description: "低蓝光暖色调配色，保护视力",
    preset: true,
    vars: {
      "--bg": "#1e1e1a",
      "--home-bg": "#1a1a16",
      "--fg": "#d4c5a9",
      "--link": "#a8c97e",
      "--link-hover-bg": "#2a3320",
      "--link-hover": "#c4e0a0",
      "--ansi-black": "#1e1e1a",
      "--ansi-red": "#d4847a",
      "--ansi-green": "#8aaa6e",
      "--ansi-yellow": "#c4a856",
      "--ansi-blue": "#6a8cb8",
      "--ansi-magenta": "#a08aba",
      "--ansi-cyan": "#6aacaa",
      "--ansi-white": "#c0b89a",
      "--ansi-bright-black": "#5a5444",
      "--ansi-bright-red": "#e8a098",
      "--ansi-bright-green": "#a0c088",
      "--ansi-bright-yellow": "#dcc878",
      "--ansi-bright-blue": "#8aa8d0",
      "--ansi-bright-magenta": "#c0a8d8",
      "--ansi-bright-cyan": "#88c8c6",
      "--ansi-bright-white": "#e0d8c0",
      "--cmd-bg": "#1a1a16",
      "--cmd-input-bg": "#1e1e1a",
      "--cmd-border": "#5a5444"
    }
  }
];

// ── 主题管理 ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "blog-theme";
const CUSTOM_KEY = "blog-custom-themes";

/** 获取当前主题 */
export function getCurrentTheme(): ThemeConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const found = PRESET_THEMES.find((t) => t.id === parsed.id);
      if (found) return found;
      // 自定义主题
      return parsed as ThemeConfig;
    } catch {
      // 回退
    }
  }
  return PRESET_THEMES[0];
}

/** 应用主题 */
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: theme.id, preset: theme.preset }));
}

/** 重置为默认主题 */
export function resetTheme(): void {
  localStorage.removeItem(STORAGE_KEY);
  applyTheme(PRESET_THEMES[0]);
}

/** 获取所有预设主题 */
export function getPresetThemes(): ThemeConfig[] {
  return PRESET_THEMES;
}

/** 获取自定义主题列表 */
export function getCustomThemes(): ThemeConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

/** 保存自定义主题 */
export function saveCustomTheme(theme: ThemeConfig): void {
  const themes = getCustomThemes().filter((t) => t.id !== theme.id);
  themes.push({ ...theme, preset: false });
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(themes));
}

/** 删除自定义主题 */
export function deleteCustomTheme(id: string): boolean {
  const themes = getCustomThemes();
  const filtered = themes.filter((t) => t.id !== id);
  if (filtered.length === themes.length) return false;
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(filtered));
  return true;
}

/** 导出主题为 JSON 字符串 */
export function exportTheme(id: string): string | null {
  const preset = PRESET_THEMES.find((t) => t.id === id);
  if (preset) return JSON.stringify(preset, null, 2);
  const custom = getCustomThemes().find((t) => t.id === id);
  if (custom) return JSON.stringify(custom, null, 2);
  return null;
}

/** 导入主题 */
export function importTheme(json: string): CommandResult {
  try {
    const theme = JSON.parse(json) as ThemeConfig;
    if (!theme.id || !theme.name || !theme.vars) {
      return { success: false, message: "theme: 无效的主题配置格式" };
    }
    // 检查是否与预设主题冲突
    if (PRESET_THEMES.some((t) => t.id === theme.id)) {
      return { success: false, message: `theme: 主题 ID "${theme.id}" 与预设主题冲突` };
    }
    saveCustomTheme({ ...theme, preset: false });
    return { success: true, message: `主题已导入: ${theme.name}` };
  } catch {
    return { success: false, message: "theme: JSON 解析失败" };
  }
}

/** 创建主题预览 HTML */
export function createThemePreview(theme: ThemeConfig): string {
  const sampleText = "The quick brown fox jumps over the lazy dog.";
  const sampleCJK = "敏捷的棕色狐狸跳过了懒狗。";
  const colors = ["--ansi-red", "--ansi-green", "--ansi-yellow", "--ansi-blue", "--ansi-magenta", "--ansi-cyan"];

  const colorSwatches = colors
    .map((c) => {
      const val = theme.vars[c] ?? "#000";
      return `<span style="display:inline-block;width:24px;height:24px;background:${val};margin:2px;border:1px solid ${theme.vars["--ansi-bright-black"]}" title="${c}"></span>`;
    })
    .join("");

  return `
    <div style="background:${theme.vars["--bg"]};color:${theme.vars["--fg"]};padding:16px;font-family:monospace;border-radius:4px;min-width:280px;">
      <div style="font-size:16px;font-weight:bold;margin-bottom:8px;color:${theme.vars["--link"]};">${theme.name}</div>
      <div style="font-size:12px;color:${theme.vars["--ansi-bright-black"]};margin-bottom:8px;">${theme.description}</div>
      <div style="margin-bottom:8px;">${colorSwatches}</div>
      <div style="font-size:13px;margin-bottom:4px;">${sampleText}</div>
      <div style="font-size:13px;margin-bottom:4px;color:${theme.vars["--link"]};">${sampleCJK}</div>
      <div style="font-size:12px;margin-top:8px;">
        <span style="color:${theme.vars["--ansi-red"]};">error</span>
        <span style="color:${theme.vars["--ansi-green"]};margin:0 4px;">success</span>
        <span style="color:${theme.vars["--ansi-yellow"]};">warning</span>
      </div>
      <div style="font-size:11px;border:1px solid ${theme.vars["--cmd-border"]};padding:4px;margin-top:8px;background:${theme.vars["--cmd-bg"]};">
        <span style="color:${theme.vars["--link"]};">:</span>command input
      </div>
    </div>
  `;
}

// ── 命令处理器 ────────────────────────────────────────────────────────────

/** theme 命令处理器 */
export function themeCommandHandler(args: string[]): CommandResult {
  // 无参数：列出所有主题
  if (args.length === 0) {
    const current = getCurrentTheme();
    const presets = getPresetThemes();
    const customs = getCustomThemes();
    const all = [...presets, ...customs];

    const maxLen = Math.max(...all.map((t) => t.name.length), 8);
    const lines = [
      `\u250c${"\u2500".repeat(50)}\u2510`,
      `\u2502 ${"THEME SELECTOR".padEnd(48)} \u2502`,
      `\u2502 ${`当前: ${current.name}`.padEnd(48)} \u2502`,
      `\u2502${" ".repeat(48)}\u2502`,
      `\u2502 ${"── 预设主题 ──".padEnd(48)} \u2502`,
      ...presets.map(
        (t, i) =>
          `\u2502 ${`${t.id === current.id ? "*" : " "} ${String(i + 1)}. ${t.name.padEnd(maxLen + 2)} ${t.description}`.padEnd(48)} \u2502`
      )
    ];

    if (customs.length > 0) {
      lines.push(`\u2502${" ".repeat(48)}\u2502`);
      lines.push(`\u2502 ${"── 自定义主题 ──".padEnd(48)} \u2502`);
      for (const t of customs) {
        lines.push(
          `\u2502 ${`${t.id === current.id ? "*" : " "} ${t.name.padEnd(maxLen + 2)} ${t.description}`.padEnd(48)} \u2502`
        );
      }
    }

    lines.push(`\u2502${" ".repeat(48)}\u2502`);
    lines.push(`\u2502 ${":theme <名称|序号> 切换主题".padEnd(48)} \u2502`);
    lines.push(`\u2502 ${":theme preview <名称> 预览".padEnd(48)} \u2502`);
    lines.push(`\u2502 ${":theme custom 自定义配置".padEnd(48)} \u2502`);
    lines.push(`\u2502 ${":theme export <名称> 导出".padEnd(48)} \u2502`);
    lines.push(`\u2502 ${":theme import <JSON> 导入".padEnd(48)} \u2502`);
    lines.push(`\u2514${"\u2500".repeat(50)}\u2518`);

    return { success: true, message: lines.join("\n") };
  }

  const subCmd = args[0].toLowerCase();

  // 预览主题
  if (subCmd === "preview" && args[1]) {
    const name = args.slice(1).join(" ");
    const theme = findThemeByName(name);
    if (!theme) {
      return { success: false, message: `theme: 主题不存在: ${name}` };
    }
    const preview = createThemePreview(theme);
    return { success: true, message: preview, html: true };
  }

  // 导出主题
  if (subCmd === "export" && args[1]) {
    const name = args.slice(1).join(" ");
    const theme = findThemeByName(name);
    if (!theme) {
      return { success: false, message: `theme: 主题不存在: ${name}` };
    }
    const json = exportTheme(theme.id);
    if (!json) {
      return { success: false, message: "theme: 导出失败" };
    }
    navigator.clipboard.writeText(json).catch(() => {});
    return { success: true, message: `主题 "${theme.name}" 已导出并复制到剪贴板\n\n${json.slice(0, 200)}...` };
  }

  // 导入主题
  if (subCmd === "import") {
    const json = args.slice(1).join(" ");
    if (!json) {
      return { success: false, message: "theme: 请提供主题 JSON\n用法: :theme import <JSON>" };
    }
    return importTheme(json);
  }

  // 自定义主题配置
  if (subCmd === "custom") {
    return openCustomThemePanel();
  }

  // 切换主题：支持序号或名称
  const name = args.join(" ");
  const theme = findThemeByName(name);

  if (!theme) {
    return { success: false, message: `theme: 主题不存在: ${name}\n使用 :theme 查看所有可用主题` };
  }

  applyTheme(theme);
  return { success: true, message: `主题已切换: ${theme.name}` };
}

/** 通过名称或序号查找主题 */
function findThemeByName(name: string): ThemeConfig | undefined {
  const presets = getPresetThemes();
  const customs = getCustomThemes();
  const all = [...presets, ...customs];

  // 尝试按序号匹配（1-based）
  const num = Number.parseInt(name, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= presets.length) {
    return presets[num - 1];
  }

  // 按名称或 ID 匹配
  return all.find((t) => t.name === name || t.id === name);
}

/** 自定义主题配置面板 */
function openCustomThemePanel(): CommandResult {
  const current = getCurrentTheme();
  const vars = { ...current.vars };

  const varNames: { key: string; label: string }[] = [
    { key: "--bg", label: "背景色" },
    { key: "--fg", label: "文本色" },
    { key: "--link", label: "链接色" },
    { key: "--link-hover", label: "链接悬停色" },
    { key: "--link-hover-bg", label: "链接悬停背景" },
    { key: "--ansi-red", label: "ANSI 红" },
    { key: "--ansi-green", label: "ANSI 绿" },
    { key: "--ansi-yellow", label: "ANSI 黄" },
    { key: "--ansi-blue", label: "ANSI 蓝" },
    { key: "--ansi-magenta", label: "ANSI 紫" },
    { key: "--ansi-cyan", label: "ANSI 青" },
    { key: "--cmd-bg", label: "命令面板背景" },
    { key: "--cmd-border", label: "命令面板边框" }
  ];

  // 创建自定义面板 DOM
  const existing = document.getElementById("theme-custom-panel");
  if (existing) {
    existing.remove();
    return { success: true, message: "自定义面板已关闭" };
  }

  const panel = document.createElement("div");
  panel.id = "theme-custom-panel";
  panel.className = "theme-custom-panel";
  panel.innerHTML = `
    <div class="theme-custom-header">
      <span>自定义主题配置</span>
      <button class="theme-custom-close" title="关闭">&times;</button>
    </div>
    <div class="theme-custom-body">
      ${varNames
        .map(
          (v) => `
        <div class="theme-custom-row">
          <label>${v.label}</label>
          <input type="color" value="${vars[v.key] ?? "#000000"}" data-var="${v.key}" />
          <input type="text" value="${vars[v.key] ?? ""}" data-var="${v.key}" class="theme-custom-text" />
        </div>`
        )
        .join("")}
    </div>
    <div class="theme-custom-footer">
      <input type="text" id="theme-custom-name" placeholder="主题名称" value="${current.preset ? "" : current.name}" />
      <button id="theme-custom-save">保存自定义主题</button>
      <button id="theme-custom-cancel">取消</button>
    </div>
  `;

  document.body.appendChild(panel);

  // 事件绑定
  panel.querySelector(".theme-custom-close")?.addEventListener("click", () => panel.remove());
  panel.querySelector("#theme-custom-cancel")?.addEventListener("click", () => panel.remove());

  // 颜色选择器同步到文本输入
  panel.querySelectorAll('input[type="color"]').forEach((el) => {
    el.addEventListener("input", () => {
      const textInput = panel.querySelector(
        `input[type="text"][data-var="${el.getAttribute("data-var")}"]`
      ) as HTMLInputElement;
      if (textInput) textInput.value = (el as HTMLInputElement).value;
    });
  });

  // 保存
  panel.querySelector("#theme-custom-save")?.addEventListener("click", () => {
    const nameInput = panel.querySelector("#theme-custom-name") as HTMLInputElement;
    const name = nameInput?.value?.trim();
    if (!name) {
      alert("请输入主题名称");
      return;
    }

    const customVars: Record<string, string> = {};
    panel.querySelectorAll("[data-var]").forEach((el) => {
      const key = el.getAttribute("data-var");
      if (key && el.tagName === "INPUT" && (el as HTMLInputElement).type === "text") {
        customVars[key] = (el as HTMLInputElement).value;
      }
    });

    const newTheme: ThemeConfig = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      description: "自定义主题",
      preset: false,
      vars: { ...current.vars, ...customVars }
    };

    saveCustomTheme(newTheme);
    applyTheme(newTheme);
    panel.remove();

    const output = document.getElementById("cmd-output");
    if (output) {
      const line = document.createElement("div");
      line.className = "cmd-output-line cmd-output-ok";
      line.textContent = `自定义主题已保存并应用: ${name}`;
      output.appendChild(line);
    }
  });

  return { success: true, message: "自定义主题面板已打开", close: false };
}

// ── 初始化 ────────────────────────────────────────────────────────────────

/** 在页面加载时应用已保存的主题 */
export function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const { id } = JSON.parse(stored);
      const preset = PRESET_THEMES.find((t) => t.id === id);
      if (preset) {
        applyTheme(preset);
        return;
      }
      const custom = getCustomThemes().find((t) => t.id === id);
      if (custom) {
        applyTheme(custom);
        return;
      }
    } catch {
      // ignore
    }
  }
  // 默认主题
  applyTheme(PRESET_THEMES[0]);
}
