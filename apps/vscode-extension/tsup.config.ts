import { build as buildEsbuildBundle } from "esbuild";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

// 当前扩展包根目录。
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

// 用于按包名解析 workspace 包资源的 require。
const requireFromConfig = createRequire(import.meta.url);

// ui-handdrawn 构建产物目录（按包名解析，避免硬编码 monorepo 相对路径）。
const UI_HANDDRAWN_DIST_DIRECTORY = dirname(
  requireFromConfig.resolve("@scribdown/ui-handdrawn/styles.css")
);

// Webview 运行时资源目录。
const WEBVIEW_UI_DIST_DIRECTORY = resolve(PACKAGE_ROOT, "dist/webview-ui");

// Webview runtime 打包入口文件路径。
const WEBVIEW_RUNTIME_ENTRY_FILE_PATH = resolve(PACKAGE_ROOT, "src/webview/runtime.ts");

// 复制到扩展包内的 Webview runtime 文件名。
const WEBVIEW_RUNTIME_FILE_NAME = "preview-runtime.global.js";

// Webview runtime 产物完整路径。
const WEBVIEW_RUNTIME_OUTPUT_FILE_PATH = resolve(
  WEBVIEW_UI_DIST_DIRECTORY,
  WEBVIEW_RUNTIME_FILE_NAME
);

/**
 * 校验 Webview 资源准备条件。
 */
async function ensureWebviewBuildPrerequisites(): Promise<void> {
  try {
    // 校验 ui-handdrawn 产物是否存在，避免打包出空样式。
    await access(UI_HANDDRAWN_DIST_DIRECTORY);
  } catch {
    throw new Error(
      "Missing @scribdown/ui-handdrawn build artifacts. Run `pnpm --filter @scribdown/ui-handdrawn build` first."
    );
  }

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

  // 先清空旧资源，避免遗留历史文件。
  await rm(WEBVIEW_UI_DIST_DIRECTORY, { recursive: true, force: true });
  await mkdir(WEBVIEW_UI_DIST_DIRECTORY, { recursive: true });
  // 关键步骤：复制 styles.css 与 assets/* 到扩展 dist，供 Webview 直接加载。
  await cp(UI_HANDDRAWN_DIST_DIRECTORY, WEBVIEW_UI_DIST_DIRECTORY, { recursive: true });

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
    minify: process.env.NODE_ENV === "production"
  });
}

/**
 * VS Code 扩展构建配置：
 * - 产物为 CJS 单文件（VS Code 主进程只支持 CJS）
 * - bundle 模式将 workspace 包一并打入，发布到 marketplace 时不依赖 node_modules
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
  minify: process.env.NODE_ENV === "production",
  onSuccess: prepareWebviewUiAssets
});
