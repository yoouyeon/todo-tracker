import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { t } from "../i18n";

interface Props {
  title: string;
  icon: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** 머리글 오른쪽에 놓는 도구(필터 칩 등) */
  tools?: ReactNode;
  /** 머리글 아래, 목록 위 안내 */
  hint?: ReactNode;
  children: ReactNode;
}

export function Section({ title, icon, count, collapsed, onToggle, tools, hint, children }: Props) {
  return (
    <section className="tt-section">
      <div className="tt-section-head">
        <span className="tt-section-icon">
          <Icon name={icon} />
        </span>
        <h3 className="tt-section-title">{title}</h3>
        <span className="tt-count">{count}</span>
        <div className="tt-section-tools">
          {tools}
          <button
            type="button"
            className={cx("clickable-icon", collapsed && "is-collapsed")}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("expand", { name: title }) : t("collapse", { name: title })}
            onClick={onToggle}
          >
            <Icon name="chevron-up" />
          </button>
        </div>
      </div>
      {!collapsed && hint}
      {!collapsed && children}
    </section>
  );
}
