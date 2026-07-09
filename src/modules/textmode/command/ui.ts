import { textHtml } from "../core/html";
import type { CommandEngine } from "./engine";
import type { CommandMode, CommandResult } from "./types";
import { getPathCompletions } from "./commands/nav";
import { clearSearch } from "./commands/search";

/** 命令行 UI 控制器 */
export class CommandUI {
  private engine: CommandEngine;
  private container: HTMLDivElement | null = null;
  private input: HTMLInputElement | null = null;
  private prompt: HTMLSpanElement | null = null;
  private output: HTMLDivElement | null = null;
  private active = false;
  private mode: CommandMode = "command";
  private completionIndex = -1;
  private completions: { text: string; description: string }[] = [];
  private completionType: "command" | "path" | "filename" = "command";
  private completionPopup: HTMLDivElement | null = null;
  private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
  private autoCollapseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(engine: CommandEngine) {
    this.engine = engine;
  }

  /** 面板是否激活 */
  get isActive(): boolean {
    return this.active;
  }

  /** 程序化设置输入框的值 */
  setInputValue(value: string): void {
    if (this.input) {
      this.input.value = value;
      this.input.focus();
    }
  }

  /** 激活命令模式 */
  activate(mode: CommandMode): void {
    if (this.active) {
      if (this.mode !== mode) {
        this.mode = mode;
        this.updatePrompt();
        this.input?.focus();
      }
      return;
    }

    this.active = true;
    this.mode = mode;
    const { container, input } = this.ensureDOM();
    this.updatePrompt();
    container.classList.add("cmd-active");
    container.setAttribute("aria-hidden", "false");
    input.value = "";
    input.focus();
    this.completions = [];
    this.completionIndex = -1;
    this.completionType = "command";
    this.hideCompletionPopup();

    this.boundKeydown = this.onKeydown.bind(this);
    document.addEventListener("keydown", this.boundKeydown);
    this.engine.notifyActivate(mode);
  }

