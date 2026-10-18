#!/bin/bash
# 用途：Story 完成后同步状态。
# 用法：./tools/post-story.sh "S4-A" "载录表单实装"

set -e
cd "$(dirname "$0")/.."

STORY_ID="$1"
STORY_NAME="$2"

if [ -z "$STORY_ID" ] || [ -z "$STORY_NAME" ]; then
  echo "用法：./tools/post-story.sh \"<Story ID>\" \"<一句话描述>\""
  echo "例如：./tools/post-story.sh \"S4-A\" \"载录表单实装\""
  exit 1
fi

echo "=================================================="
echo "  Story 完成：$STORY_ID — $STORY_NAME"
echo "=================================================="
echo ""

echo "## 1. 当前改动"
echo "---"
git status --short
echo ""

echo "## 2. 最近 commit"
echo "---"
git log --oneline | head -3
echo ""

echo "## 3. 修改文件统计"
echo "---"
git diff --stat HEAD
echo ""

echo "=================================================="
echo "  下一步（手动/让 AI 执行）："
echo "=================================================="
echo ""
echo "1. 检查上面的改动是否符合预期"
echo "2. 跑单测（Safari 打开 tests/tests.html），确认全绿"
echo "3. 更新文档："
echo "   - docs/SPRINTS.md：标记该 Story 为已完成，补充完成记录"
echo "   - docs/status/CURRENT_STATE.md：更新第二节当前进度"
echo "   - docs/status/PENDING.md：如果该 Story 关了某个 PENDING 项，移入归档"
echo "4. 更新执行层（Gitee）："
echo "   - 将该 Story 及其下的所有 Task 状态改为已完成"
echo "5. commit："
echo ""
echo "   git add <相关文件>"
echo "   git commit -m \"$STORY_ID 完成：$STORY_NAME\""
echo ""
echo "6. 如果 Story 是大任务，跑一次 review（按 docs/skills/code-review.md）"
echo ""