import { ReactElement } from "react";
import { PROJECT_NAME } from "@scribdown/shared";
import "@scribdown/ui-handdrawn/styles.css";

/**
 * 扩展 popup 配置页面。
 * 当前为占位阶段，各渲染参数待规划后补充。
 * @returns React 元素。
 */
export function Popup(): ReactElement {
  return (
    <main className="scribdown-popup">
      <header className="scribdown-popup__header">
        <span className="scribdown-popup__logo">✏️</span>
        <h1 className="scribdown-popup__title">{PROJECT_NAME}</h1>
      </header>

      <section className="scribdown-popup__section">
        <h2 className="scribdown-popup__section-title">渲染参数</h2>
        <ul className="scribdown-popup__list">
          <li className="scribdown-popup__item scribdown-popup__item--placeholder">
            <span className="scribdown-popup__item-label">主题</span>
            <span className="scribdown-popup__item-badge">待定</span>
          </li>
          <li className="scribdown-popup__item scribdown-popup__item--placeholder">
            <span className="scribdown-popup__item-label">字体</span>
            <span className="scribdown-popup__item-badge">待定</span>
          </li>
          <li className="scribdown-popup__item scribdown-popup__item--placeholder">
            <span className="scribdown-popup__item-label">代码高亮</span>
            <span className="scribdown-popup__item-badge">待定</span>
          </li>
          <li className="scribdown-popup__item scribdown-popup__item--placeholder">
            <span className="scribdown-popup__item-label">安全过滤</span>
            <span className="scribdown-popup__item-badge">待定</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
