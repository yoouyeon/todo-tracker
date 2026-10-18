import { formatLongDate, formatMonthDay, weekdayOf } from "../logic/format";
import type { TaskItem } from "../logic/selectors";
import { cx } from "./cx";
import type { AppHost } from "./host";
import { Icon } from "./Icon";
import { PlainButton } from "./PlainButton";
import { T } from "./strings";

interface RowProps {
  item: TaskItem;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  host: AppHost;
}

/** 오른쪽에 놓는 부가 정보. 오래 밀림·마감 칩과 날짜 */
function Meta({ item }: { item: TaskItem }) {
  const { task } = item;
  if (task.status === "done") return <span>{task.completedOn ? T.doneOn(formatMonthDay(task.completedOn)) : T.done}</span>;
  if (task.status === "cancelled") return <span>{task.cancelledOn ? T.cancelledOn(formatMonthDay(task.cancelledOn)) : T.cancelled}</span>;
  const alert = item.deadline?.state === "overdue" || item.deadline?.state === "soon";
  return (
    <>
      {item.stale && (
        <span className="tt-chip" title={T.staleTitle(item.age)}>
          <Icon name="hourglass" />
          {T.staleChip(item.age)}
        </span>
      )}
      {item.deadline && (
        <span className={cx("tt-chip", alert && "is-strong")}>
          <Icon name="flag" />
          {item.deadline.label}
        </span>
      )}
      {item.bucket === "past" && item.current && <span>{formatMonthDay(item.current)}</span>}
      {item.bucket === "upcoming" && item.current && (
        <span>
          {formatMonthDay(item.current)} ({weekdayOf(item.current)})
        </span>
      )}
    </>
  );
}

/** 진행 중이면 눌러서 완료할 수 있는 체크, 끝난 항목이면 상태만 보여 주는 표시 */
function CheckMark({ item, today, host }: { item: TaskItem; today: string; host: AppHost }) {
  const { task } = item;
  if (task.status === "open") {
    return <PlainButton className="tt-check is-open" label={T.completeMark(task.title)} onClick={() => host.complete(task, today)} />;
  }
  const label = task.status === "done" ? T.doneMark : T.cancelledMark;
  return (
    <span className={cx("tt-check", `is-${task.status}`)} role="img" aria-label={label}>
      <Icon name={task.status === "done" ? "check" : "minus"} />
    </span>
  );
}

export function TaskRow({ item, today, expanded, onToggle, host }: RowProps) {
  const { task } = item;
  const open = task.status === "open";
  return (
    <div
      className={cx("tt-item", `is-${task.status}`, expanded && "is-selected")}
      onContextMenu={(e) => {
        e.preventDefault();
        host.showMenu(e.nativeEvent, task, today, "task");
      }}
    >
      <div className="tt-row">
        <CheckMark item={item} today={today} host={host} />
        <PlainButton className="tt-main" expanded={expanded} onClick={onToggle}>
          <span className="tt-item-title">{task.title}</span>
        </PlainButton>
        <span className="tt-meta">
          <Meta item={item} />
        </span>
        {open && (
          <span className="tt-pills">
            <button type="button" onClick={() => host.complete(task, today)}>
              <Icon name="check" />
              {T.action.complete}
            </button>
            <button type="button" onClick={(e) => host.showMenu(e.nativeEvent, task, today, "date")}>
              <Icon name="calendar" />
              {item.current ? formatMonthDay(item.current) : T.action.addDate}
            </button>
            <button type="button" className="clickable-icon" aria-label={T.more} onClick={(e) => host.showMenu(e.nativeEvent, task, today, "task")}>
              <Icon name="ellipsis" />
            </button>
          </span>
        )}
      </div>
      {expanded && <TaskDetail item={item} today={today} host={host} />}
    </div>
  );
}

