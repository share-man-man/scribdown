// 依据 @scribdown/shared 的文案目录（唯一源）生成两处静态清单的本地化文件：
//   1. 浏览器扩展 Chrome i18n：apps/browser-extension/public/_locales/<dir>/messages.json
//   2. VS Code 扩展 nls：apps/vscode-extension/package.nls[.<suffix>].json
// 生成结果需提交到仓库。修改 messages.ts 中 manifest.* 文案后，运行 `pnpm run sync:i18n` 重新生成。
//
// 依赖 @scribdown/shared 的构建产物（dist）：运行前须先 `pnpm --filter @scribdown/shared build`，
// 根脚本 sync:i18n 已串联该步骤。

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHROME_LOCALE_DIRECTORY,
  DEFAULT_LOCALE,
  MESSAGES,
  SUPPORTED_LOCALES,
  VSCODE_NLS_SUFFIX
} from "../packages/shared/dist/index.js";

/** 当前脚本所在目录，作为仓库路径解析基准。 */
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
/** 仓库根目录。 */
const repositoryRoot = resolve(scriptDirectory, "..");

/**
 * Chrome `__MSG_<key>__` 占位键 → 共享文案目录 key 的映射。
 * 键名须符合 Chrome 约束（仅 [A-Za-z0-9_@]，不能含点号）。
 */
const CHROME_MESSAGE_KEY_MAP = {
  extName: "manifest.browserName",
  extDescription: "manifest.browserDescription"
};

/**
 * VS Code `%key%` 占位键 → 共享文案目录 key 的映射。
 */
const VSCODE_NLS_KEY_MAP = {
  displayName: "manifest.vscodeDisplayName",
  description: "manifest.vscodeDescription",
  "command.openPreview.title": "manifest.vscodeCommandTitle"
};

/** 生成文件的统一头注释键，提示勿手改。 */
const GENERATED_HINT = "此文件由 scripts/sync-i18n-manifests.mjs 生成，请勿手改。";

/**
 * 把对象序列化为带尾换行的两空格缩进 JSON。
 * @param {unknown} value 待序列化对象。
 * @returns {string} JSON 文本。
 */
function toJsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * 生成浏览器扩展的 Chrome _locales messages.json。
 * @returns {Promise<string[]>} 已写入的文件路径列表。
 */
async function syncChromeLocales() {
  /** _locales 根目录。 */
  const localesRoot = resolve(repositoryRoot, "apps/browser-extension/public/_locales");
  /** 已写入路径累积。 */
  const writtenPaths = [];

  // 关键步骤：先清空旧目录，避免删除语言后残留孤儿文件。
  await rm(localesRoot, { recursive: true, force: true });

  for (const locale of SUPPORTED_LOCALES) {
    /** 该语言的 Chrome 目录名（下划线写法）。 */
    const directoryName = CHROME_LOCALE_DIRECTORY[locale];
    /** 该语言目标目录。 */
    const localeDirectory = resolve(localesRoot, directoryName);
    /** Chrome messages.json 内容。 */
    const chromeMessages = {};

    for (const [chromeKey, catalogKey] of Object.entries(CHROME_MESSAGE_KEY_MAP)) {
      chromeMessages[chromeKey] = { message: MESSAGES[locale][catalogKey] };
    }

    await mkdir(localeDirectory, { recursive: true });
    /** messages.json 绝对路径。 */
    const messagesPath = resolve(localeDirectory, "messages.json");
    await writeFile(messagesPath, toJsonText(chromeMessages), "utf8");
    writtenPaths.push(messagesPath);
  }

  return writtenPaths;
}

/**
 * 生成 VS Code 扩展的 package.nls[.<suffix>].json。
 * @returns {Promise<string[]>} 已写入的文件路径列表。
 */
async function syncVscodeNls() {
  /** VS Code 扩展根目录。 */
  const extensionRoot = resolve(repositoryRoot, "apps/vscode-extension");
  /** 已写入路径累积。 */
  const writtenPaths = [];

  for (const locale of SUPPORTED_LOCALES) {
    /** 该语言 nls 文件名后缀（默认语言为空）。 */
    const suffix = VSCODE_NLS_SUFFIX[locale];
    /** nls 文件名：默认语言写 package.nls.json，其余写 package.nls.<suffix>.json。 */
    const fileName = suffix ? `package.nls.${suffix}.json` : "package.nls.json";
    /** nls 文件内容。 */
    const nlsMessages = { "//": GENERATED_HINT };

    for (const [nlsKey, catalogKey] of Object.entries(VSCODE_NLS_KEY_MAP)) {
      nlsMessages[nlsKey] = MESSAGES[locale][catalogKey];
    }

    /** nls 文件绝对路径。 */
    const nlsPath = resolve(extensionRoot, fileName);
    await writeFile(nlsPath, toJsonText(nlsMessages), "utf8");
    writtenPaths.push(nlsPath);
  }

  return writtenPaths;
}

/**
 * 入口：并行生成两处清单本地化文件并打印结果。
 */
async function main() {
  const [chromePaths, vscodePaths] = await Promise.all([syncChromeLocales(), syncVscodeNls()]);

  // 关键步骤：打印相对路径，便于确认生成范围与提交内容。
  for (const filePath of [...chromePaths, ...vscodePaths]) {
    console.log(`generated: ${filePath.replace(`${repositoryRoot}/`, "")}`);
  }
  console.log(`默认兜底语言：${DEFAULT_LOCALE}`);
}

await main();
