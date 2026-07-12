import { catCommand, cdCommand, getPathCompletions, lsCommand } from "./commands/nav";
import { clearSearch, executeSearch } from "./commands/search";
import { themeCommandHandler } from "./commands/themes";
import { getScrollConfig, setScrollConfig } from "./scroll-config";
import type { CommandContext, CommandDef, CommandResult } from "./types";

/** 命令注册表 */
const commands = new Map<string, CommandDef>();

/** 别名注册表 */
const aliases = new Map<string, string>();

/** 命令使用频率统计 */
const usageFrequency = new Map<string, number>();

/** 注册一个命令 */
export function registerCommand(def: CommandDef): void {
  commands.set(def.name, def);
  if (def.aliases) {
    for (const alias of def.aliases) {
      commands.set(alias, { ...def, name: alias });
    }
  }
}

/** 注销一个命令 */
export function unregisterCommand(name: string): void {
  const def = commands.get(name);
  if (!def) return;
  commands.delete(name);
  if (def.aliases) {
    for (const alias of def.aliases) {
      commands.delete(alias);
    }
  }
}

/** 获取所有已注册命令 */
export function getCommands(): CommandDef[] {
  return [...new Map([...commands.entries()].map(([, v]) => [v.name, v])).values()];
}

/** 查找命令 */
export function findCommand(name: string): CommandDef | undefined {
  return commands.get(name);
}

/** 记录命令使用频率 */
export function recordUsage(name: string): void {
  const count = usageFrequency.get(name) ?? 0;
  usageFrequency.set(name, count + 1);
  // 持久化
  try {
    localStorage.setItem("cmd-freq", JSON.stringify([...usageFrequency.entries()]));
  } catch {
    // ignore
  }
}

/** 获取补全候选项（按使用频率排序） */
export function getCompletions(prefix: string): { text: string; description: string }[] {
  const lower = prefix.toLowerCase();
  const matched = getCommands()
    .filter((cmd) => cmd.name.toLowerCase().startsWith(lower))
    .map((cmd) => ({ text: cmd.name, description: cmd.description }));

  // 按使用频率降序排序
  matched.sort((a, b) => {
    const freqA = usageFrequency.get(a.text) ?? 0;
    const freqB = usageFrequency.get(b.text) ?? 0;
    return freqB - freqA;
  });

  return matched;
}

/** 获取路径补全 */
export { getPathCompletions };

// ── 别名管理 ────────────────────────────────────────────────────────────

/** 设置别名 */
export function setAlias(name: string, expansion: string): void {
  aliases.set(name, expansion);
  saveAliases();
}

/** 删除别名 */
export function deleteAlias(name: string): boolean {
  const result = aliases.delete(name);
  saveAliases();
  return result;
}

/** 获取所有别名 */
export function getAliases(): { name: string; expansion: string }[] {
  return [...aliases.entries()].map(([name, expansion]) => ({ name, expansion }));
}

/** 解析别名 */
export function resolveAlias(name: string): string | undefined {
  return aliases.get(name);
}

function saveAliases(): void {
  try {
    localStorage.setItem("cmd-aliases", JSON.stringify([...aliases.entries()]));
  } catch {
    // 静默忽略
  }
}

function loadAliases(): void {
  try {
    const raw = localStorage.getItem("cmd-aliases");
    if (raw) {
      for (const [k, v] of JSON.parse(raw)) {
        aliases.set(k, v);
      }
    }
  } catch {
    // 静默忽略
  }
}

function loadFrequency(): void {
  try {
    const raw = localStorage.getItem("cmd-freq");
    if (raw) {
      for (const [k, v] of JSON.parse(raw)) {
        usageFrequency.set(k, v);
      }
    }
  } catch {
    // ignore
  }
}

// ── 内置命令 ────────────────────────────────────────────────────────────

