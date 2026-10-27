import { cx } from "./cx";
import { Icon } from "./Icon";
import { t } from "../i18n";

interface Props {
  deadlineAlert: number;
  deadlineOnly: boolean;
  onToggleDeadline: () => void;
  categories: string[];
  category: string;
  onCategory: (category: string) => void;
  query: string;
  onQuery: (query: string) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
}

/** 아래에 떠 있는 도구 바. 검색, 마감 필터, 분류 필터 */
export function FilterBar(props: Props) {
  if (props.searchOpen) {
    return (
      <div className="tt-bar" role="search">
        <span className="tt-bar-icon">
          <Icon name="search" />
        </span>
        <input
          type="search"
          autoFocus
          placeholder={t("bar.searchPlaceholder")}
          aria-label={t("bar.search")}
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") props.onSearchOpen(false);
          }}
        />
        <button
          type="button"
          className="clickable-icon"
          aria-label={t("bar.searchClose")}
          onClick={() => {
            props.onQuery("");
            props.onSearchOpen(false);
          }}
        >
          <Icon name="x" />
        </button>
      </div>
    );
  }
  return (
    <div className="tt-bar" role="toolbar">
      <button type="button" className={cx("clickable-icon", props.query !== "" && "is-active")} aria-label={t("bar.search")} onClick={() => props.onSearchOpen(true)}>
        <Icon name="search" />
      </button>
      <span className="tt-bar-sep" />
      <button type="button" className={cx("clickable-icon", props.deadlineOnly && "is-active")} aria-pressed={props.deadlineOnly} onClick={props.onToggleDeadline}>
        <Icon name="flag" />
        {t("bar.deadline", { n: props.deadlineAlert })}
      </button>
      <select className="dropdown" aria-label={t("bar.category")} value={props.category} onChange={(e) => props.onCategory(e.target.value)}>
        <option value="">{t("bar.category")}</option>
        {props.categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
