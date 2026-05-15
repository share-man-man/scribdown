import { build as buildEsbuildBundle } from "esbuild";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

// 当前扩展包根目录。
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

// 用于按包名解析 workspace 包资源的 require。
const requireFromConfig = createRequire(import.meta.url);

// ui-handdrawn 样式入口（JIT 模式下解析到包内 src/styles.css）。
const UI_HANDDRAWN_STYLES_ENTRY_FILE_PATH = requireFromConfig.resolve(
  "@scribdown/ui-handdrawn/styles.css"
);

// Webview 运行时资源目录。
const WEBVIEW_UI_DIST_DIRECTORY = resolve(PACKAGE_ROOT, "dist/webview-ui");

// Webview runtime 打包入口文件路径。
const WEBVIEW_RUNTIME_ENTRY_FILE_PATH = resolve(PACKAGE_ROOT, "src/webview/runtime.ts");

// Webview 样式产物完整路径。
const WEBVIEW_STYLE_OUTPUT_FILE_PATH = resolve(WEBVIEW_UI_DIST_DIRECTORY, "styles.css");

// Webview runtime 产物完整路径。
const WEBVIEW_RUNTIME_OUTPUT_FILE_PATH = resolve(
  WEBVIEW_UI_DIST_DIRECTORY,
  "preview-runtime.global.js"
);

// 是否为生产构建。
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

/**
 * 校验 Webview 资源准备条件。
 */
async function ensureWebviewBuildPrerequisites(): Promise<void> {
  try {
    // 校验 runtime 入口是否存在，避免生成空壳脚本。
    await access(WEBVIEW_RUNTIME_ENTRY_FILE_PATH);
  } catch {
    throw new Error(
      "Missing VS Code webview runtime entry. Ensure `apps/vscode-extension/src/webview/runtime.ts` exists."
    );
  }
}

/**
 * 准备 Webview 运行时资源（样式 + runtime 脚本）。
 */
async function prepareWebviewUiAssets(): Promise<void> {
  await ensureWebviewBuildPrerequisites();

  // 关键步骤：用 esbuild 内联 ui-handdrawn 的 @import 分文件，
  // 并把 url() 引用的 SVG 拷贝到 dist/webview-ui/assets，供 Webview 单文件加载。
  await buildEsbuildBundle({
    entryPoints: [UI_HANDDRAWN_STYLES_ENTRY_FILE_PATH],
    outfile: WEBVIEW_STYLE_OUTPUT_FILE_PATH,
    bundle: true,
    loader: { ".svg": "file" },
    assetNames: "assets/[name]",
    legalComments: "none",
    minify: IS_PRODUCTION_BUILD
  });

  // 关键步骤：将 runtime.ts 打包为 IIFE，供 Webview 以 script 标签加载。
  await buildEsbuildBundle({
    entryPoints: [WEBVIEW_RUNTIME_ENTRY_FILE_PATH],
    outfile: WEBVIEW_RUNTIME_OUTPUT_FILE_PATH,
    bundle: true,
    format: "iife",
    globalName: "ScribdownPreviewRuntime",
    platform: "browser",
    target: ["es2020"],
    sourcemap: false,
    legalComments: "none",
    minify: IS_PRODUCTION_BUILD
  });
}

/**
 * VS Code 扩展构建配置：
 * - 产物为 CJS 单文件（VS Code 主进程只支持 CJS）
 * - bundle 模式将 workspace 包（JIT 源码）一并打入，发布到 marketplace 时不依赖 node_modules
 * - vscode 模块由宿主提供，必须 external
 */
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node18",
  bundle: true,
  skipNodeModulesBundle: false,
  noExternal: ["@scribdown/shared", "@scribdown/markdown-renderer"],
  external: ["vscode"],
  sourcemap: true,
  clean: true,
  minify: IS_PRODUCTION_BUILD,
  onSuccess: prepareWebviewUiAssets
});
