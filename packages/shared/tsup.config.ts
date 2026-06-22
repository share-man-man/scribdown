import { defineConfig } from "tsup";

/**
 * @scribdown/shared 的构建配置。
 * 仅在「发布到 npm」时使用：把 TS 源码编译为 ESM + 类型声明，输出到 dist。
 * 本地开发仍走 package.json 的 exports（直指 src），无需先构建。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true, // 生成 .d.ts 类型声明
  clean: true, // 构建前清空 dist
  sourcemap: true,
});
