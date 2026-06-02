#!/usr/bin/env bash
# 由 design/logo/logo.svg 派生各扩展所需的图标产物，作为唯一图标源。
# 浏览器插件需要 16/32/48/128 多尺寸 PNG；VS Code 需要 128 PNG（Marketplace）和原始 SVG（命令图标）。
# 使用 rsvg-convert (librsvg) 做 SVG→PNG 渲染，默认保留透明背景；
# qlmanage 会强制合成白底，不满足透明需求。

set -euo pipefail

# 关键步骤：将相对路径锚定到仓库根目录，避免在子目录执行时找不到资源。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SVG="$ROOT_DIR/design/logo/logo.svg"

if [[ ! -f "$SOURCE_SVG" ]]; then
  echo "[build-icons] 找不到源 SVG: $SOURCE_SVG" >&2
  exit 1
fi

# 关键步骤：选择 SVG → PNG 渲染器。
# 优先 rsvg-convert（librsvg，本地命令，速度最快）；
# 未安装则回退到 npx @resvg/resvg-js-cli，避免开发者必须手动 brew install。
# 两者均默认保留 SVG 的透明背景，不会合成白底。
if command -v rsvg-convert >/dev/null 2>&1; then
  render_png() {
    local size="$1"
    local output_path="$2"
    rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" -o "$output_path"
  }
elif command -v npx >/dev/null 2>&1; then
  echo "[build-icons] 未检测到 rsvg-convert，回退至 npx @resvg/resvg-js-cli（首次会下载）"
  render_png() {
    local size="$1"
    local output_path="$2"
    npx --yes -p @resvg/resvg-js-cli resvg-js \
      --fit-width "$size" \
      "$SOURCE_SVG" "$output_path" >/dev/null
  }
else
  echo "[build-icons] 需要 rsvg-convert 或 npx，请安装其一：brew install librsvg / 启用 Node.js" >&2
  exit 1
fi

# 浏览器扩展工具栏 + manifest icons 字段所需的尺寸集合。
BROWSER_SIZES=(16 32 48 128)
BROWSER_OUT="$ROOT_DIR/apps/browser-extension/icons"
# VS Code Marketplace 推荐 128×128 PNG；命令图标使用 SVG 即可由 VS Code 自适应缩放。
VSCODE_OUT="$ROOT_DIR/apps/vscode-extension/assets"

mkdir -p "$BROWSER_OUT" "$VSCODE_OUT"

for size in "${BROWSER_SIZES[@]}"; do
  render_png "$size" "$BROWSER_OUT/icon-$size.png"
done

# VS Code Marketplace icon。
render_png 128 "$VSCODE_OUT/icon.png"

# 原始 SVG 复制到 vscode-extension 资源目录，用于命令栏图标（VS Code 支持 SVG）。
cp "$SOURCE_SVG" "$VSCODE_OUT/icon.svg"

echo "[build-icons] 已更新："
echo "  - $BROWSER_OUT/icon-{${BROWSER_SIZES[*]// /,}}.png"
echo "  - $VSCODE_OUT/icon.png"
echo "  - $VSCODE_OUT/icon.svg"