const CRYPTIC_QUOTES = [
  "The command line is a doorway; the prompt is the key.",
  "Every command is a question. Every output is an answer.",
  "In the terminal, we are all root.",
  "Type with intent. The machine is always listening.",
  "A well-crafted command is indistinguishable from magic.",
  "The shell remembers what the user forgets.",
  "Silence is the most honest error message.",
  "Your prompt is a mirror. It reflects only what you ask.",
  "There is no undo in the real world. But there is Ctrl+C.",
  "The best interface is the one you never see.",
  "Commands are spells. The terminal is a grimoire.",
  "Every bug is a feature waiting to be discovered.",
  "The cursor blinks patiently. It has all the time in the world.",
  "Syntax is the art of making machines understand poetry."
];

// ── CRT 风格效果 ──────────────────────────────────────────────────────────

const CRT_STYLES = [
  { id: "", name: "无效果", desc: "关闭所有视觉效果" },
  { id: "crt-scanlines", name: "扫描线", desc: "经典 CRT 扫描线效果" },
  { id: "crt-display", name: "CRT 显示", desc: "模拟 CRT 显示器效果" },
  { id: "crt-interlace", name: "隔行扫描", desc: "隔行扫描线效果" },
  { id: "crt-static", name: "雪花噪点", desc: "模拟信号干扰噪点" },
  { id: "crt-desaturate", name: "色彩失真", desc: "降低色彩饱和度" },
  { id: "crt-curvature", name: "屏幕曲率", desc: "CRT 屏幕曲面效果" }
];

function getCrtStyle(): string {
  return localStorage.getItem("crt-effect") ?? "";
}

function setCrtStyle(effectId: string): void {
  localStorage.setItem("crt-effect", effectId);
  applyCrtStyle(effectId);
}

function applyCrtStyle(effectId: string): void {
  const body = document.body;
  for (const { id } of CRT_STYLES) {
    if (id) body.classList.remove(id);
  }
  // 视觉效果由 body::after 伪元素通过 CSS 选择器自动渲染，无需手动操作 DOM 节点
  if (effectId) {
    body.classList.add(effectId);
  }
}

function randomQuote(): string {
  return CRYPTIC_QUOTES[Math.floor(Math.random() * CRYPTIC_QUOTES.length)];
}

// ── 详细帮助文本 ─────────────────────────────────────────────────────────

