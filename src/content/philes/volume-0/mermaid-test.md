---
title: "Mermaid测试"
date: 2026-06-21
author: "AH"
order: 4
redacted: false
---

CONTENTS

── 测试说明 ───────────────────────────────────────────────────────────────

本文用于测试 Mermaid 图表的构建时渲染功能。所有图表均通过 #[b|mermaid.render()] 在构建时静态渲染为 SVG，
无需客户端 JavaScript。

── 1.0 流程图 ──────────────────────────────────────────────────────────────

```mermaid
graph TD
    A[开始] --> B{判断条件}
    B --> C[执行操作]
    C --> D[记录结果]
    D --> E[结束]
    B --> F[跳过]
    F --> E
```

── 2.0 时序图 ──────────────────────────────────────────────────────────────

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as 服务器
    participant D as 数据库

    C->>S: 发送请求
    S->>D: 查询数据
    D-->>S: 返回结果
    S-->>C: 响应数据
```

── 3.0 类图 ───────────────────────────────────────────────────────────────

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +String color
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

── 4.0 状态图 ──────────────────────────────────────────────────────────────

```mermaid
stateDiagram-v2
    [*] --> 待审核
    待审核 --> 审核中
    审核中 --> 已通过
    审核中 --> 已驳回
    已驳回 --> 待审核
    已通过 --> [*]
```

── 5.0 实体关系图 ──────────────────────────────────────────────────────────

```mermaid
erDiagram
    USER ||--o{ POST : ""
    USER ||--o{ COMMENT : ""
    POST ||--o{ COMMENT : ""
    POST ||--o{ TAG : ""
```

── 6.0 甘特图 ──────────────────────────────────────────────────────────────

```mermaid
gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 规划阶段
    需求分析       :a1, 2026-06-01, 7d
    技术方案       :a2, after a1, 5d
    section 开发阶段
    核心模块       :a3, after a2, 14d
    前端页面       :a4, after a2, 14d
    section 测试阶段
    集成测试       :a5, after a3, 7d
    上线部署       :a6, after a5, 3d
```

── 7.0 饼图 ───────────────────────────────────────────────────────────────

```mermaid
pie
    title 编程语言使用分布
    "TypeScript" : 45
    "Rust" : 25
    "Python" : 15
    "Go" : 10
    "其他" : 5
```

── 8.0 Git 图 ───────────────────────────────────────────────────────

```mermaid
gitGraph
    commit
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    merge feature
    commit
```

── 9.0 用户旅程图 ───────────────────────────────────────────────────────

```mermaid
journey
    title 用户访问网站流程
    section 浏览
      访问首页: 5: 用户
      查看文章: 4: 用户
    section 交互
      代码高亮: 3: 用户
      Mermaid图表: 5: 用户
    section 反馈
      满意离开: 5: 用户
```