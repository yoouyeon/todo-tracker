import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { MonthNoteSource } from "../data/taskStore";
import { addDays, formatLocalDate, formatLocalTime } from "../logic/dates";
import { formatLongDate } from "../logic/format";
import { buildBoard, type RecordStatusFilter, type TaskItem } from "../logic/selectors";
import { FilterBar } from "./FilterBar";
import type { AppHost } from "./host";
import { Icon } from "./Icon";
import { Section } from "./Section";
import { StatCards, type Tab } from "./StatCards";
import { T } from "./strings";
import { ProblemRow, TaskRow } from "./TaskRow";
import { useNow } from "./useNow";

export interface AppProps {
  store: MonthNoteSource;
  host: AppHost;
  /** 테스트에서 시각을 고정할 때 바꾼다. */
  getNow?: () => Date;
  /** 테스트에서 특정 탭으로 바로 열 때 바꾼다. */
  initialTab?: Tab;
}

const defaultNow = () => new Date();

export function App({ store, host, getNow = defaultNow, initialTab = "all" }: AppProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const now = useNow(getNow);
  const today = formatLocalDate(now);
  const time = formatLocalTime(now);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deadlineOnly, setDeadlineOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [recordStatus, setRecordStatus] = useState<RecordStatusFilter>("all");
  const [recordMonth, setRecordMonth] = useState("");

  const board = useMemo(
    () => buildBoard(snapshot.monthNotes, { today, time }, { deadlineOnly, category, query, recordStatus, recordMonth }),
    [snapshot.monthNotes, today, time, deadlineOnly, category, query, recordStatus, recordMonth],
  );

  if (!snapshot.loaded) {
    return (
      <div className="tt-view">
        <div className="tt-blank">{T.loading}</div>
      </div>
    );
  }

  const { counts } = board;
  const todayTotal = counts.today + counts.doneToday;
  const filtered = deadlineOnly || category !== "" || query.trim() !== "";
  const toggleCollapsed = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleExpanded = (key: string) => setExpanded((prev) => (prev === key ? null : key));

  const rows = (items: TaskItem[]) =>
    items.map((item) => <TaskRow key={item.key} item={item} today={today} expanded={expanded === item.key} onToggle={() => toggleExpanded(item.key)} host={host} />);
  const list = (items: TaskItem[], empty: string) =>
    items.length > 0 ? <div className="tt-list">{rows(items)}</div> : <div className="tt-empty">{filtered ? T.emptyFiltered : empty}</div>;
  const addButton = (name: string, date: string) => (
    <button type="button" className="clickable-icon" aria-label={T.addTo(name)} onClick={() => host.newTask(date)}>
      <Icon name="plus" />
    </button>
  );

  const show = (key: Exclude<Tab, "all" | "records">) => tab === "all" || tab === key;
  const staleInPast = board.past.filter((i) => i.stale).length;

  const header = (
    <div className="tt-head">
      <div className="tt-head-text">
        <h2 className="tt-title">{T.title}</h2>
        <div className="tt-sub">
          {formatLongDate(today)} · {T.todaySummary(todayTotal, counts.doneToday)}
        </div>
      </div>
      <button type="button" className="mod-cta tt-new" aria-label={T.newTask} onClick={() => host.newTask(today)}>
        <Icon name="plus" />
        <span className="tt-new-label">{T.newTask}</span>
      </button>
    </div>
  );

  if (snapshot.monthNotes.length === 0) {
    return (
      <div className="tt-view">
        {header}
        <div className="tt-blank">
          <div className="tt-blank-title">{T.emptyTitle}</div>
          <div className="tt-blank-desc">{T.emptyDesc(snapshot.folder)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tt-view">
      {header}
      <StatCards
        counts={counts}
        tab={tab}
        onSelect={(next) => {
          setTab(next);
          setExpanded(null);
        }}
      />
      {tab !== "all" && (
        <div className="tt-scope">
          {T.scope(T.stat[tab])} ·
          <button type="button" onClick={() => setTab("all")}>
            {T.showAll}
          </button>
        </div>
      )}

      {show("past") && (
        <Section
          title={T.stat.past}
          icon="history"
          count={board.past.length}
          collapsed={!!collapsed.past}
          onToggle={() => toggleCollapsed("past")}
          hint={
            staleInPast > 0 && (
              <div className="tt-hint">
                <Icon name="hourglass" />
                {T.staleHint(staleInPast)}
              </div>
            )
          }
        >
          {list(board.past, T.emptyPast)}
        </Section>
      )}

      {show("today") && (
        <Section
          title={T.stat.today}
          icon="sun"
          count={board.today.length}
          collapsed={!!collapsed.today}
          onToggle={() => toggleCollapsed("today")}
          tools={addButton(T.stat.today, today)}
        >
          {board.today.length + board.doneToday.length > 0 ? (
            <div className="tt-list">
              {rows(board.today)}
              {rows(board.doneToday)}
            </div>
          ) : (
            <div className="tt-empty">{filtered ? T.emptyFiltered : T.emptyToday}</div>
          )}
        </Section>
      )}

      {show("upcoming") && (
        <Section
          title={T.stat.upcoming}
          icon="calendar"
          count={board.upcoming.length}
          collapsed={!!collapsed.upcoming}
          onToggle={() => toggleCollapsed("upcoming")}
          tools={addButton(T.stat.upcoming, addDays(today, 1))}
        >
          {list(board.upcoming, T.emptyUpcoming)}
        </Section>
      )}

      {tab === "records" && (
        <Section
          title={T.stat.records}
          icon="archive"
          count={board.records.length}
          collapsed={!!collapsed.records}
          onToggle={() => toggleCollapsed("records")}
          tools={
            <div className="tt-record-filters">
              <select className="dropdown" aria-label={T.recordFilter.statusLabel} value={recordStatus} onChange={(e) => setRecordStatus(e.target.value as RecordStatusFilter)}>
                <option value="all">{T.recordFilter.all(counts.records)}</option>
                <option value="done">{T.recordFilter.done(counts.done)}</option>
                <option value="cancelled">{T.recordFilter.cancelled(counts.cancelled)}</option>
              </select>
              <select className="dropdown" aria-label={T.recordFilter.monthLabel} value={recordMonth} onChange={(e) => setRecordMonth(e.target.value)}>
                <option value="">{T.recordFilter.allMonths}</option>
                {board.recordMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <RecordGroups items={board.records} rows={rows} />
        </Section>
      )}

      {tab === "all" && (board.problems.length > 0 || board.fileIssues.length > 0) && (
        <Section
          title={T.problems.title}
          icon="info"
          count={board.problems.length + board.fileIssues.length}
          collapsed={!!collapsed.problems}
          onToggle={() => toggleCollapsed("problems")}
          hint={<div className="tt-hint">{T.problems.hint}</div>}
        >
          <div className="tt-list">
            {board.problems.map((item) => (
              <ProblemRow key={item.key} item={item} host={host} />
            ))}
            {board.fileIssues.map((issue) => (
              <div key={issue} className="tt-file-issue">
                {issue}
              </div>
            ))}
          </div>
        </Section>
      )}

      <FilterBar
        deadlineAlert={counts.deadlineAlert}
        deadlineOnly={deadlineOnly}
        onToggleDeadline={() => setDeadlineOnly((v) => !v)}
        categories={board.categories}
        category={category}
        onCategory={setCategory}
        query={query}
        onQuery={setQuery}
        searchOpen={searchOpen}
        onSearchOpen={setSearchOpen}
      />
    </div>
  );
}

/** 기록을 처리한 날짜별로 묶어 보여 준다. */
function RecordGroups({ items, rows }: { items: TaskItem[]; rows: (items: TaskItem[]) => ReactNode }) {
  if (items.length === 0) return <div className="tt-empty">{T.emptyRecords}</div>;
  const groups: { date: string; items: TaskItem[] }[] = [];
  for (const item of items) {
    const date = item.task.completedOn ?? item.task.cancelledOn ?? "";
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.date || "none"}>
          <div className="tt-record-day">{group.date ? formatLongDate(group.date) : T.noDate}</div>
          <div className="tt-list">{rows(group.items)}</div>
        </div>
      ))}
    </>
  );
}