const DETAILED_HELP: Record<string, string> = {
  help: [
    "help - 显示可用命令列表",
    "用法: :help [命令名]",
    "参数:",
    "  命令名  可选，显示指定命令的详细帮助",
    "示例:",
    "  :help       显示所有命令",
    "  :help cd    显示 cd 命令帮助",
    "  :help all   显示所有命令详细索引"
  ].join("\n"),
  cd: [
    "cd - 切换当前工作目录",
    "用法: :cd <路径>",
    "参数:",
    "  路径  目标路径，支持相对路径和绝对路径",
    "  ..    返回上级目录",
    "  /     返回根目录（首页）",
    "  ~     返回首页",
    "示例:",
    "  :cd /volume/0      进入 volume 0",
    "  :cd ..             返回上级",
    "  :cd /              返回首页",
    "  :cd ~/volume/0     从根目录开始导航",
    "注意:",
    "  路径不存在时会提示错误"
  ].join("\n"),
  ls: [
    "ls - 列出目录内容",
    "用法: :ls [路径] [选项]",
    "参数:",
    "  路径    目标路径，默认当前目录",
    "选项:",
    "  -l      详细列表（权限、大小、修改时间）",
    "  -T      树状结构显示（递归）",
    "  -t      按修改时间排序",
    "  -S      按文件大小排序",
    "  -r      反向排序",
    "  -lt     详细列表 + 按时间排序",
    "  -lS     详细列表 + 按大小排序",
    "示例:",
    "  :ls              列出当前目录",
    "  :ls /volume/1    列出 volume 1 的内容",
    "  :ls -l           详细列表",
    "  :ls -T           树状结构",
    "  :ls -lt          详细列表按时间排序",
    "  :ls -lSr         详细列表按大小反向排序"
  ].join("\n"),
  cat: [
    "cat - 查看文件内容（打开页面）",
    "用法: :cat <路径>",
    "参数:",
    "  路径  目标文件路径",
    "示例:",
    "  :cat /volume/0/test    打开测试文章",
    "  :cat ../another        相对路径打开",
    "注意:",
    "  不能打开目录，会提示错误",
    "  打开页面后可使用 hjkl 导航"
  ].join("\n"),
  theme: [
    "theme - 主题切换与配置",
    "用法: :theme [子命令]",
    "子命令:",
    "  (无参数)          列出所有可用主题",
    "  <名称>            切换到指定主题",
    "  preview <名称>    预览主题效果",
    "  custom            打开自定义主题配置面板",
    "  export <名称>     导出主题配置（复制到剪贴板）",
    "  import <JSON>     导入主题配置",
    "预设主题:",
    "  默认主题 - 经典暗色终端风格",
    "  深色主题 - 深色背景 + 浅色文字",
    "  浅色主题 - 浅色背景 + 深色文字",
    "  高对比度主题 - 极致对比度",
    "  护眼模式 - 低蓝光暖色调",
    "示例:",
    "  :theme              列出所有主题",
    "  :theme 护眼模式       切换到护眼模式",
    "  :theme preview 深色主题 预览深色主题",
    "  :theme custom        打开自定义面板"
  ].join("\n"),
  home: ["home - 返回首页", "用法: :home", "无参数，直接返回博客首页"].join("\n"),
  back: ["back - 返回上一页", "用法: :back", "无参数，返回浏览器历史记录中的上一页（仅限本站）"].join("\n"),
  top: ["top - 滚动到页面顶部", "用法: :top", "无参数，平滑滚动到页面顶部"].join("\n"),
  reload: ["reload - 刷新页面", "用法: :reload", "无参数，刷新当前页面"].join("\n"),
  quote: ["quote - 显示随机语录", "用法: :quote", "无参数，显示一条随机技术语录"].join("\n"),
  clear: ["clear - 清除命令输出", "用法: :clear", "无参数，清除命令面板中的所有输出内容"].join("\n"),
  alias: [
    "alias - 管理命令别名",
    "用法: :alias [名称] [展开]",
    "参数:",
    "  无参数    列出所有别名",
    "  名称=展开  设置别名",
    "  -d 名称   删除别名",
    "  -c        清除所有别名",
    "示例:",
    "  :alias                 列出所有别名",
    "  :alias ll=ls -l        设置 ll 别名",
    "  :alias -d ll           删除 ll 别名",
    "  :alias -c              清除所有别名"
  ].join("\n"),
  history: [
    "history - 命令历史记录",
    "用法: :history [选项]",
    "参数:",
    "  (无参数)  列出所有历史记录",
    "  -c        清除所有历史记录",
    "  -d N      删除第 N 条历史记录",
    "快捷键:",
    "  ↑/↓      在命令输入框中翻阅历史命令",
    "示例:",
    "  :history      列出所有历史",
    "  :history -c   清除所有历史",
    "  :history -d 3 删除第 3 条"
  ].join("\n"),
  about: [
    "about - 关于本命令系统",
    "用法: :about",
    "无参数，显示命令系统简介",
    "功能:",
    "  - Linux 风格命令交互",
    "  - 目录导航 (cd/ls/cat)",
    "  - 主题切换 (5 种预设 + 自定义)",
    "  - 命令别名 (alias)",
    "  - 历史记录 (history)",
    "  - Tab 补全 (命令/路径/文件名)",
    "  - hjkl 导航 + 页面内搜索"
  ].join("\n"),
  search: [
    "搜索 - 页面内文本搜索",
    "用法: /关键词",
    "导航:",
    "  Enter  继续查找下一个",
    "  n       查找下一个（无需打开搜索面板）",
    "  N       查找上一个（反向）",
    "  Esc     关闭搜索",
    "示例:",
    "  /hello    搜索页面中的 'hello'"
  ].join("\n"),
  nav: [
    "hjkl 导航 - Vim 风格页面滚动",
    "用法: 在页面中直接按键",
    "  j   向下滚动（3行）",
    "  k   向上滚动（3行）",
    "  h   向左滚动",
    "  l   向右滚动",
    "  空格  向下翻页",
    "  PageUp/PageDown  翻页",
    "配置: 使用 :scroll 命令调整步长"
  ].join("\n"),
  scroll: [
    "scroll - 配置 hjkl 滚动步长",
    "用法: :scroll [垂直行数] [水平字符数]",
    "示例:",
    "  :scroll 5 10  设置垂直 5 行，水平 10 字符",
    "  :scroll 3      设置垂直 3 行，水平保持默认"
  ].join("\n"),
  style: [
    "style - 切换页面视觉效果（CRT 风格）",
    "用法: :style [名称|序号]",
    "参数:",
    "  (无参数)  列出所有可用风格",
    "  <名称>    切换到指定风格",
    "  off       关闭所有风格效果",
    "可用风格:",
    "  1. 无效果 - 关闭所有视觉效果",
    "  2. 扫描线 - 经典 CRT 扫描线效果",
    "  3. CRT 显示 - 模拟 CRT 显示器效果",
    "  4. 隔行扫描 - 隔行扫描线效果",
    "  5. 雪花噪点 - 模拟信号干扰噪点",
    "  6. 色彩失真 - 降低色彩饱和度",
    "  7. 屏幕曲率 - CRT 屏幕曲面效果",
    "示例:",
    "  :style           列出所有风格",
    "  :style 扫描线     切换到扫描线效果",
    "  :style 2         切换到第 2 个风格",
    "  :style off       关闭所有效果"
  ].join("\n")
};

