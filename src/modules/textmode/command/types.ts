/** 命令模式：":" 指令模式 或 "/" 搜索模式 */
export type CommandMode = "command" | "search";

/** 命令执行上下文 */
export type CommandContext = {
  /** 当前页面 URL */
  url: URL;
  /** 当前选中的 CRT 效果 ID */
  crtEffect: string;
};

/** 命令解析结果 */
export type ParsedCommand = {
  /** 原始输入 */
  raw: string;
  /** 命令名 */
  name: string;
  /** 参数列表 */
  args: string[];
};

/** 命令执行结果 */
export type CommandResult = {
  /** 是否成功 */
  success: boolean;
  /** 输出消息（显示在命令行区域，支持 HTML） */
  message?: string;
  /** 消息是否为 HTML 格式（默认 false，纯文本） */
  html?: boolean;
  /** 执行后是否关闭命令行（默认 false，保持打开） */
  close?: boolean;
};

/** 命令处理器接口 */
export type CommandHandler = (args: string[], ctx: CommandContext) => CommandResult | Promise<CommandResult>;

/** 命令定义 */
export type CommandDef = {
  /** 命令名称 */
  name: string;
  /** 命令别名 */
  aliases?: string[];
  /** 描述 */
  description: string;
  /** 用法说明 */
  usage?: string;
  /** 处理器 */
  handler: CommandHandler;
};

/** 命令补全候选项 */
export type CompletionCandidate = {
  /** 完整匹配文本 */
  text: string;
  /** 显示描述 */
  description?: string;
};

/** 命令引擎事件 */
export type CommandEngineEvents = {
  activate: (mode: CommandMode) => void;
  deactivate: () => void;
  execute: (input: string, result: CommandResult) => void;
  historyChange: (history: string[], index: number) => void;
};
