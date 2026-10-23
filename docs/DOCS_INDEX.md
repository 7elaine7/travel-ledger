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

## 二、入口层（开工必读与任务导航）

### 1. 每次新窗口强制必读（最小集，与 AGENTS.md 一致）

| 文件 | 作用 |
|---|---|
| AGENTS.md | AI 协作规则（最高指令，含「开工前必做 3 步」） |
| PROJECT_BRIEF.md | 重点读第 8.3 条（测试基线与禁自动化硬约束） |
| docs/status/CURRENT_STATE.md | 当前进度快照（昨天做到哪了，今天做什么） |
| docs/status/PENDING.md | 零散待办暂存区（看当前暂存） |

### 2. 按任务场景强制触发阅读（干活前必看）

| 触发场景 | 必读文件 |
|---|---|
| 涉及流程、排期、拆分、验收 | docs/WORKFLOW.md（阶段流转、DoD、待办归位、文档与 Gitee 关系） |
| 开始执行某个 Story | docs/stories/<Story编号>.md（intent + spec + plan） |
| 不知道该调用什么方法 | docs/skills/ 下的对应 skill 文件（拆解/测试/回顾） |
| 涉及视觉/UI 开发 | docs/DESIGN_SPEC.md（视觉宪法） |

### 3. 项目信息入口（给新人/面试官看，AI 找信息时查）

| 文件 | 作用 |
|---|---|
| README.md | 项目说明（面试官/新人入口） |
| docs/DOCS_INDEX.md | 本文件——文档地图 |

## 三、事实层（AI 的"事实来源"）

| 文件 | 管什么 |
|---|---|
| PROJECT_BRIEF.md | 技术约束（宪法）+ 宏观目标 |
| docs/DESIGN_SPEC.md | 视觉规范（宪法） |
| docs/status/CURRENT_STATE.md | 进度快照 |
| docs/BACKLOG.md | Product Backlog（需求池：未拆 Epic 池 / Story 候选池 / 未排期问题池） |
| docs/status/PENDING.md | 讨论中产生的零散待办（定期清理入 Gitee） |
| docs/SPRINTS.md | Sprint 目标 + Story 列表 + AC + Task 计划 + 完成记录 |

## 四、规则层

| 文件 | 管什么 |
|---|---|
| AGENTS.md | AI 硬约束 + 决策授权 + 工作流 + 状态同步 |

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
| tools/snapshot.py | Gitee 快照导出（规划中，待实现） |

## 七、经验层（实验记录）

| 文件 | 内容 |
|---|---|
| docs/experiments/实验一-AI协作流程对照.md | AI 协作流程三任务对照：数据 + 结论 + 附加发现 |
| docs/experiments/实验二-状态管理对照.md | JSON vs Markdown 状态管理对照 |
| docs/experiments/实验三-测试设计对照.md | 单 Agent vs 双 Agent 测试设计对照 |

## 八、素材与方法层

| 目录 | 内容 |
|---|---|
| docs/screenshots/ | 已实现页面截图（视觉展示） |
| docs/methodology/AI_NATIVE_AGILE_PLAYBOOK.md | **核心方法论**：AI 原生敏捷、验证税、L1-L4 授权与流程演进推演 |

## 九、执行层（Gitee）

| 位置 | 内容 |
|---|---|
| https://e.gitee.com/elaine-dev-studio/projects/915516/issues | Epic / Story / Task / Bug / Event + 状态 + 迭代归属 |

*最后更新：2026-10-22*