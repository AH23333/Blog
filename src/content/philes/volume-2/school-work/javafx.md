---
title: "JavaFX 项目"
date: 2026-06-22
author: "AH"
order: 1
redacted: false
---

# JavaFX 项目

──[ 1.0 ]──────────────────────────────────────────────────────────[ 项目概述 ]

JavaFX 是一个用于构建 #[C|桌面应用程序] 的 Java 图形界面框架，提供丰富的
#[G|UI 控件]、#[Y|CSS 样式] 和 #[m|FXML 布局] 支持。

:::important
JavaFX 自 JDK 11 起已从标准库中移除，需作为独立依赖引入。
推荐使用 #[G|OpenJFX] 作为开源替代方案。
:::

┌─ 核心特性 ────────────────────────────────────────────────────────┐

│ #[C|FXML]  — 声明式 XML 布局，分离 UI 与业务逻辑                           │
│ #[G|Scene Graph]  — 场景图模型，节点树形组织 UI 组件                      │
│ #[Y|CSS Styling]  — 支持 CSS 样式表，统一管理外观                          │
│ #[m|Property Binding]  — 属性绑定机制，自动同步数据与视图                    │
└──────────────────────────────────────────────────────────────────┘

──[ 2.0 ]──────────────────────────────────────────────────────[ 项目结构 ]

```Plain Text
java-fx-project/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/
│   │   │       ├── MainApp.java          ← 主入口
│   │   │       ├── controllers/          ← 控制器
│   │   │       └── models/               ← 数据模型
│   │   └── resources/
│   │       ├── fxml/                     ← FXML 布局文件
│   │       └── styles/                   ← CSS 样式文件
│   └── test/
├── pom.xml / build.gradle
└── README.md
```

──[ 3.0 ]──────────────────────────────────────────────────[ 开发经验总结 ]

:::note 关键经验
#[G|1.] FXML 加载路径必须使用绝对路径（以 / 开头），避免相对路径在不同包结构下失效。

#[G|2.] Controller 中的 `@FXML` 注解字段必须是 #[R|public] 或使用
`javafx.fxml.FXMLLoader.setAccessible(true)` 注入。

#[G|3.] 长时间任务应使用 #[C|Task] 或 #[C|Service] 在后台线程执行，
避免阻塞 #[Y|JavaFX Application Thread] 导致 UI 冻结。
:::

:::warning
#[R|常见坑}]：JavaFX 模块化项目需在 `module-info.java` 中声明
`requires javafx.controls; requires javafx.fxml;` 等模块依赖，
否则编译时会出现 #[R|模块未找到] 错误。
:::

──[ 4.0 ]──────────────────────────────────────────────────[ 参考资源 ]

  - #[c|OpenJFX 官方文档]  —  https://openjfx.io/
  - #[c|JavaFX CSS 参考]  —  https://openjfx.io/javadoc/17/javafx.graphics/javafx/scene/doc-files/cssref.html
  - #[c|Scene Builder]  —  https://gluonhq.com/products/scene-builder/