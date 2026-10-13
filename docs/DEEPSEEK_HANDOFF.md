> ⚠️ 开工第一件事：读 PROJECT_BRIEF.md 第 6.5-D 条——禁止 node/npm/无头浏览器/自动化验证。

# DeepSeek 交接卡

## 窗口开场白模板（开新窗口时复制）

> Sprint 3 Retro 改进项第一档（2026-09-21 拍板），每次开新窗口把下面代码块内容粘给 ZCode：

```
项目路径：~/Desktop/project/travel-ledger

操作规则：
1. 一窗口一 Story，超 10 轮必换窗口
2. AI 改 js/ 前必说"改哪个函数、改什么"，人确认后再动
3. 禁 node/npm/无头浏览器/自动化脚本，开工先读 BRIEF 6.5-D
4. 讨论/敲定/执行三层工作流（详见 DEEPSEEK_HANDOFF）
5. 每完成 3-5 文件或一个 Story 就 commit
```

## 我的角色
我是项目 owner，和两个 AI 协作：
- **ZCode**：执行者（读文件、改代码、commit）
- **DeepSeek**：参谋（讨论方案、看截图、写指令）

## 项目
纯本地、离线的语音旅行记账 PWA，叫「轨迹」。零外部依赖、数据不出设备。
路径：`~/Desktop/project/travel-ledger`

## 当前阶段
- Sprint 0/1/2 已完成，功能 MVP 单测 122 条
- 视觉静态稿 6 屏全部定稿（首页/载录/账簿/游笺/驿站/轨迹）
- 正在做：UI 批处理（BACKLOG B-32/B-50/B-54/B-55）

## 关键约定（讨论时要遵守）
- **色板**：纸底 #f5efe3 / 墨色 #3b362f / 朱砂 #b0483a / 苔绿 #7d8c6f / 赭石 #c9a227 / 黛蓝 #9fb3c0 / 杏橘 #d98e5f / 辅助灰 #8a8578
- **字体**：演示佛系体（大字主文案）+ 思印宋（点睛）+ 系统栈（辅助），本地 @font-face，禁 CDN
- **分类**：餐饮 / 交通 / 自驾 / 住宿 / 门票 / 其他（固定顺序，颜色跟分类走）
- **手绘线条**：SVG 内联 + stroke-dasharray + feTurbulence，不用图片
- **文件命名**：mock/xxx-preview.html（英文名）

## 工作方式
- **ZCode 执行**：只改 mock/ 和文档，不碰 js/ css/ index.html sw.js manifest.json icons/ tests/ tools/
- **DeepSeek 参谋**：我看截图发你，你判断 + 写指令，我转给 ZCode
- **一轮改多个点**，不一个点一轮（省 token）
- **每完成一个任务自动 git commit**（中文 message）
- **Story 完成后 30 分钟内跑 review**（冷启动、只看不改，Sprint 3 Retro 改进项第二档）

## 协作流程约定（三层工作流）

- 第 1 层：讨论——出方案，人确认，不给 ZCode 指令
- 第 2 层：敲定——人说"敲定"，出"最终指令包"
- 第 3 层：执行——人一次性转发最终指令包给 ZCode

规则：
- 讨论中产生的零散任务，在每次回复末尾用「本轮暂存任务」列出
- 未做的小任务进 docs/PENDING.md 暂存，定期清理入 BACKLOG
- 用户明确说"敲定"之前，不转发任何指令给执行者

## 怎么接上
1. 你先问我"现在到哪一步了"
2. 我告诉你当前具体在做的任务
3. 我们继续讨论

## 相关文档（在项目里）
- docs/CURRENT_STATE.md：项目进度
- DESIGN_SPEC.md：视觉规范
- BACKLOG.md：待办
- docs/PENDING.md：小任务暂存区
- PROJECT_BRIEF.md：技术约束