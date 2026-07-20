---
title: "Chord 分布式系统简易实现"
date: 2026-03-29
author: "AH"
order: 0
redacted: false
---
# 交互式 Chord 分布式系统简易实现

[项目地址](https://github.com/AH23333/Chord)

## 项目简介
本项目基于 C++ 实现了 Chord 分布式哈希表（DHT）协议，提供分布式节点间的键值对存储、查找、节点动态加入/退出等核心能力，并配套命令行交互工具（CLI）用于便捷操作和调试 Chord 网络。项目遵循 Chord 协议核心设计，实现了一致性哈希、手指表路由、网络稳定化等关键机制，无第三方库依赖，可直接编译运行。

### ~~寒假史山~~详细说明
通过仿制后端的命令行交互式操作界面（内涵大量无意义缩写），在单线程内模拟的多服务器节点，无实际网络通信；
节点间通过代理访问其他服务器，含有ChordRingManager类转发，网络部分是一点没有的（连TCP都没有）；
节点并非周期性维护FingerTable表，而是在每个节点加入和退出环时都通知所有的节点更新FingerTbale，破坏局部性属实无奈之举

#### 对Chord节点结构进行的简化：
Node结构只存储id和ip，省略了端口号（毕竟没有实际的网络通信）；
去掉了后继节点列表（毕竟是主要是用来防止有服务器突然挂掉，相关要实现的内容太多了）；
节点的资源只简单使用string存储，没有实现资源拷贝，实际还需序列化后使用缓存存储还有连接数据库存储

## 核心特性
- ✅ 实现 Chord 协议核心逻辑：一致性哈希环、手指表维护、节点路由与查找
- ✅ 支持节点动态加入/退出，自动触发数据迁移与网络重构
- ✅ 内置 SHA-1 哈希算法，生成 160 位哈希值适配 Chord 哈希环
- ✅ 命令行交互工具（CLI），支持节点管理、键值对存储/查询等操作
- ✅ 完善的日志系统，支持多级别日志输出（DEBUG/INFO/WARN/ERROR）
- ✅ 可配置化参数，便于适配不同运行环境

## 项目结构
| 文件/目录          | 功能说明                                                                 |
|---------------------|------------------------------------------------------------------------|
| `chord.h/cpp`       | Chord 协议核心实现：哈希环管理、节点路由、稳定化协议、键值存储/查找       |
| `node.h/cpp`        | 单个 Chord 节点定义：节点属性（ID/IP/端口）、前驱/后继、FingerTable、存储 |
| `SHA_1.h/cpp`       | SHA-1 哈希算法实现：生成节点ID/键哈希，适配 Chord 一致性哈希             |
| `chord_cli.h/cpp`   | 命令行交互工具：解析用户命令、调用核心接口、输出操作结果                 |
| `logger.h/cpp`      | 日志模块：多级别日志输出（控制台+文件），便于调试与问题排查              |
| `config.h`          | 全局配置：哈希环大小常量定义                     |
| `main.cpp`          | 程序入口：初始化节点/CLI、解析启动参数、启动核心逻辑                     |
| `log.txt`           | 日志输出文件：记录项目运行过程中的日志信息                               |
| `chord.exe`          | 编译后可执行文件（Windows）|

## 编译与运行

### 编译环境
- 编译器：支持 C++11 及以上版本的 GCC/Clang/MSVC
- 系统：Windows/Linux/macOS（无平台相关依赖）
- 依赖：仅 C++ 标准库，无第三方依赖

### 编译命令（GCC 示例）
```bash
# 克隆/下载项目后，进入项目根目录执行编译
g++ -std=c++11 main.cpp chord.cpp chord_cli.cpp node.cpp SHA_1.cpp logger.cpp -o chord.exe
```

### 快速运行
#### 启动命令
```bash
# 进入项目根目录执行
./chord.exe
```

#### 核心操作示例
```bash
# 添加节点服务器
chord> an 192.168.1.100

# 添加多个节点服务器
chord> ans 192.168.1.101 192.168.1.101 192.168.1.103

# 移除节点服务器
chord> rn 192.168.1.100

# 移除多个节点服务器
chord> rns 192.168.1.101 192.168.1.101 192.168.1.103

# 添加资源
chord> ar a.pdf

# 添加多个资源
chord> ars a.pdf b.ppt c.jpg

# 移除资源
chord> rr a.pdf

# 移除多个资源
chord> rrs a.pdf b.ppt c.jpg

# 查找资源
chord> fr a.pdf

# 查找多个资源
chord> frs a.pdf b.ppt c.jpg

# 列出当前网络中的节点
chord> ln

# 查看环状态
chord> rs

# 查看节点状态
chord> ns 192.168.1.100

# 清除屏幕
chord> clear

# 显示所有命令帮助
chord> help

# 退出CLI
chord> exit
```

## 核心命令说明
| 命令格式 | 功能描述 | 示例 |
|-|-|-|
| `an <ip>` | 添加节点add_node | `an 192.168.1.100` |
| `ans <ip> <ip> <ip> ...`| 添加多个节点add_nodes | `ans 192.168.1.101 192.168.1.102 192.168.1.103` |
| `rn <ip>`   | 移除节点remove_node | `rn 192.168.1.100"`|
| `rns <ip> <ip> <ip> ...` | 移除多个节点remove_nodes | `rns 192.168.1.101 192.168.1.102 192.168.1.103` |
| `rns *` | 移除全部节点remove_nodes | `rns *` |
| `ar <name>` | 添加资源add_resource | `ar a.pdf` |
| `ars <name1> <name2> <name3> ...` | 添加多个资源add_resources | `rrs a.pdf b.ppt c.jpg` |
| `rr <name>` | 移除资源remove_resource | `rr a.pdf` |
| `rrs <name1> <name2> <name3> ... ` | 移除多个资源remove_resources | `rrs a.pdf b.ppt c.jpg` |
| `rrs *` | 移除全部资源remove_resources | `rrs *` |
| `fr <name>` | 查找资源find_resource | `fr a.pdf` |
| `frs <name1> <name2> <name3> ...` | 查找多个资源find_resources | `frs a.pdf b.ppt c.jpg` |
| `ln` | 列出网络中节点list_node | `ln` |
| `rs` | 查看当前环状态ring_status | `rs` |
| `ns <ip>` | 查看节点状态node_status| `ns 192.168.1.100` |
| `help` | 查看帮助 | `help` |
| `clear` | 清屏 | `clear` |
| `exit` | 退出 | `exit` |

## 关键技术细节
### 1. 一致性哈希实现
- 基于 SHA-1 生成 m 位哈希值，构建 Chord 哈希环；
- 节点 ID 由 `IP` 哈希生成，键 ID 由键名字符串哈希生成；
- 手指表（Finger Table）优化路由效率，将查找复杂度降至 O(log n)。

### 2. 稳定化协议
Chord 网络通过三大核心机制保证一致性：
- `stabilize`：定期检查并更新（本项目在有节点加入和退出时更新）后继节点，确保节点连接正确；
- `fix_fingers`：定期更新手指表（本项目在有节点加入和退出时更新），维护路由表准确性；
- `check_predecessor`：检测前驱节点存活状态（本项目中节点均存活，暂未实现该机制），失效时自动更新。

### 3. 数据存储规则
- 键值对存储在哈希环上“负责”该键的节点（键哈希值落在节点前驱与自身之间）；
- 节点加入/退出时，自动迁移对应范围的键值对，保证数据不丢失。

### 维护注意事项
- 日志文件 `log.txt` 会持续增长，建议定期清理或配置日志轮转；
- 修改 `config.h` 中的参数（如哈希环大小、稳定化间隔）后，需重新编译生效；

## 故障排查
| 常见问题                | 排查方向                                                                 |
|-------------------------|--------------------------------------------------------------------------|
| 节点无法加入网络        | 1. 检查ChordRingManager是否创建成功；2. 检查 IP 是否已存在；3. 查看 `log.txt` 中的 ERROR 日志 |
| 键值对查找失败          | 1. 检查哈希计算逻辑；2. 确认稳定化协议是否正常执行；3. 验证节点FingerTable是否正确 |
| 日志无输出              | 1. 检查日志级别是否过高；2. 确认日志文件路径是否有权限写入               |
| 程序崩溃                | 1. 查看崩溃前 ERROR 日志；2. 检查空指针（如前驱/后继节点未初始化）；3. 调试哈希环边界条件 |

## 协议参考
Chord 协议核心论文：[Chord: A Scalable Peer-to-Peer Lookup Protocol for Internet Applications](https://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf)
