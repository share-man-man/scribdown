/// <reference types="vite/client" />
/// <reference types="chrome" />

// 声明 ?inline 查询的 CSS 模块返回字符串类型。
declare module "*?inline" {
  const content: string;
  export default content;
}