// ── 内置命令定义 ────────────────────────────────────────────────────────

const helpCommand: CommandDef = {
  name: "help",
  aliases: ["h", "?"],
  description: "显示可用命令列表",
  usage: ":help [命令名]",
  handler: (args): CommandResult => {
    // help all: 显示所有命令详细索引
    if (args.length === 1 && args[0].toLowerCase() === "all") {
      const names = Object.keys(DETAILED_HELP);
      const lines = [
        `\u250c${"\u2500".repeat(50)}\u2510`,
        `\u2502 ${"COMMAND INDEX".padEnd(48)} \u2502`,
        `\u2502${" ".repeat(48)}\u2502`,
        ...names.map(
          (n) =>
            `\u2502 ${`  :help ${n.padEnd(12)} — ${(DETAILED_HELP[n]?.split("\n")[0] ?? "").replace(`${n} - `, "")}`.padEnd(48)} \u2502`
        ),
        `\u2514${"\u2500".repeat(50)}\u2518`
      ];
      return { success: true, message: lines.join("\n") };
    }

    // 查看特定命令的详细帮助
    if (args.length > 0) {
      const cmdName = args[0].toLowerCase();
      const detail = DETAILED_HELP[cmdName];
      if (detail) {
        const lines = [
          `\u250c${"\u2500".repeat(62)}\u2510`,
          ...detail.split("\n").map((l) => `\u2502 ${l.padEnd(60)} \u2502`),
          `\u2514${"\u2500".repeat(62)}\u2518`
        ];
        return { success: true, message: lines.join("\n") };
      }
      return { success: false, message: `未知命令: ${cmdName}. 输入 :help 查看所有命令` };
    }

    const cmds = getCommands();
    const maxLen = Math.max(...cmds.map((c) => c.name.length), 8);
    const lines = [
      `\u250c${"\u2500".repeat(48)}\u2510`,
      `\u2502 ${"COMMANDS".padEnd(46)} \u2502`,
      `\u2502${" ".repeat(48)}\u2502`,
      ...cmds.map((c) => `\u2502 ${`${c.name.padEnd(maxLen)}  ${c.description}`.padEnd(46)} \u2502`),
      `\u2502${" ".repeat(48)}\u2502`,
      `\u2502 ${`:help <cmd> for details`.padEnd(46)} \u2502`,
      `\u2502 ${`:help all for index`.padEnd(46)} \u2502`,
      `\u2502 ${`hjkl=scroll  n/N=search  SPACE=page`.padEnd(46)} \u2502`,
      `\u2514${"\u2500".repeat(48)}\u2518`
    ];
    return { success: true, message: lines.join("\n") };
  }
};

