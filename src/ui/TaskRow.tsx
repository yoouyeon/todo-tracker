import { formatLongDate, formatMonthDay, weekdayOf } from "../logic/format";
import type { TaskItem } from "../logic/selectors";
import { cx } from "./cx";
import type { AppHost } from "./host";
import { Icon } from "./Icon";
import { PlainButton } from "./PlainButton";
import { t } from "../i18n";

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
  if (task.status === "done") return <span>{task.completedOn ? t("doneOn", { date: formatMonthDay(task.completedOn) }) : t("done")}</span>;
  if (task.status === "cancelled") return <span>{task.cancelledOn ? t("cancelledOn", { date: formatMonthDay(task.cancelledOn) }) : t("cancelled")}</span>;
  const alert = item.deadline?.state === "overdue" || item.deadline?.state === "soon";
  return (
    <>
      {item.stale && (
        <span className="tt-chip" title={t("staleTitle", { count: item.age })}>
          <Icon name="hourglass" />
          {t("staleChip", { age: item.age })}
        </span>
      )}
      {item.deadline && (
        <span className={cx("tt-chip", alert && "is-strong")}>
          <Icon name="flag" />
          {item.deadline.label}
        </span>
      )}
      {item.bucket === "past" && item.current && <span className="tt-meta-date">{formatMonthDay(item.current)}</span>}
      {item.bucket === "upcoming" && item.current && (
        <span className="tt-meta-date">
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
    return <PlainButton className="tt-check is-open" label={t("completeMark", { title: task.title })} onClick={() => host.complete(task, today)} />;
  }
  const label = task.status === "done" ? t("doneMark") : t("cancelledMark");
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
              {t("action.complete")}
            </button>
            <button type="button" onClick={(e) => host.showMenu(e.nativeEvent, task, today, "date")}>
              <Icon name="calendar" />
              {item.current ? formatMonthDay(item.current) : t("action.changeDate")}
            </button>
            <button type="button" className="clickable-icon" aria-label={t("more")} onClick={(e) => host.showMenu(e.nativeEvent, task, today, "task")}>
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
  const open = task.status === "open";
  // 하기로 한 날을 바꾼 적이 있으면 처음 날짜와 지금 날짜를 나란히 보여 준다.
  const changed = task.firstPlanned !== null && task.firstPlanned !== task.planned;
  return (
    <div className="tt-detail">
      <dl className="tt-fields">
        <dt>{t("field.planned")}</dt>
        <dd>
          <div className="tt-dates">
            {changed && task.firstPlanned && (
              <span className="tt-date">
                {formatMonthDay(task.firstPlanned)}
                <small>{t("first")}</small>
              </span>
            )}
            {task.planned && (
              <span className={cx("tt-date", open && "is-current")}>
                {formatMonthDay(task.planned)}
                {changed && <small>{t("current")}</small>}
              </span>
            )}
          </div>
          {/* 처음 계획한 날이 오늘이거나 아직 오지 않았으면 지난 일수가 없으므로 보여 주지 않는다. */}
          {open && item.age > 0 && (
            <div className="tt-help">
              {t("ageLine", { count: item.age })}
              {item.stale && ` · ${t("staleSuffix")}`}
            </div>
          )}
        </dd>

        {task.deadline && (
          <>
            <dt>{t("field.deadline")}</dt>
            <dd>
              {formatLongDate(task.deadline.date)}
              {task.deadline.time && ` ${task.deadline.time}`}
              {item.deadline?.state === "overdue" && ` · ${t("overdueSuffix")}`}
            </dd>
          </>
        )}
        {task.status === "done" && task.completedOn && (
          <>
            <dt>{t("field.completedOn")}</dt>
            <dd>{formatLongDate(task.completedOn)}</dd>
          </>
        )}
        {task.status === "cancelled" && (
          <>
            {task.cancelledOn && (
              <>
                <dt>{t("field.cancelledOn")}</dt>
                <dd>{formatLongDate(task.cancelledOn)}</dd>
              </>
            )}
            {task.cancelReason && (
              <>
                <dt>{t("field.reason")}</dt>
                <dd>{task.cancelReason}</dd>
              </>
            )}
          </>
        )}

        <dt>{t("field.category")}</dt>
        <dd>{task.category ?? <span className="tt-faint">{t("none")}</span>}</dd>
        {task.aliasText && (
          <>
            <dt>{t("field.alias")}</dt>
            <dd>
              {task.aliasText} <span className="tt-faint">· {t("readOnly")}</span>
            </dd>
          </>
        )}
        <dt>{t("field.memo")}</dt>
        <dd>{task.memo ? <span className="tt-memo">{task.memo}</span> : <span className="tt-faint">{t("none")}</span>}</dd>
        <dt>{t("field.source")}</dt>
        <dd>{task.sourcePath}</dd>
      </dl>
      <div className="tt-actions">
        {open && (
          <>
            {/* 마우스를 올릴 수 없는 모바일에는 행 버튼이 없으므로 완료와 날짜 추가도 여기에 둔다. */}
            <button type="button" className="mod-cta tt-touch-only" onClick={() => host.complete(task, today)}>
              <Icon name="check" />
              {t("action.complete")}
            </button>
            <button type="button" className="tt-touch-only" onClick={() => host.pickDate(task, today)}>
              <Icon name="calendar-plus" />
              {t("action.changeDate")}
            </button>
            <button type="button" onClick={() => host.edit(task)}>
              <Icon name="pencil" />
              {t("action.edit")}
            </button>
          </>
        )}
        {task.status === "done" && (
          <>
            <button type="button" onClick={() => host.changeCompletedOn(task)}>
              <Icon name="calendar-check" />
              {t("action.changeCompleted")}
            </button>
            <button type="button" onClick={() => host.reopen(task)}>
              <Icon name="undo-2" />
              {t("action.reopen")}
            </button>
          </>
        )}
        {task.status === "cancelled" && (
          <>
            <button type="button" onClick={() => host.changeCancellation(task)}>
              <Icon name="pencil" />
              {t("action.changeCancellation")}
            </button>
            <button type="button" onClick={() => host.reopen(task)}>
              <Icon name="undo-2" />
              {t("action.uncancel")}
            </button>
          </>
        )}
        <button type="button" onClick={() => host.openNote(task)}>
          <Icon name="file-text" />
          {t("openNote")}
        </button>
        {open && (
          <button type="button" className="mod-warning" onClick={() => host.cancel(task, today)}>
            {t("action.cancel")}
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
        <span className="tt-check is-problem" role="img" aria-label={t("readOnly")}>
          <Icon name="info" />
        </span>
        <div className="tt-problem-body">
          <span className="tt-item-title">{task.title || t("problems.noTitle")}</span>
          <ul className="tt-problem-list">
            {task.problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
          <span className="tt-help">{task.sourcePath}</span>
        </div>
        <button type="button" onClick={() => host.openNote(task)}>
          <Icon name="file-text" />
          {t("openNote")}
        </button>
      </div>
    </div>
  );
}
