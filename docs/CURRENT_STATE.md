> ⚠️ 开工第一件事：读 PROJECT_BRIEF.md 第 6.5-D 条——禁止 node/npm/无头浏览器/自动化验证。

# 轨迹 · 项目入口
更新日期：2026-09-26

> 新对话窗口第一件事：读完本文件，再按"文档索引"读需要的文件。

## 一、项目是什么
纯本地、无后端、离线可用的语音旅行记账 PWA。可分发、可离线、数据不出设备。


## 二、当前到哪了
- Sprint 3 全部完成（S3-01~S3-08），已 Retro
- Sprint 4 拆分方案已敲定（2026-09-26 人拍板）：S4-A 载录表单+预填 → S4-B 缮录归帙保存链 → S3-09 编辑/删除（不重拆），见 SPRINTS.md Sprint 4 章节
- 下一步：从 S4-A 开工（等开工指令；改 js/ 前按规矩先报函数清单）


## 三、MVP 收尾清单（按顺序）
1. 视觉静态稿 6 屏全部完成（首页✅ / 载录✅ / 账簿✅ / 游笺✅ / 驿站✅ / 轨迹✅ ）
2. UI 批处理（BACKLOG B-32）
3. 真机集中测（BACKLOG B-45 gate + B-49 托管方案）
4. 最终 Project Retro

## 四、文档索引
| 文件 | 管什么 | 什么时候读 |
|---|---|---|
| PROJECT_BRIEF.md | 技术约束、数据模型、禁令 | 改技术/数据时 |
| DESIGN_SPEC.md | 色板、字体、尺寸、组件、页面结构 | 改 UI 时 |
| SPRINTS.md | Sprint 计划、Story AC、完成记录、决策记录 | 追溯"为什么这么做" |
| BACKLOG.md | B-xx 编号的已知问题 | 查待办 |
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
| 2026-09-17 | 账簿页文案定为「往事可稽 来路有迹」；查/清按钮红色=激活状态指示（列表态默认查红，空状态可隐藏或变灰） | DESIGN_SPEC 5 / 3.4 |
| 2026-09-17 | 地标简笔分两级：图标级（4-8 笔，归档 assets/icons/landmarks-icon/）与装饰级（10-20 笔，轨迹图/页面装饰用） | DESIGN_SPEC 2.10 |
| 2026-09-19 | db v3：entries 加 location/note 字段（不建索引） | PROJECT_BRIEF 7.1 |
| 2026-09-19 | 分类源头归一 8→6：parser 改 6 键 + db v4 迁移旧数据 | PROJECT_BRIEF 8 节 + SPRINTS S3-02 |
| 2026-09-19 | 多账户→单账户模式（UI 不暴露 ownerId，数据结构保留） | BRIEF 第 2 节 + SPRINTS S3-04 + DESIGN_SPEC 3.1 |
| 2026-09-19 | 首页=记 tab 默认页；载录页为模态页（无 tab）+ ← 返回入口 | DESIGN_SPEC 3.2/3.3 + SPRINTS S3-04 |
| 2026-09-20 | S3-08 阅踪页决策：筛选交互（原生 date + datalist 精确匹配）、空态统一、日期带年份、强制四字段非空 | DESIGN_SPEC 3.3/3.5/3.9 + BRIEF v1.11 |
| 2026-09-20 | 地点兜底词改"在途" + 旅程规则（自动快照、不命名、不往前找） | DESIGN_SPEC 3.10 + BRIEF v1.12 |
| 2026-09-26 | Sprint 4 拆分拍板：S4-A/S4-B 切分与 AC、S3-09 排位其后；地点/日期解析不做；BRIEF 禁令 4 与 DESIGN_SPEC 209 修订文案通过（落地随 S4-B） | SPRINTS.md Sprint 4 章节 |

## 六、稳定技术路线
- 手绘线条：SVG 内联 + stroke-dasharray + 轻微 feTurbulence
- 字体：本地 @font-face（演示佛系体 / 思印宋 / 系统栈）
- 装饰：PNG 素材（印章、卡片边框）
- 文字不抖，抖动只作用在线条上
- 色板：纸底 #f5efe3 / 墨色 #3b362f / 朱砂 #b0483a / 苔绿 #7d8c6f / 赭石 #c9a227 / 黛蓝 #9fb3c0 / 杏橘 #d98e5f / 辅助灰 #8a8578

## 七、新窗口开场白（复制用）
> 项目路径：~/Desktop/project/travel-ledger
> 先读 docs/CURRENT_STATE.md，再按需读 PROJECT_BRIEF.md / DESIGN_SPEC.md / SPRINTS.md / BACKLOG.md。
> 当前任务：[填你要做的]
