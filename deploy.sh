#!/usr/bin/env bash
# ============================================================
# 小小棋盘 · Cloudflare Pages 一键部署
# 用法:
#   bash deploy.sh              # 部署/更新线上站点
#   bash deploy.sh "版本说明"    # 带版本说明部署
#
# 前置条件（二选一）:
#   1) 已登录: npx wrangler login   (浏览器授权，一次即可)
#   2) 有 API Token: export CLOUDFLARE_API_TOKEN=你的令牌
#      令牌获取: Cloudflare 控制台 -> My Profile -> API Tokens
#      -> Create Token -> 模板 "Cloudflare Pages — Edit"
# ============================================================
set -e
cd "$(dirname "$0")"

PROJECT="${CLOUDFLARE_PROJECT:-kidboard}"
STAGING=".deploy"

echo "==> [1/2] 收集部署文件到 $STAGING/ ..."
rm -rf "$STAGING"
mkdir -p "$STAGING"
# 只发布运行所需的文件（.workbuddy、.shots 等一律不发布）
cp index.html manifest.webmanifest sw.js _headers "$STAGING/"
cp -r css js "$STAGING/"

echo "==> [2/2] 部署到 Cloudflare Pages (项目: $PROJECT) ..."
npx wrangler pages deploy "$STAGING" --project-name "$PROJECT" --commit-dirty=true "$@"

echo ""
echo "✅ 部署完成！访问地址见上方输出 (形如 https://$PROJECT.pages.dev)"
echo "   提示: 首次部署后如需绑定自定义域名，去 Cloudflare 控制台 Pages 项目设置里添加。"
