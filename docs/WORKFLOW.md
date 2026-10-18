# 项目流程定义

> 本文件定义本项目「怎么推进一个任务」。AGENTS.md 管约束（不能做什么），本文件管流程（什么时候做什么）。

## 一、项目层级结构

| 层级 | 定义 | 存放位置 |
|------|------|---------|
| Epic | 大功能方向（骨架），可跨多个 Sprint | `BACKLOG.md` 的 Epic 池 |
| Story | 能独立验收的交付单位 | `BACKLOG.md` 的候选池（未排期） / `SPRINTS.md`（已排期） |
| Task | Story 内的具体执行步骤 | Gitee（持久化） |

**核心原则**：
1. **Epic 不是排期的单位，Story 才是。** 一个 Epic 会横跨多个 Sprint（如 E-02 跨越 Sprint 1 和 Sprint 4）。同一个 Epic 下的不同 Story，优先级可以完全不同。
2. **Sprint 是从候选池里选 Story，而不是选 Epic。**
3. **单人项目执行策略**：Sprint 开始前，确认所有 Story，并统一拆完所有 Task。Sprint 执行期间，不再轻易变更 Task。

**Gitee 工作项类型结构**：
- **需求（大类）**：Epic（顶层） → Story（挂 Epic 下） → Task（挂 Story 下）
- **任务（大类）**：Bug（缺陷） / Event（独立任务）

---

## 二、文档与 Gitee 的关系

| 层 | 内容 | 维护方式 |
|---|---|---|
| 方案层（source of truth） | BACKLOG.md（需求池）/ SPRINTS.md（迭代计划）/ PROJECT_BRIEF.md（宪法） | AI 维护，人审 diff 后确认 |
| 执行层（Gitee） | Epic / Story / Task / Bug / Event + 状态 | AI 通过 MCP 同步 |
| 校验层（漂移检测） | SNAPSHOT.json（Gitee 实际状态） | 脚本定期导出，对比本地方案 |

**原则**：文档是方案，Gitee 是执行。方案 → Gitee 单向同步。本地 BACKLOG.md 作为保底收敛。

**各文件定位**：
- `PROJECT_BRIEF.md`：项目宪法 + 宏观目标（不维护详细的 Epic 和 Sprint 计划）。
- `BACKLOG.md`：Product Backlog（需求池）。包含：未拆的 Epic + 已拆的 Story 候选池 + B-xx 待办。
- `SPRINTS.md`：Sprint 规划（本迭代的 Story 列表 / AC / 完成记录）。
- `PENDING.md`：零散暂存。
- `Gitee`：执行层工作项。

---

## 三、拆解时机

### 时机 1：Epic 拆 Story（临近排期时，提前 1-2 个 Sprint）

**谁做**：人 + 主 AI
**时机**：该 Epic 预计在 1-2 个 Sprint 内要启动时。
**动作**：
1. 从 `BACKLOG.md` 的「Epic 流动池」中，挑出临近排期的 Epic。
2. 将其拆解为多个 Story（每个 Story 可独立验收）。
3. 每个 Story 写 AC、评估依赖、定优先级。
4. 将这些 Story 放入 `BACKLOG.md` 的「Story 候选池」。
5. 如果 Epic 彻底拆完，从流动池标记为已拆解。

**约束**：
- Story 必须能独立验收（Independent）。
- Story 必须对用户有价值（Valuable）。
- Story 必须足够小，一个迭代内能完成（Small）。
- AC 必须可验证、无模糊词。

### 时机 2：Story 拆 Task（Sprint 规划时，Sprint 启动前）

**谁做**：主 AI 出计划，人确认
**时机**：Sprint 启动前（与 Story 选入 Sprint 同步完成）。
**动作**：
1. 主 AI 读本次 Sprint 选中的所有 Story + AC + 相关代码。
2. 一次性出所有 Story 的实现计划（Task 列表 + 顺序 + 风险 + 证明测试）。
3. 人确认计划。
4. Task 全部录入 Gitee（挂对应 Story 下）。

**约束**：计划未确认，不许写代码。Task 是执行最小单位，Sprint 启动后不允许随意变更。

---

## 四、工作流三层（讨论 / 敲定 / 执行）

| 层 | 谁做 | 干什么 |
|---|---|---|
| **讨论** | 人 + DeepSeek | 出方案，人确认。不给执行 AI 指令 |
| **敲定** | 人 | 说"敲定"，出"最终指令包" |
| **执行** | ZCode 等执行 AI | 一次性转发最终指令包，按包执行 |

**禁止跳层**：讨论中不派活；执行中不改需求。

---

## 五、阶段流转（Story 启动到关闭）

| 阶段 | 动作 | 产出 |
|------|------|-----------|
| 1. Plan | 规划阶段确认 Task（记录在 SPRINTS） | SPRINTS.md 中的 Task 列表 |
| 2. Build | 执行 AI 写代码 + 单测 | Diff + 单元测试 |
| 3. Test | 人浏览器验收 + 独立 Review | 验收记录 + review 报告 |
| 4. 合入 | commit + 更新文档 + 更新 Gitee 状态 | Git commit + Gitee 更新 |
| 5. 关闭 | 更新 SPRINTS + 提取经验 | 完成记录 |

