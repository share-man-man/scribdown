/// <reference types="vite/client" />
/// <reference types="chrome" />

// 声明 ?inline 查询的 CSS 模块返回字符串类型。
declare module "*?inline" {
  const content: string;
  export default content;
}

// 声明 ?url 查询的静态资源模块返回构建后的资源 URL。
declare module "*?url" {
  const resourceUrl: string;
  export default resourceUrl;
}
