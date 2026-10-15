# 项目流程定义

> 本文件定义本项目「怎么推进一个任务」。AGENTS.md 管约束（不能做什么），本文件管流程（什么时候做什么）。
> AGENTS.md 每次开工必读；本文件在「Sprint 规划 / Story 启动 / 处理变更」时读。

---

## 一、项目层级结构

```
Epic（史诗：一个大方向）
   ↓ 拆解（Sprint 规划时）
Story（故事：可独立交付的最小单位，带 AC）
   ↓ 拆解（Story 启动时）
Task（任务：实际执行粒度）
```

| 层级 | 定义 | 存放位置 |
|------|------|---------|
| Epic | 一个大功能方向（如"账户体系"、"表现层迁移"） | `PROJECT_BRIEF.md` 9.1 |
| Story | 能独立验收的最小交付单位（如 S4-A "载录页表单实装"） | `docs/SPRINTS.md` |
| Task | Story 内的具体执行步骤（如"改 parser.js"、"写 3 条单测"） | Story 启动时的 plan |

**本项目实际执行粒度 = Task 级**。Story 是交付单位，Task 是干活单位。

**单人项目 = 一个 Story 一个迭代**：一次只做一个 Story，避免多 Agent 撞车。多 Agent 并行只在 Story 内部（代码 Agent + 独立测试 Agent）。

---

## 二、拆解时机

### 时机 1：Epic 拆 Story（Sprint 规划时）

**谁做**：人 + 主 AI
**时机**：Sprint 规划会，**提前 1-2 个迭代拆**
**动作**：
1. 从 `PROJECT_BRIEF.md` 9.1 选本次要做的 Epic
2. 拆成多个 Story（每个 Story 可独立验收）
3. 每个 Story 写 AC（可 grep 验证）
4. 更新 `docs/SPRINTS.md`

**产出**：Sprint 的 Story 列表 + 每个 Story 的 AC

**约束**：
- 每个 Story 必须能独立验收
- AC 必须可验证、无模糊词

### 时机 2：Story 拆 Task（Story 启动时）

**谁做**：主 AI 出计划，人确认
**时机**：Story 启动
**动作**：
1. 主 AI 读 Story + AC + 相关代码
2. 出实现计划（Task 列表 + 顺序 + 风险 + 证明测试）
3. 人确认计划

**产出**：Task 级计划

**约束**：
- 计划未确认，不许开始写代码
- 计划必须包含"证明测试"

---

## 三、工作流三层（讨论 / 敲定 / 执行）

| 层 | 谁做 | 干什么 |
|---|---|---|
| **讨论** | 人 + DeepSeek | 出方案，人确认。不给执行 AI 指令 |
| **敲定** | 人 | 说"敲定"，出"最终指令包" |
| **执行** | ZCode 等执行 AI | 一次性转发最终指令包，按包执行 |

**禁止跳层**：讨论中不派活；执行中不改需求。

---

## 四、阶段流转（Story 启动到关闭）

| 阶段 | 输入 | 动作 | 产出 | 触发下一步 |
|------|------|------|------|-----------|
| 1. Plan | Story + AC | 主 AI 出计划，人确认 | plan（Task 列表 + 风险 + 测试） | 人确认后进入 Build |
| 2. Build | 已确认的 Plan | 执行 AI 写代码 + 单测 | Diff + 单元测试 | 本地自测全绿 |
| 3. Test | 代码 + AC | 人浏览器验收 + 独立 Review | 验收记录 + review 报告 | 人确认通过 |
| 4. 合入 | 通过验收的改动 | commit + 更新文档 | Git commit + 状态更新 | Story 关闭 |
| 5. 关闭 | 合入完成 | 更新 SPRINTS + 提取经验 | 完成记录 | 进入下一个 Story |

**约束**：禁止跳阶段。Plan 未确认，不许开始写代码。

---

## 五、完成定义（DoD）

**Story 完成的标准 = 以下全部满足**：

| # | 条件 | 验证方式 |
|---|------|---------|
| 1 | Plan 已确认 | 人签字（L3） |
| 2 | 代码完成 + 单测全绿 | 人手动跑 `tests/tests.html` |
| 3 | AC 全部通过 | 人浏览器验收 |
| 4 | 独立 Review 通过 | 冷启动 Review 报告 |
| 5 | 改动已 commit | `git log` 可查 |
| 6 | 文档已同步 | SPRINTS + CURRENT_STATE + PENDING 更新 |
| 7 | 验收记录已写 | 一段简短记录，含改动要点 |

**7 条全满足，Story 才算关闭。**

**Task 完成的标准**（比 Story 轻）：
- 代码写完
- 相关单测通过
- 不破坏其他 Task

**Story 关闭 = 所有 Task 完成 + DoD 7 条满足。**

---

## 六、待办归位链

三类待办容器，职责严格区分：

