/**
 * 全局声明 CSS 资源模块类型，实际加载与处理由构建工具完成。
 */
declare module "*.css" {
  const cssPath: string;
  export default cssPath;
}