const cdCmd: CommandDef = {
  name: "cd",
  aliases: [],
  description: "切换目录（导航页面）",
  usage: ":cd <路径>",
  handler: (_args, _ctx) => cdCommand(_args)
};

const lsCmd: CommandDef = {
  name: "ls",
  aliases: ["dir"],
  description: "列出目录内容 (-l 详细, -T 树状, -t 时间, -S 大小)",
  usage: ":ls [路径] [-l] [-T] [-t] [-S] [-r]",
  handler: (args, _ctx) => lsCommand(args)
};

const catCmd: CommandDef = {
  name: "cat",
  aliases: ["view"],
  description: "查看文件内容（打开页面）",
  usage: ":cat <路径>",
  handler: (args, _ctx) => catCommand(args)
};

const themeCommand: CommandDef = {
  name: "theme",
  aliases: ["t"],
  description: "切换主题 (5 种预设 + 自定义)",
  usage: ":theme [名称] | preview <名称> | custom | export | import",
  handler: (args) => themeCommandHandler(args)
};

const homeCommand: CommandDef = {
  name: "home",
  aliases: [],
  description: "返回首页",
  handler: (): CommandResult => {
    if (window.location.pathname === "/") {
      return { success: true, message: "已在首页" };
    }
    window.location.href = "/";
    return { success: true, message: "正在返回首页..." };
  }
};

const backCommand: CommandDef = {
  name: "back",
  aliases: ["b"],
  description: "返回上一页",
  handler: (): CommandResult => {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
      window.history.back();
      return { success: true, message: "返回上一页" };
    }
    window.location.href = "/";
    return { success: true, message: "返回首页" };
  }
};

const topCommand: CommandDef = {
  name: "top",
  aliases: [],
  description: "滚动到页面顶部",
  handler: (): CommandResult => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return { success: true, message: "已滚动到顶部" };
  }
};

const scrollCommand: CommandDef = {
  name: "scroll",
  aliases: [],
  description: "配置 hjkl 滚动步长",
  usage: ":scroll [垂直行数] [水平字符数]",
  handler: (args): CommandResult => {
    if (args.length === 0) {
      const cfg = getScrollConfig();
      return {
        success: true,
        message: `当前滚动配置: 垂直 ${cfg.vertical} 行, 水平 ${cfg.horizontal} 字符\n用法: :scroll <垂直行数> [水平字符数]`
      };
    }
    const v = Number.parseInt(args[0], 10);
    const h = args.length > 1 ? Number.parseInt(args[1], 10) : getScrollConfig().horizontal;
    if (Number.isNaN(v) || v < 1 || Number.isNaN(h) || h < 1) {
      return { success: false, message: "参数必须为正整数" };
    }
    setScrollConfig(v, h);
    return { success: true, message: `滚动步长已更新: 垂直 ${v} 行, 水平 ${h} 字符` };
  }
};