**约束**：禁止跳阶段。Sprint 启动前 Task 必须定死。

---

## 六、完成定义（DoD）

**Story 完成的标准 = 以下全部满足**：
1. 所有 Task 已确认完成（Gitee 状态核对）
2. 代码完成 + 单测全绿（人手动跑 `tests/tests.html`）
3. AC 全部通过（人浏览器验收）
4. 独立 Review 通过（冷启动）
5. 改动已 commit
6. 文档已同步（SPRINTS / CURRENT_STATE / PENDING）
7. 验收记录已写

**7 条全满足，Story 才算关闭。**
**Task 完成标准**：代码写完 + 单测通过 + 不破坏其他 Task。

---

## 七、待办归位链

| 容器 | 职责 | 存放位置 | 更新时机 |
|------|------|---------|---------|
| PENDING | 零散任务 | `PENDING.md` | 随时 |
| BACKLOG | 需求池（未拆 Epic + 未排期 Story + 未排期问题） | `BACKLOG.md` | Sprint 规划时清理 |
| SPRINTS | 本 Sprint 的 Story + AC + **Task 计划** + 完成记录 | `SPRINTS.md` | Sprint 规划会 + Story 关闭时 |

**归位链**：PENDING → BACKLOG（候选池） → SPRINTS（选定 Story，并在 `.md` 中拆解出 Task，确认迭代目标列表） → Gitee（执行 Task）。

---

## 八、变更处理流程

无论是新增需求、高优先级 Bug，还是对当前 Sprint 已有 Story/Task 的修改，统一走以下流程：

### 步骤 1：登记并评估
- 评估该变更对当前 Sprint 目标的影响。
- 如果导致当前 Sprint 无法完成，或当前 Story 优先级降低，**直接将原 Story 或任务踢回 `BACKLOG.md` 重新排队**，保护当前 Sprint 范围的稳定（拒绝范围蠕动）。

### 步骤 2：进入 BACKLOG 重新竞争
- 所有被踢回的、或新来的变更，一律进入 `BACKLOG.md`。
- 在 Sprint 规划时，按优先级重新和池子里的其他项竞争。

### 步骤 3：P0 紧急变更的人拍板
- 如果是极端紧急的线上 Bug（P0），属于 L3 决策，由人直接拍板插队进入当前 Sprint。
- 必须更新 `SPRINTS.md` + `CURRENT_STATE.md` + Gitee。

---

## 九、人在流程中的介入点

| 介入点 | 级别 | 动作 |
|--------|------|------|
| Sprint 规划：Story 选入与 Task 拆解 | L3 | 确认 Story 与 Task 合理 |
| Story 验收 | L3 | 浏览器实测，判断 AC 是否满足 |
| Sprint 计划变更（如踢回旧任务、P0插队） | L3 | P0 变更、优先级调整 |
| 不可逆操作 | L4 | 人 + 会签 |

**每个 Story 三个闸门**：Plan Gate（规划时） / Review Gate（验收时） / Close Gate（关闭时）。

---

## 十、Sprint 边界动作

1. 检查 PENDING，清理入 BACKLOG。
2. 检查 BACKLOG，按优先级重排。
3. 回顾本次 Sprint，写 Retro。
4. 提取可复用方法沉淀到 docs/skills/。
5. **规划下个 Sprint**：
   - **步骤 A**：检查 `BACKLOG.md` 的 Epic 池，如果里面有临近排期的 Epic，先将其拆成 Story 放入候选池，并排好优先级。
   - **步骤 B**：从候选池（包含 Story 和问题）中，按优先级选出下个 Sprint 要做的内容。
6. 为选中的 Story 出实现计划，**拆完所有 Task 并写入 `SPRINTS.md`**。
7. 同步 Gitee：建立迭代，将选中的 Story 和 Task 刷新到 Gitee。

---

## 十一、与其他文档的关系

| 文档 | 关系 |
|------|------|
| AGENTS.md | 管约束；本文件管流程 |
| PROJECT_BRIEF.md | 项目宪法 + 宏观目标 |
| docs/SPRINTS.md | Sprint 迭代计划（方案层） |
| docs/BACKLOG.md | Product Backlog（未拆 Epic + 未排期story + 未排期问题） |
| docs/status/PENDING.md | 零散暂存区 |
| Gitee | 执行层 |
| SNAPSHOT.json | 校验层 |

---

## 十二、一句话

**AGENTS.md 管红线，本文件管路线。**
**Epic 拆 Story 在临近排期时；Story 选入 Sprint 在 Sprint 规划时；Story 拆 Task 在 Sprint 启动前。**
**Sprint 排期选的是 Story，不是 Epic。所有变更退回 Backlog 重新排队。**
**DoD 7 条满足，Story 才算关闭。**

*最后更新：2026-10-18*