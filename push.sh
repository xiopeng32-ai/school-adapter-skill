#!/usr/bin/env bash
# 一键推送脚本（需要 GitHub Personal Access Token，含 repo 权限）
#
# 用法：
#   GITHUB_TOKEN=ghp_xxx ./push.sh <你的GitHub用户名> [仓库名]
#
# 例：
#   GITHUB_TOKEN=ghp_xxx ./push.sh xiopeng32-ai school-adapter-skill

set -e
USER_NAME="${1:?请提供 GitHub 用户名}"
REPO="${2:-school-adapter-skill}"
TOKEN="${GITHUB_TOKEN:?请设置 GITHUB_TOKEN 环境变量}"

# 1) 创建仓库（已存在会返回 422，忽略）
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO\",\"description\":\"把开源校园 App 迁移到任意高校：正方教务接口、字段映射、21 条踩坑与验收清单\",\"private\":false}" \
  > /dev/null || true

# 2) 推送（用 token 走 https）
git init -q 2>/dev/null || true
git add -A
git -c user.name="$USER_NAME" -c user.email="$USER_NAME@users.noreply.github.com" \
  commit -m "feat: 校园 App 学校适配指南（正方教务 + 鸿蒙多端）" 2>/dev/null || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://${USER_NAME}:${TOKEN}@github.com/${USER_NAME}/${REPO}.git"
git push -u origin main

echo "✅ 已推送：https://github.com/${USER_NAME}/${REPO}"
