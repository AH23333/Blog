---
title: "E238｜聊聊Harness时代AI-First的组织架构：从信任人到信任AI"
date: 2026-05-25
author: "AH"
order: 3
lang: zh
redacted: false
---

# E238｜聊聊Harness时代AI-First的组织架构：从信任人到信任AI

> **播客：** 硅谷101 | **主播：** 泓君 | **日期：** 2026年5月
> **嘉宾：** Peter Pang，CreaoAI创始人；Kai、Max，Creao联合创始人
> **时长：** 65分钟

---

## 节目概要

"Harness Engineering"（挽具工程）正在成为硅谷新共识，Anthropic、OpenAI等公司都在探索这一工程范式。Peter Pang的文章《Why Your "AI-First" Strategy Is Probably Wrong》在X上获得百万级阅读。在Creao，99%的代码由AI完成，每天3到8次生产部署，过去六周的产品流程现在一天就能跑完。本期节目邀请Creao三位创始人，深入探讨Harness的实践与AI-First组织转型。

## 核心观点

### 1. Harness工程详解

- Harness的概念从prompt engineering（提示词工程）→ context engineering（上下文工程）演变而来
- **Harness涉及的范围远超prompt和context：** 包括tooling（工具链）、sandbox（沙箱）架构设计、host service交互、延迟优化等
- Harness的本质：怎么持续提升一个系统，让系统能够self-healing（自我修复）、self-improvement（自我优化）
- 如果Harness做得不好，容易产生hallucination（幻觉）或context overflow（上下文溢出），模型能力会降级

### 2. 共识与非共识

- **市场共识：** Harness是静态的——开发配套系统发挥LLM优势
- **Creao的观点：** Harness是一个动态过程——系统能够从静态状态"活起来"，不停地适配来自市场、产品、用户的各种信号
- 迭代是以AI为主导的，不是人为主导的——人只需要把各种信号feed给AI

### 3. AI-First组织转型

- AI-First不等于"使用AI"——想要把效率提升100倍、1000倍，不能只把AI当成工具，而要让AI成为所有生产力的主导
- **组织转型最难的一步：让所有员工都能做到信任AI**
- 有趣观察：市场不用再追着开发提需求，因为开发速度已经远超市场消化能力
- 拿掉产品经理后，团队效率反而大幅提升——大量对齐工作被AI接管
- **初级工程师比资深工程师更适应AI时代的转型**——资深工程师需要放下过去十年积累的专长

### 4. 未来核心竞争力

- 过去十年积累的专长正在快速贬值，但资深工程师仍有竞争力
- **未来的核心竞争力不再是写代码，而是"找到AI Planning的缺陷"和"判断什么是有价值的"**
- 代码质量保障：AI写完代码后，通过日志中的error和incident等信号反馈给AI来看代码质量

## 关键洞察

> "很多人认为Harness是静态的，但我们认为它是一个动态的过程——系统怎么从一个静态的状态真的活起来，能够self-improve，不停地适配各种信号。"

> "AI-First不等于使用AI。想要把效率提升100倍、1000倍，就不能只把AI当成工具，而要让AI成为所有生产力的主导。"