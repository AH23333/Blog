export { CommandEngine } from "./engine";
export { getCommandEngine, getCommandUI, installCommandMode } from "./install";
export { getScrollConfig, setScrollConfig } from "./scroll-config";
export {
  getCommands,
  registerBuiltinCommands,
  registerCommand,
  unregisterCommand,
  getAliases,
  setAlias,
  deleteAlias
} from "./registry";
export type {
  CommandContext,
  CommandDef,
  CommandHandler,
  CommandMode,
  CommandResult,
  CompletionCandidate
} from "./types";
export { CommandUI } from "./ui";
export {
  initTheme,
  getCurrentTheme,
  getPresetThemes,
  applyTheme,
  resetTheme,
  importTheme,
  exportTheme
} from "./commands/themes";
export type { ThemeConfig } from "./commands/themes";
