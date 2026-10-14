# 文档索引

> 本项目所有文档的地图。新人（人或 AI）从这里开始。

## 一、代码层（项目本体）

| 目录/文件 | 内容 |
|---|---|
| index.html | 应用入口 |
| manifest.json | PWA 配置 |
| sw.js | Service Worker |
| js/ | 核心逻辑（db / parser / ledger / export 等） |
| css/ | 样式（tokens / styles / app-v2） |
| tests/ | 单元测试（tests.html + unit-*.js） |
| assets/ | 项目资源（字体、印章、分类图标、背景图） |
| icons/ | PWA 图标 |

## 二、入口层（每次开工先读）

| 文件 | 作用 |
|---|---|
| README.md | 项目说明（面试官/新人入口） |
| AGENTS.md | AI 协作规则（规则层最高优先级） |
| docs/status/CURRENT_STATE.md | 当前进度快照 |
| docs/DOCS_INDEX.md | 本文件——文档地图 |

## 三、事实层（AI 的"事实来源"）

| 文件 | 管什么 |
|---|---|
| PROJECT_BRIEF.md | 技术约束（宪法） |
| docs/DESIGN_SPEC.md | 视觉规范（宪法） |
| docs/status/CURRENT_STATE.md | 进度 |
| docs/BACKLOG.md | 待办（B-xx 编号） |
| docs/status/PENDING.md | 讨论中产生的零散待办 |
| docs/SPRINTS.md | Sprint 记录 + AC + Retro |

## 四、规则层

| 文件 | 管什么 |
|---|---|
| AGENTS.md | AI 硬约束 + 决策授权 + 工作流 |

## 五、方法层（Skill）

| 文件 | 什么时候用 |
|---|---|
| docs/skills/story-splitting.md | 拆 Story |
| docs/skills/ac-writing.md | 写 AC |
| docs/skills/code-review.md | Story 完成后 Review |
| docs/skills/cleanup-dead-css.md | 清理死 CSS |
| docs/skills/state-sync.md | 多步任务（3 步以上） |
| docs/skills/retro.md | Sprint 结束 |

## 六、流程层（脚本）

| 文件 | 什么时候用 |
|---|---|
| tools/start-task.sh | 启动新任务 |
| tools/post-story.sh | Story 完成后同步状态 |

## 七、经验层（实验记录）

| 文件 | 内容 |
|---|---|
| docs/experiments/实验一-AI协作流程对照.md | AI 协作流程三任务对照：数据 + 结论 + 附加发现 |
| docs/experiments/实验二-状态管理对照.md | JSON vs Markdown 状态管理对照 |
| docs/experiments/实验三-测试设计对照.md | 单 Agent vs 双 Agent 测试设计对照 |

## 八、素材层

| 目录 | 内容 |
|---|---|
| docs/screenshots/ | 已实现页面截图（视觉展示） |
| docs/methodology/ | 方法论总结 |