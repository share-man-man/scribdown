import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

// 当前包根目录，供后续路径拼接使用。
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

// 入口样式文件，承担 @import 装配作用。
const ENTRY_CSS = resolve(PACKAGE_ROOT, "src/styles.css");

// 匹配入口里 `@import "./styles/xxx.css";` 的相对路径引用。
const IMPORT_RE = /@import\s+["']([^"']+)["'];?/g;

/**
 * 将入口 CSS 中的 @import 内联为单一文件，
 * 并把分文件里的 `../assets/` 路径修正回 `./assets/` 以适配 dist 平铺布局。
 *
 * @returns 内联后的完整 CSS 文本
 */
async function bundleStyles(): Promise<string> {
  // 读取入口文件，仅以纯文本方式处理 @import 行。
  const entrySource = await readFile(ENTRY_CSS, "utf8");

  // 收集所有 @import 引用的绝对路径，按出现顺序排列。
  const partialPaths: string[] = [];
  for (const match of entrySource.matchAll(IMPORT_RE)) {
    partialPaths.push(resolve(PACKAGE_ROOT, "src", match[1]));
  }

  // 依次读取分文件内容，并把 ../assets/ 修正为 ./assets/。
  const chunks = await Promise.all(
    partialPaths.map(async (path) => {
      const content = await readFile(path, "utf8");
      return content.replace(/url\(("|')\.\.\/assets\//g, "url($1./assets/");
    }),
  );

  // 用空行分隔每个分块，便于在 dist/styles.css 中区分来源。
  return chunks.join("\n");
}

/**
 * ui-handdrawn 构建配置：
 * 包内只对外提供样式与静态资源，没有 JS/TS 入口；
 * onSuccess 钩子负责把 src/styles/*.css 拼接为单一 dist/styles.css，
 * 并把 SVG 资源拷贝到 dist/assets。
 */
export default defineConfig({
  // 入口包含所有分文件，确保 watch 模式下任一分文件变更都会触发重建。
  entry: ["src/styles.css", "src/styles/*.css"],
  clean: false,
  async onSuccess() {
    // 先清空 dist，避免遗留旧资源。
    await rm("dist", { recursive: true, force: true });
    await mkdir("dist", { recursive: true });
    // 内联 @import 后写出单一样式文件，外部依赖只需引用 ./styles.css。
    await writeFile(resolve(PACKAGE_ROOT, "dist/styles.css"), await bundleStyles(), "utf8");
    // 拷贝 SVG 资源，保留 ./assets/* 的导出路径。
    await cp("src/assets", "dist/assets", { recursive: true });
  },
});
