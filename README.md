# travel-ledger

> 一个用于验证「AI 参与研发后，敏捷流程该怎么设计」的个人实验项目。
> **不是产品，是方法论实验。**

## 为什么做这个

AI 把代码生成成本降到极低，但验证、审查、协同的成本没降，反而成了新瓶颈。

我想验证一件事：**AI 参与研发后，人机协作流程该怎么设计，才能让 AI 安全、高效地跑起来。**

所以我用 AI 完整跑了一遍从需求到交付的流程，并把过程中的机制沉淀下来。

## 核心产出

### 1. 决策分级 L1-L4
明确什么任务 AI 自己拍、什么必须人审、什么必须会签。
解决"人审疲劳"和"审核流于形式"的问题。

### 2. 测试分层与独立验证
建立分层测试规则，用独立测试 Agent 切断同源偏差。
解决"实现和测试同源，测试全绿但业务全错"的问题。

### 3. 状态外化
把对话状态从模型上下文搬到文件里，换窗口不失忆。
解决"上下文漂移"和"新窗口重新理解项目"的问题。

### 4. 熔断规则
迭代超限 / 改动量连续上升 / 超时 → 强制交人。
解决"AI 陷入死循环，无限消耗"的问题。

### 5. 文档驱动流程
从 Epic 拆解到 Story，单 Story 经过 intent → spec → plan 三段式审批后，
进入自动化交付流程至验收。
详见 [docs/methodology/](docs/methodology/)。

### 6. Skill 模板库
沉淀可复用的方法：story-splitting（拆 Story）、ac-writing（写 AC）、
code-review（独立评审）等，AI 按需加载。

### 7. 文档与执行分层
- **方案层**（本地文档）：讨论、规划、方案
- **执行层**（Gitee）：工作项、状态、迭代
- **校验层**（快照）：漂移检测
详见 [docs/WORKFLOW.md](docs/WORKFLOW.md) 第二节。

## 视觉展示

7 屏手绘风设计（含空状态和列表态）：

| 首页 | 载录 | 账簿 |
|:---:|:---:|:---:|
| ![首页](<docs/screenshots/01 - 首页.png>) | ![载录](<docs/screenshots/02 - 载录.png>) | ![账簿·列表](<docs/screenshots/03 - 账簿·列表.png>) |

| 阅踪 | 游笺 | 驿站 | 轨迹 |
|:---:|:---:|:---:|:---:|
| ![阅踪·列表](<docs/screenshots/04 - 阅踪·列表.png>) | ![游笺·票夹](<docs/screenshots/05 - 游笺·票夹.png>) | ![驿站](<docs/screenshots/06 - 驿站.png>) | ![轨迹·底部](<docs/screenshots/07 - 轨迹·底部.png>) |

更多截图见 [docs/screenshots/](docs/screenshots/)。

## 如何运行

浏览器直接打开 `index.html` 即可。
PWA 离线安装功能已实现（Manifest + Service Worker），需 http(s) 服务才能启用。

## 项目状态

核心闭环已完成：
- 记一笔 → 列表 → 筛选 → 导出 → 清空
- 174 条单元测试全绿
- 7 屏视觉定稿
- PWA 离线可用

待续：
- 编辑/删除功能接回新视觉（S3-09）
- 载录页表单实装 + 保存链（S4-A / S4-B）
- 部分已知问题（见 BACKLOG.md）

## 执行层

工作项（Epic / Story / Task / Bug / Event）在 Gitee 跟踪：
https://e.gitee.com/elaine-dev-studio/projects/915516/issues

## 目录结构

- `README.md` — 项目说明（本文件）
- `AGENTS.md` — AI 协作规则
- `PROJECT_BRIEF.md` — 项目宪法
- `index.html` — 应用入口
- `manifest.json` — PWA 配置
- `sw.js` — Service Worker
- `js/` — 核心逻辑
- `css/` — 样式
- `tests/` — 单元测试
- `assets/` — 资源
  - `fonts/` — 本地字体
  - `seals/` — 印章素材
  - `icons/category/` — 分类图标
- `icons/` — PWA 图标
- `tools/` — 协作脚本
- `docs/`
  - `DOCS_INDEX.md` — 文档索引
  - `WORKFLOW.md` — 流程定义
  - `DESIGN_SPEC.md` — 视觉规范
  - `SPRINTS.md` — 迭代记录（含 Retro）
  - `BACKLOG.md` — Product Backlog
  - `backlog.json` — Gitee 快照（漂移检测用）
  - `status/`
  - `stories/` — Story 方案文件（intent + spec + plan）
    - `CURRENT_STATE.md` — 状态快照
    - `PENDING.md` — 任务暂存
  - `skills/` — 可复用方法
  - `experiments/` — 实验记录
  - `methodology/` — 方法论总结
  - `screenshots/` — 视觉展示

## 技术栈

- 原生 HTML/CSS/JS，零依赖
- IndexedDB 本地存储
- PWA 离线可用
- Safari 15 基线

## License

MIT

*最后更新：2026-10-16*