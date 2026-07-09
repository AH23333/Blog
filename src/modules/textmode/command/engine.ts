import { executeSearch, findCommand, getCompletions, getContext, recordUsage, resolveAlias } from "./registry";
import type { CommandEngineEvents, CommandMode, CommandResult, ParsedCommand } from "./types";

/** 命令解析器 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  return {
    raw: trimmed,
    name: parts[0]?.toLowerCase() ?? "",
    args: parts.slice(1)
  };
}

/** 命令历史管理器 */
class HistoryManager {
  private history: string[] = [];
  private index = -1;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.load();
  }

  add(entry: string): void {
    if (this.history.length > 0 && this.history[this.history.length - 1] === entry) {
      return;
    }
    this.history.push(entry);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
    this.index = this.history.length;
    this.save();
  }

  previous(): string | null {
    if (this.history.length === 0) return null;
    this.index = Math.max(0, this.index - 1);
    return this.history[this.index] ?? null;
  }

  next(): string | null {
    if (this.index >= this.history.length - 1) {
      this.index = this.history.length;
      return "";
    }
    this.index = Math.min(this.history.length - 1, this.index + 1);
    return this.history[this.index] ?? "";
  }

  reset(): void {
    this.index = this.history.length;
  }

  getAll(): string[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
    this.index = -1;
    this.save();
  }

  get currentIndex(): number {
    return this.index;
  }

  private save(): void {
    try {
      localStorage.setItem("cmd-history", JSON.stringify(this.history));
    } catch {
      // 存储失败时静默忽略
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem("cmd-history");
      if (raw) {
        this.history = JSON.parse(raw);
        this.index = this.history.length;
      }
    } catch {
      this.history = [];
    }
  }
}

/** 命令引擎 */
export class CommandEngine {
  history: HistoryManager;
  /** 上次搜索词，用于支持 Enter 继续查找 */
  lastSearchTerm = "";
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor() {
    this.history = new HistoryManager();
    // 暴露到 window 供 history 命令访问
    (window as unknown as { __cmdEngine?: CommandEngine }).__cmdEngine = this;
  }

  /** 监听事件 */
  on<K extends keyof CommandEngineEvents>(event: K, listener: CommandEngineEvents[K]): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: unknown[]) => void);
  }

  /** 触发事件 */
  private emit<K extends keyof CommandEngineEvents>(event: K, ...args: Parameters<CommandEngineEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      (fn as (...args: unknown[]) => void)(...args);
    }
  }

  /** 通知激活 */
  notifyActivate(mode: CommandMode): void {
    this.emit("activate", mode);
  }

  /** 通知关闭 */
  notifyDeactivate(): void {
    this.emit("deactivate");
  }

  /** 获取补全 */
  getCompletions(prefix: string): { text: string; description: string }[] {
    return getCompletions(prefix);
  }

  /** 继续搜索（正向 n，反向 N） */
  continueSearch(backwards = false): CommandResult {
    if (!this.lastSearchTerm) {
      return { success: false, message: "没有活动搜索，请先使用 / 搜索" };
    }
    return executeSearch(this.lastSearchTerm, true, backwards);
  }

  /** 执行命令 */
  async execute(input: string, mode: CommandMode): Promise<CommandResult> {
    if (mode === "search") {
      const isContinue = input === this.lastSearchTerm && this.lastSearchTerm !== "";
      const result = executeSearch(input, isContinue);
      if (result.success) {
        this.lastSearchTerm = input;
      }
      this.emit("execute", input, result);
      return result;
    }

    const parsed = parseCommand(input);
    if (!parsed.name) {
      const result: CommandResult = { success: false, message: "请输入命令" };
      this.emit("execute", input, result);
      return result;
    }

    // 尝试别名解析
    let cmd = findCommand(parsed.name);
    let resolvedName = parsed.name;
    if (!cmd) {
      const expansion = resolveAlias(parsed.name);
      if (expansion) {
        // 解析别名：将别名展开并重新解析
        const aliasParts = expansion.split(/\s+/);
        resolvedName = aliasParts[0] ?? "";
        cmd = findCommand(resolvedName);
        if (cmd) {
          // 合并别名参数和用户提供的参数
          const aliasArgs = aliasParts.slice(1);
          parsed.name = resolvedName;
          parsed.args = [...aliasArgs, ...parsed.args];
        }
      }
    }

    if (!cmd) {
      const result: CommandResult = {
        success: false,
        message: `未知命令: ${parsed.name}. 输入 :help 查看可用命令`
      };
      this.emit("execute", input, result);
      return result;
    }

    try {
      const ctx = getContext();
      const result = await cmd.handler(parsed.args, ctx);
      this.history.add(input);
      recordUsage(resolvedName);
      this.emit("execute", input, result);
      this.emit("historyChange", this.history.getAll(), this.history.currentIndex);
      return result;
    } catch (err) {
      const result: CommandResult = {
        success: false,
        message: `命令执行错误: ${err instanceof Error ? err.message : String(err)}`
      };
      this.emit("execute", input, result);
      return result;
    }
  }
}