const styleCommand: CommandDef = {
  name: "style",
  aliases: [],
  description: "切换页面 CRT 视觉效果",
  usage: ":style [名称|序号|off]",
  handler: (args): CommandResult => {
    // 无参数：列出所有风格
    if (args.length === 0) {
      const current = getCrtStyle();
      const currentName = CRT_STYLES.find((e) => e.id === current)?.name ?? "无效果";
      const maxLen = Math.max(...CRT_STYLES.map((e) => e.name.length), 8);
      const lines = [
        `\u250c${"\u2500".repeat(48)}\u2510`,
        `\u2502 ${"STYLE SELECTOR".padEnd(46)} \u2502`,
        `\u2502 ${`当前: ${currentName}`.padEnd(46)} \u2502`,
        `\u2502${" ".repeat(48)}\u2502`,
        ...CRT_STYLES.map(
          (e, i) =>
            `\u2502 ${`${e.id === current ? "*" : " "} ${String(i + 1)}. ${e.name.padEnd(maxLen + 2)} ${e.desc}`.padEnd(46)} \u2502`
        ),
        `\u2502${" ".repeat(48)}\u2502`,
        `\u2502 ${`:style <名称|序号|off> 切换`.padEnd(46)} \u2502`,
        `\u2514${"\u2500".repeat(48)}\u2518`
      ];
      return { success: true, message: lines.join("\n") };
    }

    const name = args.join(" ");

    // off 关闭所有效果
    if (name.toLowerCase() === "off") {
      setCrtStyle("");
      return { success: true, message: "风格已关闭: 无效果" };
    }

    // 尝试按序号匹配
    const num = Number.parseInt(name, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= CRT_STYLES.length) {
      const style = CRT_STYLES[num - 1];
      setCrtStyle(style.id);
      return { success: true, message: `风格已切换: ${style.name}` };
    }

    // 按名称或 ID 匹配
    const style = CRT_STYLES.find((e) => e.name === name || e.id === name);
    if (!style) {
      return {
        success: false,
        message: `style: 未知风格: ${name}\n可用: ${CRT_STYLES.map((e) => e.name).join(", ")}`
      };
    }

    setCrtStyle(style.id);
    return { success: true, message: `风格已切换: ${style.name}` };
  }
};

const reloadCommand: CommandDef = {
  name: "reload",
  aliases: ["r"],
  description: "刷新页面",
  handler: (): CommandResult => {
    window.location.reload();
    return { success: true, message: "正在刷新..." };
  }
};

const aboutCommand: CommandDef = {
  name: "about",
  aliases: [],
  description: "关于本命令系统",
  handler: (): CommandResult => {
    const lines = [
      `\u250c${"\u2500".repeat(44)}\u2510`,
      `\u2502 ${"AH'S BLOG COMMAND SYSTEM".padEnd(42)} \u2502`,
      `\u2502${" ".repeat(42)}\u2502`,
      `\u2502 ${"Vim-like command mode for".padEnd(42)} \u2502`,
      `\u2502 ${"navigating this retro textmode blog.".padEnd(42)} \u2502`,
      `\u2502${" ".repeat(42)}\u2502`,
      `\u2502 ${"Commands: cd ls cat theme alias".padEnd(42)} \u2502`,
      `\u2502 ${"Navigation: hjkl SPACE PageUp/Down".padEnd(42)} \u2502`,
      `\u2502 ${"Search: / n N".padEnd(42)} \u2502`,
      `\u2502 ${"Press : to enter command mode".padEnd(42)} \u2502`,
      `\u2502 ${"Type :help for commands".padEnd(42)} \u2502`,
      `\u2514${"\u2500".repeat(44)}\u2518`
    ];
    return { success: true, message: lines.join("\n") };
  }
};

const quoteCommand: CommandDef = {
  name: "quote",
  aliases: ["q"],
  description: "显示一条随机语录",
  handler: (): CommandResult => {
    return {
      success: true,
      message: `"${randomQuote()}"`
    };
  }
};

const clearCommand: CommandDef = {
  name: "clear",
  aliases: ["cls"],
  description: "清除命令输出",
  handler: (): CommandResult => {
    const output = document.getElementById("cmd-output");
    if (output) output.innerHTML = "";
    return { success: true };
  }
};