function TaskDetail({ item, today, host }: { item: TaskItem; today: string; host: AppHost }) {
  const { task } = item;
  const last = task.plannedDates.length - 1;
  const open = task.status === "open";
  return (
    <div className="tt-detail">
      <dl className="tt-fields">
        <dt>{T.field.planned}</dt>
        <dd>
          <div className="tt-dates">
            {task.plannedDates.map((date, i) => {
              const current = open && i === last;
              return (
                <span key={date} className={cx("tt-date", current && "is-current")}>
                  {formatMonthDay(date)}
                  {i === 0 && last > 0 && <small>{T.first}</small>}
                  {current && last > 0 && <small>{T.current}</small>}
                </span>
              );
            })}
          </div>
          {open && (
            <div className="tt-help">
              {T.ageLine(item.age)}
              {item.stale && ` · ${T.staleSuffix}`}
            </div>
          )}
        </dd>

        {task.deadline && (
          <>
            <dt>{T.field.deadline}</dt>
            <dd>
              {formatLongDate(task.deadline.date)}
              {task.deadline.time && ` ${task.deadline.time}`}
              {item.deadline?.state === "overdue" && ` · ${T.overdueSuffix}`}
            </dd>
          </>
        )}
        {task.status === "done" && task.completedOn && (
          <>
            <dt>{T.field.completedOn}</dt>
            <dd>{formatLongDate(task.completedOn)}</dd>
          </>
        )}
        {task.status === "cancelled" && (
          <>
            {task.cancelledOn && (
              <>
                <dt>{T.field.cancelledOn}</dt>
                <dd>{formatLongDate(task.cancelledOn)}</dd>
              </>
            )}
            {task.cancelReason && (
              <>
                <dt>{T.field.reason}</dt>
                <dd>{task.cancelReason}</dd>
              </>
            )}
          </>
        )}

        <dt>{T.field.category}</dt>
        <dd>{task.category ?? <span className="tt-faint">{T.none}</span>}</dd>
        {task.aliasText && (
          <>
            <dt>{T.field.alias}</dt>
            <dd>
              {task.aliasText} <span className="tt-faint">· {T.readOnly}</span>
            </dd>
          </>
        )}
        <dt>{T.field.memo}</dt>
        <dd>{task.memo ? <span className="tt-memo">{task.memo}</span> : <span className="tt-faint">{T.none}</span>}</dd>
        <dt>{T.field.source}</dt>
        <dd>{task.sourcePath}</dd>
      </dl>
      <div className="tt-actions">
        {open && (
          <>
            {/* 마우스를 올릴 수 없는 모바일에는 행 버튼이 없으므로 완료와 날짜 추가도 여기에 둔다. */}
            <button type="button" className="mod-cta tt-touch-only" onClick={() => host.complete(task, today)}>
              <Icon name="check" />
              {T.action.complete}
            </button>
            <button type="button" className="tt-touch-only" onClick={() => host.pickDate(task, today)}>
              <Icon name="calendar-plus" />
              {T.action.addDate}
            </button>
            <button type="button" onClick={() => host.edit(task)}>
              <Icon name="pencil" />
              {T.action.edit}
            </button>
          </>
        )}
        <button type="button" onClick={() => host.openNote(task)}>
          <Icon name="file-text" />
          {T.openNote}
        </button>
        {open && (
          <button type="button" className="mod-warning" onClick={() => host.cancel(task, today)}>
            {T.action.cancel}
          </button>
        )}
      </div>
    </div>
  );
}

/** 읽을 수 없는 항목. 원문을 열어 고칠 수 있게 이유와 노트 링크를 항상 보여 준다. */
export function ProblemRow({ item, host }: { item: TaskItem; host: AppHost }) {
  const { task } = item;
  return (
    <div className="tt-item is-problem">
      <div className="tt-row">
        <span className="tt-check is-problem" role="img" aria-label={T.readOnly}>
          <Icon name="info" />
        </span>
        <div className="tt-problem-body">
          <span className="tt-item-title">{task.title || T.problems.noTitle}</span>
          <ul className="tt-problem-list">
            {task.problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
          <span className="tt-help">{task.sourcePath}</span>
        </div>
        <button type="button" onClick={() => host.openNote(task)}>
          <Icon name="file-text" />
          {T.openNote}
        </button>
      </div>
    </div>
  );
}
