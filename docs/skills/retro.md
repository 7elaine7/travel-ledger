# Skill: retro

## 什么时候用
- Sprint 结束时
- 项目阶段性收尾时
- 出现重大事故后（紧急 Retro）

## 前置条件
- 本 Sprint 的所有 commit 都在 git log 里
- 有实验记录 / PENDING 变更 / SPRINTS 完成记录

## 步骤

### 1. 收集数据（AI 自动做）
- git log --oneline <sprint 起止> — 本 Sprint 所有 commit
- git diff --stat — 改动规模
- docs/PENDING.md 的归档区 — 本 Sprint 关了哪些
- 单测总数变化 — 从多少变多少

### 2. 结构化输出

输出格式（不要嵌套代码块，直接写）：

    # Sprint <N> Retrospective
    
    ## 一、Sprint 概览
    - 时间：<起止日期>
    - Story：S<N>-01 ~ S<N>-XX
    - 提交数：约 X 条 commit
    
    ## 二、完成清单
    表格：Story | 内容 | 完成日
    
    ## 三、关键成果
    - 数据化成果（如"单测从 X 变 Y"）
    
    ## 四、遇到的坑
    1. 具体的坑 + 根因
    
    ## 五、有效的做法
    1. 具体做法 + 为什么有效
    
    ## 六、下 Sprint 改进项（分三档）
    - 第一档：立即生效（写进 AGENTS.md 或开场白）
    - 第二档：人自律（写进检查清单）
    - 第三档：待条件（下个 Sprint 处理）

### 3. 强制检查点
- 改进项不超过 5 条（多了没人做）
- 每条改进项必须可验证（下次 Retro 时能判断做没做）
- Retro 文档进 git，作为历史

### 4. 落档位置
- docs/SPRINT<N>_RETRO.md — 完整 Retro 文档
- 改进项同步到 AGENTS.md（第一档）

## 已知陷阱
- Retro 变成吐槽会：只讨论"下次怎么改"，不追究"谁的责任"
- 改进项太虚："加强沟通"不是改进项，"每日站会每人 1 分钟"是
- 不做 Retro：跳过 Retro 的代价，会在下一个 Sprint 加倍还