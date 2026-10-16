> ⚠️ 开工第一件事：读 PROJECT_BRIEF.md 第 6.5-D 条——禁止 node/npm/无头浏览器/自动化验证。

# 轨迹 · 项目入口
更新日期：2026-10-16

> 新对话窗口第一件事：读完本文件，再按"文档索引"读需要的文件。

## 一、项目是什么
纯本地、无后端、离线可用的语音旅行记账 PWA。可分发、可离线、数据不出设备。

## 二、当前到哪了
- Sprint 3 全部完成（S3-01~S3-08），已 Retro
- Sprint 4 拆分方案已敲定（2026-09-26）：S4-A 载录表单+预填 → S4-B 缮录归帙保存链 → S3-09 编辑/删除（不重拆），见 SPRINTS.md Sprint 4 章节
- **Gitee 执行层已建立**（2026-10-16）：7 Epic + 22 Story + 36 Bug + 12 Event 全部录入，挂载完成
- 下一步：从 S4-A 开工（等开工指令；改 js/ 前按规矩先报函数清单）

## 三、MVP 收尾清单（按顺序）
1. 视觉静态稿 6 屏全部完成（首页✅ / 载录✅ / 账簿✅ / 游笺✅ / 驿站✅ / 轨迹✅ ）
2. UI 批处理（BACKLOG B-32）
3. 真机集中测（BACKLOG B-45 gate + B-49 托管方案）
4. 最终 Project Retro

## 四、文档索引
| 文件 | 管什么 | 什么时候读 |
|---|---|---|
| PROJECT_BRIEF.md | 技术约束、数据模型、禁令、Epic 列表、里程碑 | 改技术/数据时 |
| DESIGN_SPEC.md | 色板、字体、尺寸、组件、页面结构 | 改 UI 时 |
| WORKFLOW.md | 流程定义（阶段流转、待办归位、文档与 Gitee 关系） | Sprint 规划 / Story 启动 / 处理变更时 |
| SPRINTS.md | Sprint 计划、Story AC、完成记录、决策记录 | 追溯"为什么这么做" |
| BACKLOG.md | Product Backlog（未拆 Epic / 已拆未排期 Story / B-xx） | 查待办 |
| AGENTS.md | AI 协作规则 | 开工前 |
| docs/CURRENT_STATE.md | 本文件 | 每次新窗口 |

## 五、最近决策变更
| 日期 | 变更 | 落档位置 |
|---|---|---|
| 2026-09-16 | 抖动方案作废，改为 SVG 线条 + PNG 装饰 | DESIGN_SPEC 2.3 |
| 2026-09-16 | 字体改本地 @font-face（佛系体/思印宋/系统栈） | DESIGN_SPEC 2.2 |
| 2026-09-16 | 尺寸改用 Keynote 坐标 ×0.3611 换算 | DESIGN_SPEC 9 |
| 2026-09-17 | 分类定 6 项：餐饮/交通/自驾/住宿/门票/其他 | DESIGN_SPEC 3.3.1 |
| 2026-09-17 | 载录页按钮改「缮录归帙」 | DESIGN_SPEC 5 |
| 2026-09-17 | 错落文案字号规则建立 | DESIGN_SPEC 5.1 |
| 2026-09-17 | 账簿页文案定为「往事可稽 来路有迹」 | DESIGN_SPEC 5 / 3.4 |
| 2026-09-17 | 地标简笔分两级：图标级（4-8 笔）与装饰级（10-20 笔） | DESIGN_SPEC 2.10 |
| 2026-09-19 | db v3：entries 加 location/note 字段（不建索引） | PROJECT_BRIEF 7.1 |
| 2026-09-19 | 分类源头归一 8→6：parser 改 6 键 + db v4 迁移旧数据 | PROJECT_BRIEF 8 节 + SPRINTS S3-02 |
| 2026-09-19 | 多账户→单账户模式（UI 不暴露 ownerId，数据结构保留） | BRIEF 第 2 节 + SPRINTS S3-04 + DESIGN_SPEC 3.1 |
| 2026-09-19 | 首页=记 tab 默认页；载录页为模态页（无 tab）+ ← 返回入口 | DESIGN_SPEC 3.2/3.3 + SPRINTS S3-04 |
| 2026-09-20 | S3-08 阅踪页决策：筛选交互、空态统一、日期带年份、强制四字段非空 | DESIGN_SPEC 3.3/3.5/3.9 + BRIEF v1.11 |
| 2026-09-20 | 地点兜底词改"在途" + 旅程规则（自动快照、不命名、不往前找） | DESIGN_SPEC 3.10 + BRIEF v1.12 |
| 2026-09-26 | Sprint 4 拆分拍板：S4-A/S4-B 切分与 AC、S3-09 排位其后；地点/日期解析不做；BRIEF 禁令 4 与 DESIGN_SPEC 209 修订文案通过（落地随 S4-B） | SPRINTS.md Sprint 4 章节 |
| 2026-10-16 | **引入 Gitee 作为执行层**：三层架构（方案层文档 / 执行层 Gitee / 校验层快照）；所有工作项录入 Gitee；Task 持久化 | WORKFLOW.md 二 + AGENTS.md 九 |
| 2026-10-16 | **BACKLOG.md 重构为 Product Backlog**：分三块（未拆 Epic / 已拆未排期 Story / B-xx）；归档区独立 | BACKLOG.md |
| 2026-10-16 | **PENDING.md 清空**：所有暂存任务已导入 Gitee 作为 Event | PENDING.md |
| 2026-10-16 | **BRIEF 补 E-06 / E-07**：Epic 列表补齐 7 个；新增 9.3 里程碑 | PROJECT_BRIEF 9.1 / 9.3 |
| 2026-10-16 | **AGENTS 硬约束加边界**：node/npm 禁令仅限项目代码开发，工具链配置不受限 | AGENTS.md 二 |

## 六、稳定技术路线
- 手绘线条：SVG 内联 + stroke-dasharray + 轻微 feTurbulence
- 字体：本地 @font-face（演示佛系体 / 思印宋 / 系统栈）
- 装饰：PNG 素材（印章、卡片边框）
- 文字不抖，抖动只作用在线条上
- 色板：纸底 #f5efe3 / 墨色 #3b362f / 朱砂 #b0483a / 苔绿 #7d8c6f / 赭石 #c9a227 / 黛蓝 #9fb3c0 / 杏橘 #d98e5f / 辅助灰 #8a8578

## 七、Gitee 执行层
- 企业：Elaine Dev Studio（ID: 17143908）
- 项目：Travel Ledger（项目编号: TL）
- 工作项视图：https://e.gitee.com/elaine-dev-studio/projects/915516/issues
- 当前工作项：7 Epic + 22 Story + 36 Bug + 12 Event
- 操作方式：AI 通过 MCP 读写（见 WORKFLOW.md 二）

## 八、新窗口开场白（复制用）
> 项目路径：~/Desktop/project/travel-ledger-publish
> 先读 docs/CURRENT_STATE.md，再按需读 PROJECT_BRIEF.md / WORKFLOW.md / DESIGN_SPEC.md / SPRINTS.md / BACKLOG.md / AGENTS.md。
> 当前任务：[填你要做的]