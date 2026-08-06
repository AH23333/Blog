---
title: "LLM屏幕翻译器 (LLM Screen Translator)"
date: 2026-07-24
author: "AH"
order: 3
redacted: false
---

# LLM屏幕翻译器 (LLM Screen Translator)

一款基于 **OCR + 本地大语言模型** 的实时屏幕翻译工具，专为日英混合文本翻译优化。支持任意区域截屏，自动识别并翻译，无需联网。

[项目地址](https://github.com/AH23333/llm-screen-translator)

## ✨ 特性

- 🖥️ 选取任意屏幕区域，实时监控文字变化。
- 🔍 使用 Tesseract OCR 识别日文/英文（支持多语言混合）。
- 🤖 对接本地 Ollama 模型（默认 `qwen2.5:3b`，可更换为轻量翻译专用模型）。
- ⚡ 智能缓存：相同文本不重复翻译，图像无变化时自动延长检测间隔。
- 🎨 深浅色主题，窗口大小任意拖动，始终置顶。
- ⚙️ 丰富的设置选项（OCR参数、模型、提示词等）。

## 📦 依赖安装

### 系统依赖
1. **Tesseract OCR**  
   - 下载安装：[GitHub - tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract)  
   - 安装日文语言包：将 `jpn.traineddata` 放入 `tessdata` 目录（默认路径：`C:\Program Files\Tesseract-OCR\tessdata`）
2. **Ollama**  
   - 下载安装：[ollama.com](https://ollama.com)  
   - 拉取模型（示例）：  
     ```bash
     ollama pull qwen2.5:3b
     ```

### Python 依赖
```bash
pip install PyQt6 opencv-python-headless requests numpy pytesseract pillow
```

## 🚀 快速启动

1. **确保 Ollama 服务已运行**：
   ```bash
   ollama serve
   ```
2. **运行脚本**：
   ```bash
   python translator.py
   ```

## 🖱️ 使用说明

- **采集窗（红色边框窗口）**：显示当前监控区域，可拖拽移动、拖动边缘调整大小。
- **翻译窗**：显示最新翻译结果，同样可拖拽和调整大小。
- **右键菜单**（在任意窗口上右键）：
  - ⏸/▶ 暂停/启动自动翻译
  - 🔄 立即翻译当前画面
  - ⚙ 打开设置
  - ✕ 退出程序

## ⚙️ 设置项说明

| 选项 | 说明 |
|------|------|
| 识别间隔 | 自动检测的周期（毫秒） |
| 主题 | 浅色/深色 |
| 字体/字号 | 翻译窗口显示样式 |
| Tesseract路径 | `tesseract.exe` 的完整路径 |
| tessdata目录 | 语言包所在文件夹 |
| OCR语言 | 支持 `jpn`, `eng`, `chi_sim`, `jpn+eng` |
| Ollama API地址 | 默认为 `http://localhost:11434/api/generate` |
| 模型名称 | 使用的 Ollama 模型（如 `qwen2.5:3b`） |
| 超时 | 翻译请求超时秒数 |
| 提示词模板 | 可自定义翻译指令，`{text}` 为识别文本占位符 |

## 🧠 性能优化建议

- **更换更轻量的翻译模型**：推荐 `kaelri/hy-mt2:1.8b-q4_K_M`，翻译速度更快，专为日英翻译设计。
- **调整识别间隔**：如果内容变化不频繁，可适当增大间隔（如 5000ms）降低负载。
- **OCR参数**：脚本已内置 `--psm 6 --oem 3`，若识别速度仍慢，可考虑缩小截屏区域（减少像素量）。

## 📝 文件结构

```
translator.py        # 主程序
translator_config.json # 自动生成的配置文件（保存窗口位置、设置等）
```

## 🤝 贡献

欢迎提交 Issue 或 Pull Request。

## 📄 许可证

MIT License