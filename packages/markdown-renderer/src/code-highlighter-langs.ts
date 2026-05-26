import type { LanguageRegistration } from "shiki/core";

/**
 * 单个 grammar 模块的默认导出形态。
 * `@shikijs/langs/<id>` 默认导出形如 `LanguageRegistration[]`。
 */
type GrammarModule = { default: LanguageRegistration[] };

/**
 * 懒加载注册表中的语言导入函数。
 * 调用时返回 grammar 模块，再交由 highlighter.loadLanguage 注册。
 */
type GrammarLoader = () => Promise<GrammarModule>;

/**
 * 高亮器初始化时即刻拉取的语言（覆盖 .md 文档中最高频的代码块语种）。
 * 使用动态 import 而非 静态 import：grammar JSON 仍作为独立 chunk 异步加载，
 * 不会内联进主 bundle，但 createHighlighterCore 会并发 await 全部，渲染前已就绪。
 */
export const CODE_HIGHLIGHTER_EAGER_LOADERS: GrammarLoader[] = [
  () => import("@shikijs/langs/bash"),
  () => import("@shikijs/langs/css"),
  () => import("@shikijs/langs/diff"),
  () => import("@shikijs/langs/html"),
  () => import("@shikijs/langs/javascript"),
  () => import("@shikijs/langs/json"),
  () => import("@shikijs/langs/markdown"),
  () => import("@shikijs/langs/typescript"),
  () => import("@shikijs/langs/yaml")
];

/**
 * 懒加载语言注册表：id 归一化（小写）→ 动态 import 函数。
 * 仅列出此处的语言会被 Vite 打成异步 chunk；其他语言会回退为纯文本。
 * 同一 grammar 的多个别名指向同一 import，避免重复 chunk。
 * 已在 eager 列表中的语言不需要在此重复（其 grammar 自带的 aliases 会在 loadLanguage 时一并注册）。
 */
export const CODE_HIGHLIGHTER_LAZY_LANGS: Record<string, GrammarLoader> = {
  // 前端框架与扩展
  jsx: () => import("@shikijs/langs/jsx"),
  tsx: () => import("@shikijs/langs/tsx"),
  vue: () => import("@shikijs/langs/vue"),
  svelte: () => import("@shikijs/langs/svelte"),
  astro: () => import("@shikijs/langs/astro"),
  mdx: () => import("@shikijs/langs/mdx"),
  // 样式
  scss: () => import("@shikijs/langs/scss"),
  sass: () => import("@shikijs/langs/sass"),
  less: () => import("@shikijs/langs/less"),
  postcss: () => import("@shikijs/langs/postcss"),
  stylus: () => import("@shikijs/langs/stylus"),
  // 查询 / 数据 / 标记
  graphql: () => import("@shikijs/langs/graphql"),
  gql: () => import("@shikijs/langs/graphql"),
  sql: () => import("@shikijs/langs/sql"),
  xml: () => import("@shikijs/langs/xml"),
  regexp: () => import("@shikijs/langs/regexp"),
  regex: () => import("@shikijs/langs/regexp"),
  // 系统语言
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  "c++": () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  cs: () => import("@shikijs/langs/csharp"),
  java: () => import("@shikijs/langs/java"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  rs: () => import("@shikijs/langs/rust"),
  swift: () => import("@shikijs/langs/swift"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  kt: () => import("@shikijs/langs/kotlin"),
  scala: () => import("@shikijs/langs/scala"),
  "objective-c": () => import("@shikijs/langs/objective-c"),
  objc: () => import("@shikijs/langs/objective-c"),
  "objective-cpp": () => import("@shikijs/langs/objective-cpp"),
  // 脚本语言
  python: () => import("@shikijs/langs/python"),
  py: () => import("@shikijs/langs/python"),
  ruby: () => import("@shikijs/langs/ruby"),
  rb: () => import("@shikijs/langs/ruby"),
  perl: () => import("@shikijs/langs/perl"),
  lua: () => import("@shikijs/langs/lua"),
  powershell: () => import("@shikijs/langs/powershell"),
  ps: () => import("@shikijs/langs/powershell"),
  ps1: () => import("@shikijs/langs/powershell"),
  fish: () => import("@shikijs/langs/fish"),
  php: () => import("@shikijs/langs/php"),
  r: () => import("@shikijs/langs/r"),
  // 配置 / 数据
  toml: () => import("@shikijs/langs/toml"),
  ini: () => import("@shikijs/langs/ini"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
  docker: () => import("@shikijs/langs/dockerfile"),
  makefile: () => import("@shikijs/langs/make"),
  make: () => import("@shikijs/langs/make"),
  cmake: () => import("@shikijs/langs/cmake"),
  nginx: () => import("@shikijs/langs/nginx"),
  properties: () => import("@shikijs/langs/properties"),
  dotenv: () => import("@shikijs/langs/dotenv"),
  hcl: () => import("@shikijs/langs/hcl"),
  terraform: () => import("@shikijs/langs/terraform"),
  tf: () => import("@shikijs/langs/terraform"),
  nix: () => import("@shikijs/langs/nix"),
  json5: () => import("@shikijs/langs/json5"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  csv: () => import("@shikijs/langs/csv"),
  tsv: () => import("@shikijs/langs/tsv"),
  // 函数式 / 其他
  dart: () => import("@shikijs/langs/dart"),
  elixir: () => import("@shikijs/langs/elixir"),
  erlang: () => import("@shikijs/langs/erlang"),
  haskell: () => import("@shikijs/langs/haskell"),
  hs: () => import("@shikijs/langs/haskell"),
  clojure: () => import("@shikijs/langs/clojure"),
  clj: () => import("@shikijs/langs/clojure"),
  ocaml: () => import("@shikijs/langs/ocaml"),
  fsharp: () => import("@shikijs/langs/fsharp"),
  vb: () => import("@shikijs/langs/vb"),
  asm: () => import("@shikijs/langs/asm"),
  llvm: () => import("@shikijs/langs/llvm"),
  solidity: () => import("@shikijs/langs/solidity"),
  prisma: () => import("@shikijs/langs/prisma"),
  proto: () => import("@shikijs/langs/proto"),
  // 文档标记
  latex: () => import("@shikijs/langs/latex"),
  tex: () => import("@shikijs/langs/latex"),
  asciidoc: () => import("@shikijs/langs/asciidoc"),
  adoc: () => import("@shikijs/langs/asciidoc"),
  // 着色器 / 二进制
  glsl: () => import("@shikijs/langs/glsl"),
  wasm: () => import("@shikijs/langs/wasm"),
  wat: () => import("@shikijs/langs/wasm")
};
