#!/usr/bin/env bash
# 由 design/logo/logo.svg 派生各扩展所需的图标产物，作为唯一图标源。
# 浏览器插件需要 16/32/48/128 多尺寸 PNG；VS Code 需要 128 PNG（Marketplace）和原始 SVG（命令图标）。
# 当前依赖 macOS 自带的 qlmanage 做 SVG→PNG 渲染（与项目设定的开发环境一致）。

set -euo pipefail

# 关键步骤：将相对路径锚定到仓库根目录，避免在子目录执行时找不到资源。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SVG="$ROOT_DIR/design/logo/logo.svg"

if [[ ! -f "$SOURCE_SVG" ]]; then
  echo "[build-icons] 找不到源 SVG: $SOURCE_SVG" >&2
  exit 1
fi

if ! command -v qlmanage >/dev/null 2>&1; then
  echo "[build-icons] 需要 macOS 的 qlmanage 工具来渲染 SVG → PNG" >&2
  exit 1
fi

# 浏览器扩展工具栏 + manifest icons 字段所需的尺寸集合。
BROWSER_SIZES=(16 32 48 128)
BROWSER_OUT="$ROOT_DIR/apps/browser-extension/icons"
# VS Code Marketplace 推荐 128×128 PNG；命令图标使用 SVG 即可由 VS Code 自适应缩放。
VSCODE_OUT="$ROOT_DIR/apps/vscode-extension/assets"

mkdir -p "$BROWSER_OUT" "$VSCODE_OUT"

# qlmanage 只能输出到目录内的 `<filename>.png`，需要先渲染再重命名。
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for size in "${BROWSER_SIZES[@]}"; do
  qlmanage -t -s "$size" -o "$TMP_DIR" "$SOURCE_SVG" >/dev/null
  mv "$TMP_DIR/logo.svg.png" "$BROWSER_OUT/icon-$size.png"
done

# VS Code Marketplace icon。
qlmanage -t -s 128 -o "$TMP_DIR" "$SOURCE_SVG" >/dev/null
mv "$TMP_DIR/logo.svg.png" "$VSCODE_OUT/icon.png"

# 原始 SVG 复制到 vscode-extension 资源目录，用于命令栏图标（VS Code 支持 SVG）。
cp "$SOURCE_SVG" "$VSCODE_OUT/icon.svg"

echo "[build-icons] 已更新："
echo "  - $BROWSER_OUT/icon-{${BROWSER_SIZES[*]// /,}}.png"
echo "  - $VSCODE_OUT/icon.png"
echo "  - $VSCODE_OUT/icon.svg"