```
PENDING（零散想法，未归位）
   ↓ Sprint 规划时清理
BACKLOG（正式登记：B-xx 待办 + 优先级 P0-P3）
   ↓ Sprint 规划时选中 Epic（来自 PROJECT_BRIEF 9.1）
SPRINTS（本 Sprint 的 Story + AC）
   ↓ Story 启动时拆解
Task（实际执行粒度）
```

| 容器 | 职责 | 存放位置 | 更新时机 |
|------|------|---------|---------|
| PENDING | 讨论中冒出的零散任务 | `docs/status/PENDING.md` | 随时 |
| BACKLOG | 已知问题 + 优先级 | `docs/BACKLOG.md` | Sprint 规划时清理 |
| SPRINTS | 本 Sprint 的 Story + AC | `docs/SPRINTS.md` | Sprint 规划会 + Story 关闭时 |

**PENDING 的清理时机 = Sprint 规划时**，不是开工时。

**开工时读哪个**：
- 主读 `docs/SPRINTS.md`（这次做什么）
- **不读 PENDING**（它是待清理的暂存区，不是当前任务来源）

---

## 七、变更处理流程

突发变更（新需求、高优先级 bug、外部依赖变化）进来时：

### 步骤 1：先入 PENDING 或 BACKLOG

| 变更类型 | 登记位置 |
|---------|---------|
| 小改动、影响当前 Story | PENDING |
| 独立新需求、独立 bug | BACKLOG |

### 步骤 2：Sprint 规划时评估优先级

| 优先级 | 处理方式 |
|--------|---------|
| P3 / P2 | 排到后续 Sprint |
| P1 | 插入当前 Sprint 尾部 |
| P0（极紧急） | **触发修改当前 Sprint 计划** |

### 步骤 3：P0 变更需人拍板

**属于 L3 决策，必须人拍板**：

1. 主 AI 评估影响：会影响哪些进行中的 Story
2. 人拍板：插入 / 暂停当前 Story / 调整 Sprint 目标
3. 更新 `docs/SPRINTS.md` + `docs/status/CURRENT_STATE.md`

**禁止**：未经人拍板，AI 不得修改 SPRINT 计划。

---

## 八、人在流程中的介入点

按 AGENTS.md 第八节的 L1-L4 决策分级：

| 介入点 | 级别 | 动作 |
|--------|------|------|
| Sprint 规划：Epic 拆 Story | L3 | 确认拆解合理、AC 可验证 |
| Story 启动：Plan 确认 | L3 | 确认实现计划可行 |
| Story 验收 | L3 | 浏览器实测，判断 AC 是否满足 |
| Sprint 计划变更 | L3 | P0 变更、优先级调整 |
| 不可逆操作 | L4 | 人 + 会签 |

**每个 Story 三个闸门**：
1. **Plan Gate**：确认 AI 的计划
2. **Review Gate**：验收 AI 的产出
3. **Close Gate**：确认 DoD 满足

**其他时间**：AI 端到端跑，人只在上述节点出现。

---

## 九、Sprint 边界动作

每次 Sprint 结束时，按顺序做：

| # | 动作 | 产出 |
|---|------|------|
| 1 | 检查 PENDING，清理入 BACKLOG | 更新 PENDING + BACKLOG |
| 2 | 检查 BACKLOG，按优先级重排 | 更新 BACKLOG |
| 3 | 回顾本次 Sprint，写 Retro | 更新 SPRINTS 的 Retro 章节 |
| 4 | 提取可复用方法 | 沉淀到 docs/skills/ |
| 5 | 规划下个 Sprint：从 PROJECT_BRIEF 9.1 选 Epic，拆 Story | 更新 SPRINTS |

**PENDING 清理发生在第 1 步——Sprint 边界。**

---

## 十、与其他文档的关系

| 文档 | 关系 |
|------|------|
| AGENTS.md | 管约束；本文件管流程 |
| PROJECT_BRIEF.md | 管技术约束 + 测试规则（6.5）+ Epic 列表（9.1） |
| docs/SPRINTS.md | 本文件"待办归位链"目标容器 |
| docs/BACKLOG.md | 本文件"变更处理流程"入口 |
| docs/status/PENDING.md | 本文件"待办归位链"起点 |
| docs/skills/ | 本文件"阶段流转"过程中按任务类型加载 |
| tools/*.sh | 本文件"启动 / 收尾"动作的自动化脚本 |

---

## 十一、一句话

**AGENTS.md 管红线，本文件管路线。**

**层级：Epic（PROJECT_BRIEF 9.1）→ Story（SPRINTS）→ Task（plan）。**

**Epic 拆 Story 在 Sprint 规划时；Story 拆 Task 在 Story 启动时。**

**PENDING 在 Sprint 规划时清理；开工不读 PENDING。**

**DoD 7 条满足，Story 才算关闭。三个闸门：Plan Gate / Review Gate / Close Gate。**

*最后更新：2026-10-14*