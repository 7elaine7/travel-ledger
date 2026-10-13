#!/bin/bash
# 用途：启动一个新任务。读状态、定位任务、拼开场白。
# 用法：./tools/start-task.sh "PENDING #16 载录保存逻辑"

cd "$(dirname "$0")/.."

TASK="$1"

if [ -z "$TASK" ]; then
  echo "用法：./tools/start-task.sh \"<任务描述>\""
  echo "例如：./tools/start-task.sh \"PENDING #16 载录保存逻辑\""
  exit 1
fi

echo "=================================================="
echo "  项目：travel-ledger"
echo "  任务：${TASK}"
echo "=================================================="
echo ""

echo "## 当前进度"
echo "---"
sed -n '/## 二、当前到哪了/,/## 三/p' docs/CURRENT_STATE.md 2>/dev/null | head -8
echo ""

echo "## 相关待办"
echo "---"
# 如果任务含 "PENDING #数字" 或 "#数字"，精确搜 "| 数字 |"
NUM=$(echo "$TASK" | grep -oE '#[0-9]+' | head -1 | tr -d '#')
if [ -n "$NUM" ]; then
  HIT=$(grep -E "^\| *${NUM} *\|" docs/PENDING.md 2>/dev/null)
  if [ -n "$HIT" ]; then
    echo "[PENDING #${NUM}]"
    echo "$HIT"
  else
    echo "（PENDING 里未找到 #${NUM}，可能是新任务）"
  fi
else
  # 没有 #数字，用任务名做关键词模糊搜
  echo "（任务里无 #编号，按关键词搜 PENDING/BACKLOG）"
  grep -i "$TASK" docs/PENDING.md BACKLOG.md 2>/dev/null | head -3 || echo "（未找到）"
fi
echo ""

echo "## 可用 Skill"
echo "---"
ls docs/skills/ 2>/dev/null || echo "（skills 目录还没建）"
echo ""

# 判断是否匹配 skill 关键词
SKILL_NAME=""
if echo "$TASK" | grep -qiE "拆|拆分|story"; then
  SKILL_NAME="按 story-splitting.md 拆"
elif echo "$TASK" | grep -qiE "ac|验收标准"; then
  SKILL_NAME="按 ac-writing.md 写"
elif echo "$TASK" | grep -qiE "review|审查"; then
  SKILL_NAME="按 code-review.md 做"
elif echo "$TASK" | grep -qiE "死 css|死样式|死样式|cleanup"; then
  SKILL_NAME="按 cleanup-dead-css.md 做"
elif echo "$TASK" | grep -qiE "retro|复盘"; then
  SKILL_NAME="按 retro.md 做"
fi

echo "=================================================="
echo "  给 AI 的开场白（复制下面这段）："
echo "=================================================="
echo ""
if [ -n "$SKILL_NAME" ]; then
  echo "读 AGENTS.md，然后 ${SKILL_NAME} ${TASK}。"
else
  echo "读 AGENTS.md，然后 ${TASK}。"
fi
echo ""
echo "=================================================="