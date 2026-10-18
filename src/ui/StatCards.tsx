import type { Counts } from "../logic/selectors";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { T } from "./strings";

export type Tab = "all" | "past" | "today" | "upcoming" | "records";
type CardTab = Exclude<Tab, "all">;

interface Props {
  counts: Counts;
  tab: Tab;
  /** 같은 카드를 다시 누르면 `all`이 넘어온다. */
  onSelect: (tab: Tab) => void;
}

export function StatCards({ counts, tab, onSelect }: Props) {
  const cards: { key: CardTab; label: string; num: number; caption: string; icon: string }[] = [
    { key: "past", label: T.stat.past, num: counts.past, caption: counts.stale > 0 ? T.stat.pastStale(counts.stale) : T.stat.pastEmpty, icon: "history" },
    { key: "today", label: T.stat.today, num: counts.today, caption: counts.doneToday > 0 ? T.stat.todayDone(counts.doneToday) : T.stat.todayEmpty, icon: "sun" },
    { key: "upcoming", label: T.stat.upcoming, num: counts.upcoming, caption: T.stat.upcomingCaption, icon: "calendar" },
    { key: "records", label: T.stat.records, num: counts.records, caption: T.stat.recordsCaption(counts.done, counts.cancelled), icon: "circle-check" },
  ];
  return (
    <div className="tt-stats">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          className={cx("tt-stat", tab === card.key && "is-active")}
          aria-pressed={tab === card.key}
          onClick={() => onSelect(tab === card.key ? "all" : card.key)}
        >
          <span className="tt-stat-label">
            {card.label}
            <span className="tt-stat-icon">
              <Icon name={card.icon} />
            </span>
          </span>
          <span className="tt-stat-num">{card.num}</span>
          <span className="tt-stat-caption">{card.caption}</span>
        </button>
      ))}
    </div>
  );
}
