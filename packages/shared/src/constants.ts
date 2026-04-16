import { PlatformType, ThemeType } from "./enums";

/**
 * 当前项目展示名称。
 */
export const PROJECT_NAME = "Scribdown";

/**
 * 当前项目固定 Node.js LTS 版本。
 */
export const NODE_LTS_VERSION = "24.15.0";

/**
 * 当前项目支持的平台列表。
 */
export const SUPPORTED_PLATFORMS: PlatformType[] = [
  PlatformType.BrowserExtension,
  PlatformType.VscodeExtension
];

/**
 * 当前项目默认主题。
 */
export const DEFAULT_THEME = ThemeType.Paper;

/**
 * VS Code 预览命令 ID。
 */
export const OPEN_PREVIEW_COMMAND = "scribdown.openPreview";

/**
 * 浏览器插件预览标题。
 */
export const BROWSER_PREVIEW_TITLE = "Browser Preview";

/**
 * VS Code 预览标题。
 */
export const VSCODE_PREVIEW_TITLE = "VS Code Preview";
