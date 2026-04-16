import { ReactElement, ReactNode } from "react";
import { DEFAULT_THEME, PROJECT_NAME } from "@scribdown/shared";

/**
 * 手绘容器组件参数。
 */
export interface HanddrawnCardProps {
  title: string;
  children: ReactNode;
}

/**
 * 渲染手绘风格卡片。
 * @param props 组件参数，包含标题与内容。
 * @returns React 元素。
 */
export function HanddrawnCard(props: HanddrawnCardProps): ReactElement {
  // 统一标题文案，避免页面硬编码应用名。
  const headingText = `${PROJECT_NAME} · ${props.title}`;

  // 统一数据属性值，便于后续主题扩展。
  const themeName = DEFAULT_THEME;

  return (
    <section className="scribdown-card" data-theme={themeName}>
      <h2>{headingText}</h2>
      <div>{props.children}</div>
    </section>
  );
}