  /** 关闭命令模式 */
  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.container?.classList.remove("cmd-active");
    this.container?.setAttribute("aria-hidden", "true");
    if (this.boundKeydown) {
      document.removeEventListener("keydown", this.boundKeydown);
      this.boundKeydown = null;
    }
    this.hideCompletionPopup();
    this.engine.notifyDeactivate();
    this.engine.lastSearchTerm = "";
    clearSearch();
    (document.activeElement as HTMLElement)?.blur();
  }

  /** 显示输出 */
  showOutput(result: CommandResult): void {
    if (!this.output) return;
    const line = document.createElement("div");
    line.className = result.success ? "cmd-output-line cmd-output-ok" : "cmd-output-line cmd-output-err";
    if (result.html) {
      line.innerHTML = result.message ?? "";
    } else {
      line.innerHTML = textHtml(result.message ?? (result.success ? "OK" : "ERROR"));
    }
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;

    // 搜索模式下自动折叠输出，减少遮挡
    if (this.mode === "search") {
      this.scheduleAutoCollapse();
    }
  }

  /** 计划自动折叠输出区域 */
  private scheduleAutoCollapse(): void {
    if (this.autoCollapseTimer) clearTimeout(this.autoCollapseTimer);
    this.autoCollapseTimer = setTimeout(() => {
      if (this.output) this.output.innerHTML = "";
    }, 4000);
  }

  /** 清空输出 */
  clearOutput(): void {
    if (this.output) this.output.innerHTML = "";
  }

  /** 确保 DOM 存在，返回关键元素引用 */
  private ensureDOM(): { container: HTMLDivElement; input: HTMLInputElement } {
    if (this.container && this.input) {
      return { container: this.container, input: this.input };
    }

    this.container = document.createElement("div");
    this.container.id = "cmd-container";
    this.container.className = "cmd-container";
    this.container.setAttribute("aria-hidden", "true");
    this.container.setAttribute("role", "dialog");
    this.container.setAttribute("aria-label", "命令输入");

    // 输出区域
    this.output = document.createElement("div");
    this.output.id = "cmd-output";
    this.output.className = "cmd-output";
    this.container.appendChild(this.output);

    // 输入行
    const inputLine = document.createElement("div");
    inputLine.className = "cmd-input-line";

    this.prompt = document.createElement("span");
    this.prompt.className = "cmd-prompt";
    this.prompt.textContent = ":";
    inputLine.appendChild(this.prompt);

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "cmd-input";
    this.input.setAttribute("aria-label", "命令输入");
    this.input.setAttribute("autocomplete", "off");
    this.input.setAttribute("spellcheck", "false");
    this.input.addEventListener("input", () => this.onInput());
    inputLine.appendChild(this.input);

    this.container.appendChild(inputLine);

    // 补全弹出层
    this.completionPopup = document.createElement("div");
    this.completionPopup.className = "cmd-completion-popup hidden";
    this.completionPopup.setAttribute("role", "listbox");
    this.container.appendChild(this.completionPopup);

    // 触摸事件
    this.container.addEventListener("touchstart", (e) => {
      if (this.active && this.input) {
        e.preventDefault();
        this.input.focus();
      }
    });

    document.body.appendChild(this.container);
    return { container: this.container, input: this.input };
  }

  /** 更新提示符 */
  private updatePrompt(): void {
    if (this.prompt) {
      this.prompt.textContent = this.mode === "search" ? "/" : ":";
    }
  }

  /** 输入事件 —— 三级补全：命令 → 路径 → 文件名 */
  private onInput(): void {
    if (!this.input) return;
    const value = this.input.value;

    if (this.mode === "command") {
      const raw = value.startsWith(":") ? value.slice(1) : value;
      const parts = raw.split(/\s+/);
      const cmdName = parts[0] ?? "";

      // 如果正在输入命令名（第一个单词），触发命令补全
      if (cmdName.length > 0 && parts.length === 1 && !raw.includes(" ")) {
        const cmdCompletions = this.engine.getCompletions(cmdName);
        if (cmdCompletions.length > 0) {
          this.completions = cmdCompletions;
          this.completionType = "command";
          this.completionIndex = -1;
          this.showCompletionPopup();
          return;
        }
      }

      // 如果已输入命令名且后面有参数，触发路径/文件名补全
      if (parts.length >= 2 && cmdName.length > 0) {
        const lastArg = parts[parts.length - 1] ?? "";
        const pathCompletions = getPathCompletions(lastArg);
        if (pathCompletions.length > 0) {
          this.completions = pathCompletions;
          this.completionType = this.completionType === "command" ? "path" : this.completionType;
          this.completionIndex = -1;
          this.showCompletionPopup();
          return;
        }
      }
    }

    this.hideCompletionPopup();
  }

  /** 键盘事件 */
  private onKeydown(e: KeyboardEvent): void {
    if (!this.active) return;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.deactivate();
        break;

      case "Backspace": {
        if (this.input && this.input.value === "") {
          e.preventDefault();
          this.deactivate();
        }
        break;
      }

      case "Enter":
        e.preventDefault();
        this.executeCommand();
        break;

      case "Tab":
        e.preventDefault();
        if (this.completions.length > 0) {
          this.cycleCompletion();
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (this.completions.length > 0 && this.completionPopup?.classList.contains("hidden") === false) {
          this.completionIndex = this.completionIndex <= 0 ? this.completions.length - 1 : this.completionIndex - 1;
          this.highlightCompletion();
        } else {
          const prev = this.engine.history.previous();
          if (prev !== null && this.input) {
            this.input.value = prev;
          }
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        if (this.completions.length > 0 && this.completionPopup?.classList.contains("hidden") === false) {
          this.completionIndex = this.completionIndex >= this.completions.length - 1 ? 0 : this.completionIndex + 1;
          this.highlightCompletion();
        } else {
          const next = this.engine.history.next();
          if (next !== null && this.input) {
            this.input.value = next;
          }
        }
        break;

      default:
        if (e.isComposing) return;
        break;
    }
  }

  /** 执行命令 */
  private async executeCommand(): Promise<void> {
    if (!this.input) return;
    let input = this.input.value;

    if (this.mode === "command" && input.startsWith(":")) {
      input = input.slice(1);
    }

    const result = await this.engine.execute(input, this.mode);
    this.showOutput(result);

    if (result.close === true) {
      this.deactivate();
    } else {
      this.input.value = "";
      this.input.focus();
      if (this.mode === "search") {
        this.input.value = this.engine.lastSearchTerm;
      }
    }
  }

  /** 显示补全弹窗 */
  private showCompletionPopup(): void {
    if (!this.completionPopup || this.completions.length === 0) {
      this.hideCompletionPopup();
      return;
    }

    this.completionPopup.innerHTML = "";
    this.completionPopup.classList.remove("hidden");

    // 添加补全类型标签
    const label = document.createElement("div");
    label.className = "cmd-completion-label";
    const labels: Record<string, string> = { command: "命令", path: "路径", filename: "文件" };
    label.textContent = labels[this.completionType] ?? "补全";
    this.completionPopup.appendChild(label);

    for (let i = 0; i < this.completions.length; i++) {
      const item = this.completions[i];
      const div = document.createElement("div");
      div.className = "cmd-completion-item";
      div.setAttribute("role", "option");
      div.setAttribute("aria-selected", "false");

      const name = document.createElement("span");
      name.className = "cmd-completion-name";
      name.textContent = item.text;
      div.appendChild(name);

      if (item.description) {
        const desc = document.createElement("span");
        desc.className = "cmd-completion-desc";
        desc.textContent = item.description;
        div.appendChild(desc);
      }

      div.addEventListener("click", () => {
        this.applyCompletion(i);
      });

      this.completionPopup.appendChild(div);
    }
  }

  /** 隐藏补全弹窗 */
  private hideCompletionPopup(): void {
    this.completions = [];
    this.completionIndex = -1;
    if (this.completionPopup) {
      this.completionPopup.classList.add("hidden");
    }
  }

  /** 循环补全：Tab 键在候选项中循环，不关闭弹窗 */
  private cycleCompletion(): void {
    if (this.completions.length === 0) return;
    this.completionIndex = (this.completionIndex + 1) % this.completions.length;
    this.updateInputWithCompletion(this.completionIndex);
    this.highlightCompletion();
  }

  /** 仅更新输入框内容（不关闭弹窗，用于循环补全） */
  private updateInputWithCompletion(index: number): void {
    if (!this.input || index < 0 || index >= this.completions.length) return;
    const completion = this.completions[index];

    if (this.completionType === "command") {
      const parts = this.input.value.split(/\s+/);
      parts[0] = this.input.value.startsWith(":") ? `:${completion.text}` : completion.text;
      this.input.value = parts.join(" ");
    } else {
      const parts = this.input.value.split(/\s+/);
      parts[parts.length - 1] = completion.text;
      this.input.value = parts.join(" ");
    }

    this.input.focus();
  }

  /** 应用补全（点击选择时关闭弹窗） */
  private applyCompletion(index: number): void {
    this.updateInputWithCompletion(index);
    this.hideCompletionPopup();
  }

  /** 高亮补全项 */
  private highlightCompletion(): void {
    if (!this.completionPopup) return;
    const items = this.completionPopup.querySelectorAll(".cmd-completion-item");
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle("cmd-completion-active", i === this.completionIndex);
      items[i].setAttribute("aria-selected", String(i === this.completionIndex));
    }
  }
}
