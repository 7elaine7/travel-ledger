#!/bin/bash
# 用途：启动一个新任务。读状态、定位任务、拼开场白。
# 用法：./tools/start-task.sh "S4-A 载录表单实装"

cd "$(dirname "$0")/.."

TASK="$1"

if [ -z "$TASK" ]; then
  echo "用法：./tools/start-task.sh \"<任务描述>\""
  echo "例如：./tools/start-task.sh \"S4-A 载录表单实装\""
  exit 1
fi

echo "=================================================="
echo "  项目：travel-ledger"
echo "  任务：${TASK}"
echo "=================================================="
echo ""

echo "## 当前进度"
echo "---"
# 读取最新 CURRENT_STATE 的状态
sed -n '/## 二、当前到哪了/,/## 三/p' docs/status/CURRENT_STATE.md 2>/dev/null | head -10
echo ""

echo "## 任务定位（SPRINTS / BACKLOG / PENDING）"
echo "---"
# 1. 优先在 SPRINTS 里找（因为这是当前在做的）
SPRINT_HIT=$(grep -i "$TASK" docs/SPRINTS.md 2>/dev/null | head -3)
if [ -n "$SPRINT_HIT" ]; then
  echo "[在 SPRINTS.md 找到]"
  echo "$SPRINT_HIT"
else
  # 2. 在 BACKLOG 里找（需求池）
  BACKLOG_HIT=$(grep -i "$TASK" docs/BACKLOG.md 2>/dev/null | head -3)
  if [ -n "$BACKLOG_HIT" ]; then
    echo "[在 BACKLOG.md 找到]"
    echo "$BACKLOG_HIT"
  else
    # 3. 在 PENDING 里找（暂存区）
    PENDING_HIT=$(grep -i "$TASK" docs/status/PENDING.md 2>/dev/null | head -3)
    if [ -n "$PENDING_HIT" ]; then
      echo "[在 PENDING.md 找到]"
      echo "$PENDING_HIT"
    else
      echo "（未在核心规划文件中找到匹配项，请确认任务名称）"
    fi
  fi
fi
echo ""

echo "## 可用 Skill"
echo "---"
ls docs/skills/ 2>/dev/null || echo "（skills 目录还没建）"
echo ""

# 判断是否匹配 skill 关键词
SKILL_PROMPT=""
if echo "$TASK" | grep -qiE "拆|拆分|story"; then
  SKILL_PROMPT="按 docs/skills/story-splitting.md 处理："
elif echo "$TASK" | grep -qiE "ac|验收标准"; then
  SKILL_PROMPT="按 docs/skills/ac-writing.md 处理："
elif echo "$TASK" | grep -qiE "review|审查"; then
  SKILL_PROMPT="按 docs/skills/code-review.md 处理："
elif echo "$TASK" | grep -qiE "死 css|死样式|cleanup"; then
  SKILL_PROMPT="按 docs/skills/cleanup-dead-css.md 处理："
elif echo "$TASK" | grep -qiE "retro|复盘"; then
  SKILL_PROMPT="按 docs/skills/retro.md 处理："
fi

echo "=================================================="
echo "  给 AI 的开场白（复制下面这段）："
echo "=================================================="
echo ""
if [ -n "$SKILL_PROMPT" ]; then
  echo "读 AGENTS.md，然后 ${SKILL_PROMPT}${TASK}。"
else
  echo "读 AGENTS.md，然后执行任务：${TASK}。（如果是改代码，请先读 docs/stories/ 对应方案）"
fi
echo ""
echo "=================================================="