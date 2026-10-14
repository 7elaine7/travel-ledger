# AGENTS.md — AI 协作规则

> **所有 AI 工具（ZCode / DeepSeek / Cursor / Claude Code）进入本项目前必须读此文件。**
> 人用的说明在 README.md；本文件是给 AI 的"入职手册"。

---

## 一、开工前必做（3 步）

1. 读 `PROJECT_BRIEF.md` 第 6.5-D 条（禁 node/npm/无头浏览器/自动化脚本）
2. 读 `docs/CURRENT_STATE.md`（当前进度快照）
3. 读本文件全部规则 + `docs/PENDING.md` 的"当前暂存"

---

## 二、硬约束（违反即视为失败）

**禁止的命令**：
- `rm` / `curl` / `wget` / `sudo`
- `pip install` / `npm install` / `brew install`
- `git push`（本地 commit 允许）
- `node` / `npm` / `npx` / 无头浏览器 / CDP / 自动化脚本
- `osascript` / 访问 `~/Library`

**开发纪律**：
- 改 `js/` 前必说"改哪个函数、改什么"，人确认后再动
- 每改 3-5 个文件或完成一个 Story 就 commit（中文 message）
- 单元测试由**人手动跑**（Safari 打开 `tests/tests.html`），AI 不代跑
- 改完立刻 `git diff` 贴给人看
- 禁一切自动化验证（包括"我自己截个图看"）

---

## 三、工作流三层（讨论 / 敲定 / 执行）

| 层 | 谁做 | 干什么 |
|---|---|---|
| **讨论** | 人 + DeepSeek | 出方案，人确认。不给执行 AI 指令 |
| **敲定** | 人 | 说"敲定"，出"最终指令包" |
| **执行** | ZCode 等执行 AI | 一次性转发最终指令包，按包执行 |

**禁止跳层**：讨论中不派活；执行中不改需求。

---

## 四、文档结构（各管什么）

| 文件 | 职责 | 谁读 |
|---|---|---|
| `PROJECT_BRIEF.md` | 技术约束（宪法） | AI 开工前 |
| `DESIGN_SPEC.md` | 视觉规范 | 涉及 UI 时 |
| `docs/CURRENT_STATE.md` | 进度快照 | AI 每次新窗口 |
| `BACKLOG.md` | B-xx 编号待办 | 排期时 |
| `docs/PENDING.md` | 讨论中产生的零散待办 | AI 开工前 |
| `SPRINTS.md` | Sprint 记录 + Retro | Sprint 边界 |

---

## 五、可用 Skill（必须加载）

【强制动作】开工前必须执行 2 步：

第 1 步：执行 ls docs/skills/，列出全部 skill 文件。

第 2 步：判断任务类型，按下表**必须加载**对应 skill：
| 如果任务是… | 必须读 |
|---|---|
| 拆 Story | docs/skills/story-splitting.md |
| 写 AC | docs/skills/ac-writing.md |
| Story 完成后 Review | docs/skills/code-review.md |
| 清理死 CSS | docs/skills/cleanup-dead-css.md |
| 多步任务（3 步以上） | docs/skills/state-sync.md |
| Sprint 结束 | docs/skills/retro.md |

【硬规则】未加载对应 skill 就开始执行 = 违反 AGENTS.md。

新增 skill 文件后，不用手动改本表——AI 靠 ls 发现。

---

## 六、新窗口开场白模板

**AI 工具新开窗口时，人只需发一句**：

> 读 AGENTS.md，然后按 <skill 文件名> 处理：<具体任务>。

例如：
- `读 AGENTS.md，然后按 story-splitting.md 处理 PENDING #16。`
- `读 AGENTS.md，然后按 code-review.md 处理 S3-09 完成。`

**AI 收到后必须做的事**：
1. 读本文件 + 一、中列出的 3 个文档
2. 加载指定的 skill（通过 Skill 工具）
3. 复述你理解的任务
4. 等人类确认后再动手

【硬规则】开场白必须指定 skill，不指定时 AI 不会自动加载——这是 AI 的固有边界，不要依赖它。

---

## 七、遇到不确定时

- **规则没写清的** → 停下来问人，不猜
- **指令可能违反硬约束的** → 指出来，不硬做
- **发现指令里的错误** → 主动报告（这是加分的，不是越权）
- **发现文档滞后** → 报告，等人决定要不要更新

---

## 八、决策分级授权

| 级别 | 特征 | 谁拍 | 例子 |
|---|---|---|---|
| L1 | 有先例、可回滚 | AI 自动 | 代码格式化、rawText 存不存 |
| L2 | 中等风险 | AI 拍 + 人抽查 | 提示形式、命名风格 |
| L3 | 宪法级、价值判断 | 人拍 | BRIEF 修订、排期优先级 |
| L4 | 不可逆、影响面大 | 人 + 会签 | 数据库迁移、对外发布 |

**规则**：
- L1/L2 由 AI 拍，人只看结果
- L3 强制人拍，AI 只出方案
- L4 人 + 会签，AI 只能提供决策依据

**AI 遇决策时先自问**：
1. 这个决策属于几级？
2. 我有权拍吗？
3. 没权拍就停下来问人，不猜

---

## 状态同步机制（防人机状态漂移）

### 规则 1：多步任务必须有状态文件
- 任何 3 步以上的任务，AI 先建 docs/tasks/<任务名>.md
- 每步有状态：[ ] 未开始 / [~] 进行中 / [x] 完成
- 人做完后在对话里说，AI 立即更新状态文件

### 规则 2：AI 开工前必须先查状态
- 查 git log：这件事有 commit 吗？
- 查状态文件：当前到哪步？
- 查代码：改动是否已存在？
- **不要凭对话记忆判断**

### 规则 3：讨论结论必须落档才算定案
- 讨论完立刻写入文档
- 讨论没完，不改文档
- "我说了但没确认" ≠ 定案

### 规则 4：人做完必说，AI 必记
- 人做完后说"X 完成"
- AI 立即：更新状态文件 + git status 确认

---

## 十、文档同步规则

1. skill 文件增删后，AGENTS.md 的 skill 表不手动改——AI 靠 ls 动态发现
2. 对 BACKLOG.md 的增删改，必须同时按优先级重排全表（P0 > P1 > P2 > P3）
3. 对 PENDING.md 的增删改，同步更新"当前暂存"计数
4. Story 完成后，必须同步更新：SPRINTS.md + CURRENT_STATE.md + PENDING.md
5. SPRINTS.md 章节增删时，总览表必须同步（总览表行数 = 章节数）；
   CURRENT_STATE.md 文档索引变更时，DOCS_INDEX.md 必须同步

*最后更新：2026-09-22*