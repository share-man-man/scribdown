import { defineConfig } from "wxt";

/** 扩展图标目录，WXT 会从 public 目录复制到最终扩展包。 */
const EXTENSION_ICON_DIRECTORY = "icons";
/** Markdown 页面拦截和 viewer 注入所允许的 URL 匹配范围。 */
const MARKDOWN_HOST_MATCHES = ["http://*/*.md", "https://*/*.md", "file:///*"];
/** viewer 和动态渲染资源可以被 Markdown 页面加载的匹配范围。 */
const WEB_ACCESSIBLE_MATCHES = ["http://*/*", "https://*/*", "file:///*"];

/** 浏览器扩展的 WXT 配置。package.json 是唯一版本号来源。 */
export default defineConfig({
  manifestVersion: 3,
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      port: 9173,
      strictPort: true
    }
  },
  manifest: {
    default_locale: "en",
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    permissions: ["storage", "alarms"],
    host_permissions: MARKDOWN_HOST_MATCHES,
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    },
    action: {
      default_icon: {
        "16": `${EXTENSION_ICON_DIRECTORY}/icon-16.png`,
        "32": `${EXTENSION_ICON_DIRECTORY}/icon-32.png`,
        "48": `${EXTENSION_ICON_DIRECTORY}/icon-48.png`,
        "128": `${EXTENSION_ICON_DIRECTORY}/icon-128.png`
      }
    },
    icons: {
      "16": `${EXTENSION_ICON_DIRECTORY}/icon-16.png`,
      "32": `${EXTENSION_ICON_DIRECTORY}/icon-32.png`,
      "48": `${EXTENSION_ICON_DIRECTORY}/icon-48.png`,
      "128": `${EXTENSION_ICON_DIRECTORY}/icon-128.png`
    },
    web_accessible_resources: [
      {
        matches: WEB_ACCESSIBLE_MATCHES,
        resources: ["viewer.html", "assets/*", "content-scripts/*"]
      }
    ]
  },
  // 关键步骤：显式指向 public，保证 locale 与图标均作为扩展静态资源复制。
  publicDir: "public"
});
