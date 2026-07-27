// VS Code 扩展打包/发布的薄封装：从 apps/vscode-extension/package.json 的 `repository` 字段
// 推导 vsce 的图片与链接基址，避免把 GitHub 仓库地址硬编码进 npm script。
//
// 背景：vsce 会把 README 里的相对链接改写为绝对 URL，但它只认 `repository.url`（仓库根），
// 不认 `repository.directory`。本扩展位于 apps/vscode-extension 子目录，README 又引用了
// 目录之外的 ../docs/public/*.png，默认基址会让 `..` 吃掉 ref 段，最终 404。
// 因此这里把基址显式指到扩展子目录，使 README 中的相对路径能正确解析。
//
// 用法：node scripts/vsce.mjs <package|publish> [透传给 vsce 的其余参数]

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 当前脚本所在目录，作为仓库路径解析基准。 */
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
/** 仓库根目录。 */
const repositoryRoot = resolve(scriptDirectory, "..");
/** VS Code 扩展所在目录，vsce 需在此目录下执行。 */
const extensionDirectory = resolve(repositoryRoot, "apps/vscode-extension");
/** 允许透传的 vsce 子命令，防止脚本被当作任意命令入口。 */
const ALLOWED_SUBCOMMANDS = new Set(["package", "publish"]);
/** 基址使用的 Git ref：HEAD 跟随仓库默认分支，无需随分支改名同步。 */
const BASE_URL_REF = "HEAD";
/** GitHub 两类基址的路径段：raw 取文件原始内容（图片），blob 取文件浏览页（普通链接）。 */
const GITHUB_PATH_SEGMENT = {
  images: "raw",
  content: "blob"
};

/**
 * 从 package.json 的 repository 字段推导 GitHub 基址。
 * @param {{url?: string, directory?: string}} repository package.json 的 repository 字段
 * @param {string} pathSegment GITHUB_PATH_SEGMENT 之一，决定取 raw 还是 blob
 * @returns {string} 形如 https://github.com/<owner>/<repo>/<raw|blob>/HEAD/<directory> 的基址
 */
function resolveBaseUrl(repository, pathSegment) {
  /** 去掉 npm 惯用的 `git+` 前缀与 `.git` 后缀，得到可浏览的仓库地址。 */
  const webUrl = String(repository?.url ?? "")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(webUrl)) {
    throw new Error(`无法从 repository.url 推导 GitHub 地址：${repository?.url ?? "(缺失)"}`);
  }

  /** 扩展相对仓库根的子目录；缺省时退化为仓库根。 */
  const directory = repository?.directory ? `/${repository.directory.replace(/^\/|\/$/g, "")}` : "";
  return `${webUrl}/${pathSegment}/${BASE_URL_REF}${directory}`;
}

/** 命令行首个参数为 vsce 子命令，其余原样透传（如 --out）。 */
const [subcommand, ...forwardedArgs] = process.argv.slice(2);

if (!ALLOWED_SUBCOMMANDS.has(subcommand)) {
  console.error(`用法：node scripts/vsce.mjs <${[...ALLOWED_SUBCOMMANDS].join("|")}> [vsce 参数]`);
  process.exit(1);
}

/** 扩展清单，repository 字段是仓库地址的唯一来源。 */
const manifest = JSON.parse(readFileSync(resolve(extensionDirectory, "package.json"), "utf8"));
/** README 相对图片路径的解析基址。 */
const baseImagesUrl = resolveBaseUrl(manifest.repository, GITHUB_PATH_SEGMENT.images);
/** README 相对文件链接（如 ./LICENSE）的解析基址。 */
const baseContentUrl = resolveBaseUrl(manifest.repository, GITHUB_PATH_SEGMENT.content);

const result = spawnSync(
  "pnpm",
  [
    "dlx",
    "@vscode/vsce",
    subcommand,
    // monorepo 依赖由 pnpm 提升，vsce 无法解析，产物已由 tsup 打包为单文件
    "--no-dependencies",
    "--baseImagesUrl",
    baseImagesUrl,
    "--baseContentUrl",
    baseContentUrl,
    ...forwardedArgs
  ],
  { cwd: extensionDirectory, stdio: "inherit" }
);

process.exit(result.status ?? 1);