const aliasCommand: CommandDef = {
  name: "alias",
  aliases: [],
  description: "管理命令别名",
  usage: ":alias [名称=展开] 或 :alias -d 名称",
  handler: (args): CommandResult => {
    // 列出所有别名
    if (args.length === 0) {
      const all = getAliases();
      if (all.length === 0) {
        return { success: true, message: "暂无别名\n使用 :alias name=expansion 创建" };
      }
      const maxLen = Math.max(...all.map((a) => a.name.length), 8);
      const lines = [
        `\u250c${"\u2500".repeat(40)}\u2510`,
        `\u2502 ${"ALIASES".padEnd(38)} \u2502`,
        `\u2502${" ".repeat(38)}\u2502`,
        ...all.map((a) => `\u2502 ${`${a.name.padEnd(maxLen)}  = ${a.expansion}`.padEnd(38)} \u2502`),
        `\u2502${" ".repeat(38)}\u2502`,
        `\u2502 ${":alias -d <name> 删除".padEnd(38)} \u2502`,
        `\u2502 ${":alias -c 清除全部".padEnd(38)} \u2502`,
        `\u2514${"\u2500".repeat(40)}\u2518`
      ];
      return { success: true, message: lines.join("\n") };
    }

    // 清除所有别名
    if (args[0] === "-c") {
      const count = getAliases().length;
      for (const { name } of getAliases()) {
        deleteAlias(name);
      }
      return { success: true, message: `已清除 ${count} 个别名` };
    }

    // 删除别名
    if (args[0] === "-d" && args[1]) {
      if (deleteAlias(args[1])) {
        return { success: true, message: `别名已删除: ${args[1]}` };
      }
      return { success: false, message: `别名不存在: ${args[1]}` };
    }

    // 设置别名
    const eqIndex = args[0].indexOf("=");
    if (eqIndex > 0) {
      const name = args[0].slice(0, eqIndex);
      const expansion = args[0].slice(eqIndex + 1) || args.slice(1).join(" ");
      if (!name || !expansion) {
        return { success: false, message: "用法: :alias name=expansion" };
      }
      setAlias(name, expansion);
      return { success: true, message: `别名已设置: ${name} = ${expansion}` };
    }

    return { success: false, message: "用法: :alias name=expansion 或 :alias -d name" };
  }
};

const historyCommand: CommandDef = {
  name: "history",
  aliases: [],
  description: "查看命令历史记录",
  usage: ":history [-c] [-d N]",
  handler: (args): CommandResult => {
    // 动态导入引擎获取历史
    const engine = (window as unknown as { __cmdEngine?: { history: { getAll(): string[] } } }).__cmdEngine;

    if (args[0] === "-c") {
      if (engine) {
        // 清空历史
        try {
          localStorage.removeItem("cmd-history");
        } catch {
          /* ignore */
        }
      }
      return { success: true, message: "历史记录已清除" };
    }

    if (args[0] === "-d" && args[1]) {
      return { success: false, message: "请使用 :history 查看历史记录编号后使用 :history -c 清除全部" };
    }

    if (!engine) {
      return { success: false, message: "命令引擎未初始化" };
    }

    const all = engine.history.getAll();
    if (all.length === 0) {
      return { success: true, message: "暂无历史记录" };
    }

    const maxIdx = String(all.length).length;
    const lines = [
      `\u250c${"\u2500".repeat(48)}\u2510`,
      `\u2502 ${"COMMAND HISTORY".padEnd(46)} \u2502`,
      `\u2502${" ".repeat(48)}\u2502`,
      ...all.map((cmd, i) => `\u2502 ${`${String(i + 1).padStart(maxIdx)}  ${cmd}`.padEnd(46)} \u2502`),
      `\u2502${" ".repeat(48)}\u2502`,
      `\u2502 ${`:history -c 清除全部`.padEnd(46)} \u2502`,
      `\u2514${"\u2500".repeat(48)}\u2518`
    ];
    return { success: true, message: lines.join("\n") };
  }
};

/** 注册所有内置命令 */
export function registerBuiltinCommands(): void {
  // 加载持久化数据
  loadAliases();
  loadFrequency();

  const builtins = [
    helpCommand,
    cdCmd,
    lsCmd,
    catCmd,
    themeCommand,
    styleCommand,
    scrollCommand,
    aliasCommand,
    historyCommand,
    homeCommand,
    backCommand,
    topCommand,
    reloadCommand,
    aboutCommand,
    quoteCommand,
    clearCommand
  ];
  for (const cmd of builtins) {
    registerCommand(cmd);
  }
}

export { clearSearch, executeSearch };

/** 获取上下文 */
export function getContext(): CommandContext {
  return {
    url: new URL(window.location.href),
    crtEffect: localStorage.getItem("crt-effect") ?? ""
  };
}
