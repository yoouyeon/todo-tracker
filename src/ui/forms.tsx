import { useId, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "../data/actions";
import { plannedDateError, type NewTaskInput, type TaskPatch } from "../data/editMonthNote";
import type { TaskRecord } from "../data/types";
import { addDays } from "../logic/dates";
import { formatMonthDay, monthNoteFileName } from "../logic/format";
import { nextNewTaskStep } from "./newTaskFlow";
import { T } from "./strings";

/** 저장 요청의 결과. `pending`이면 입력창을 닫지 않고 계속 보여 준다. */
type Outcome = ActionResult | "pending";

const failed = (message: string): ActionResult => ({ ok: false, message });

/** 저장 요청, 오류 표시, 중복 제출 방지를 맡는다. 성공하면 `onSuccess`로 입력창을 닫는다. */
function useSubmit(onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const submit = async (run: () => Promise<Outcome>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const outcome = await run();
      if (outcome === "pending") return;
      if (outcome.ok) onSuccess();
      else setError(outcome.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

interface FrameProps {
  title?: string;
  submitLabel: string;
  submitClassName?: string;
  submitDisabled?: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  /** 실패했을 때 노트를 열어 볼 수 있게 한다. */
  onOpenNote?: () => void;
  children: ReactNode;
}

function FormFrame({ title, submitLabel, submitClassName = "mod-cta", submitDisabled, busy, error, onSubmit, onCancel, onOpenNote, children }: FrameProps) {
  return (
    <form
      className="tt-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {title && <p className="tt-form-title">{title}</p>}
      {children}
      {error && (
        <div className="tt-error" role="alert">
          <span>{error}</span>
          {onOpenNote && (
            <button type="button" onClick={onOpenNote}>
              {T.openNote}
            </button>
          )}
        </div>
      )}
      <div className="tt-form-actions">
        <button type="button" onClick={onCancel}>
          {T.form.back}
        </button>
        <button type="submit" className={submitClassName} disabled={busy || submitDisabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

interface TaskFormProps {
  task: TaskRecord;
  onSuccess: () => void;
  onCancel: () => void;
  onOpenNote: () => void;
}

export function CompleteForm({ task, today, run, onSuccess, onCancel, onOpenNote }: TaskFormProps & { today: string; run: (date: string) => Promise<ActionResult> }) {
  const [date, setDate] = useState(today);
  const { error, busy, submit } = useSubmit(onSuccess);
  return (
    <FormFrame
      title={task.title}
      submitLabel={T.form.completeSubmit}
      busy={busy}
      error={error}
      submitDisabled={date === ""}
      onSubmit={() => void submit(() => run(date))}
      onCancel={onCancel}
      onOpenNote={onOpenNote}
    >
      <label className="tt-field">
        <span>{T.form.completedOn}</span>
        <input type="date" value={date} required autoFocus onChange={(e) => setDate(e.target.value)} />
      </label>
      <p className="tt-help">{T.form.completeHelp(task.sourcePath)}</p>
    </FormFrame>
  );
}

export function CompletedDateForm({ task, run, onSuccess, onCancel, onOpenNote }: TaskFormProps & { run: (date: string) => Promise<ActionResult> }) {
  const [date, setDate] = useState(task.completedOn ?? "");
  const { error, busy, submit } = useSubmit(onSuccess);
  return (
    <FormFrame
      title={task.title}
      submitLabel={T.form.completedDateSubmit}
      busy={busy}
      error={error}
      submitDisabled={date === "" || date === task.completedOn}
      onSubmit={() => void submit(() => run(date))}
      onCancel={onCancel}
      onOpenNote={onOpenNote}
    >
      <label className="tt-field">
        <span>{T.form.completedOn}</span>
        <input type="date" value={date} required autoFocus onChange={(e) => setDate(e.target.value)} />
      </label>
      {task.completedOn && <p className="tt-help">{T.form.completedDateHelp(formatMonthDay(task.completedOn))}</p>}
    </FormFrame>
  );
}

export function CancelForm({ task, today, run, onSuccess, onCancel, onOpenNote }: TaskFormProps & { today: string; run: (date: string, reason: string) => Promise<ActionResult> }) {
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const { error, busy, submit } = useSubmit(onSuccess);
  return (
    <FormFrame
      title={task.title}
      submitLabel={T.form.cancelSubmit}
      submitClassName="mod-warning"
      submitDisabled={date === ""}
      busy={busy}
      error={error}
      onSubmit={() => void submit(() => run(date, reason))}
      onCancel={onCancel}
      onOpenNote={onOpenNote}
    >
      <label className="tt-field">
        <span>{T.form.cancelledOn}</span>
        <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="tt-field">
        <span>{T.form.reason}</span>
        <input type="text" value={reason} autoFocus placeholder={T.form.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
      </label>
    </FormFrame>
  );
}

export function DateForm({ task, today, run, onSuccess, onCancel, onOpenNote }: TaskFormProps & { today: string; run: (date: string) => Promise<ActionResult> }) {
  const tomorrow = addDays(today, 1);
  const suggested = addDays(today, 2);
  const [date, setDate] = useState(suggested);
  const { error, busy, submit } = useSubmit(onSuccess);

  const quick = (value: string, label: string) => (
    <button type="button" disabled={busy || plannedDateError(task, value) !== null} onClick={() => void submit(() => run(value))}>
      {label}
    </button>
  );

  return (
    <FormFrame
      title={task.title}
      submitLabel={T.form.dateSubmit}
      submitDisabled={date === ""}
      busy={busy}
      error={error}
      onSubmit={() => void submit(() => run(date))}
      onCancel={onCancel}
      onOpenNote={onOpenNote}
    >
      <div className="tt-quick">
        {quick(today, T.form.today(formatMonthDay(today)))}
        {quick(tomorrow, T.form.tomorrow(formatMonthDay(tomorrow)))}
      </div>
      <label className="tt-field">
        <span>{T.form.otherDate}</span>
        <input type="date" value={date} autoFocus onChange={(e) => setDate(e.target.value)} />
      </label>
      {task.planned && <p className="tt-help">{T.form.dateHelp(formatMonthDay(task.planned))}</p>}
    </FormFrame>
  );
}

export function EditForm({ task, categories, run, onSuccess, onCancel, onOpenNote }: TaskFormProps & { categories: string[]; run: (patch: TaskPatch) => Promise<ActionResult> }) {
  const [deadlineDate, setDeadlineDate] = useState(task.deadline?.date ?? "");
  const [deadlineTime, setDeadlineTime] = useState(task.deadline?.time ?? "");
  const [category, setCategory] = useState(task.category ?? "");
  const [memo, setMemo] = useState(task.memo ?? "");
  const listId = useId();
  const { error, busy, submit } = useSubmit(onSuccess);

  const save = async (): Promise<ActionResult> => {
    if (deadlineDate === "" && deadlineTime !== "") return failed(T.form.deadlineNeedsDate);
    return run({
      deadline: deadlineDate === "" ? null : { date: deadlineDate, time: deadlineTime === "" ? null : deadlineTime },
      category,
      memo,
    });
  };

  return (
    <FormFrame title={task.title} submitLabel={T.form.editSubmit} busy={busy} error={error} onSubmit={() => void submit(save)} onCancel={onCancel} onOpenNote={onOpenNote}>
      <div className="tt-field">
        <span>{T.form.deadline}</span>
        <div className="tt-field-row">
          <input type="date" aria-label={T.form.deadline} value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          <input type="time" aria-label={T.form.deadlineTime} value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
        </div>
      </div>
      <label className="tt-field">
        <span>{T.form.category}</span>
        <input type="text" list={listId} value={category} autoFocus onChange={(e) => setCategory(e.target.value)} />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="tt-field">
        <span>{T.form.memo}</span>
        <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {task.aliasText && <p className="tt-help">{T.form.aliasNote(task.aliasText)}</p>}
    </FormFrame>
  );
}

interface NewTaskFormProps {
  defaultDate: string;
  categories: string[];
  /** 제목이 완전히 같은 진행 중 항목 */
  findDuplicates: (title: string) => TaskRecord[];
  onCreate: (input: NewTaskInput) => Promise<ActionResult>;
  onChangeDate: (task: TaskRecord, date: string) => Promise<ActionResult>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NewTaskForm({ defaultDate, categories, findDuplicates, onCreate, onChangeDate, onSuccess, onCancel }: NewTaskFormProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [memo, setMemo] = useState("");
  /** 같은 제목을 찾아서 사용자에게 보여 주고 있는 항목 */
  const [duplicates, setDuplicates] = useState<TaskRecord[] | null>(null);
  const [choice, setChoice] = useState<number | "new" | null>(null);
  const listId = useId();
  const { error, busy, submit } = useSubmit(onSuccess);

  const save = async (): Promise<Outcome> => {
    if (deadlineDate === "" && deadlineTime !== "") return failed(T.form.deadlineNeedsDate);
    const found = findDuplicates(title);
    const step = nextNewTaskStep(found.length, duplicates !== null, choice);
    if (step.kind === "ask") {
      setDuplicates(found);
      return "pending";
    }
    if (step.kind === "choose") return failed(T.form.chooseFirst);
    if (step.kind === "add-date") {
      const existing = found[step.index];
      return existing ? onChangeDate(existing, date) : failed(T.form.chooseFirst);
    }
    return onCreate({
      title,
      date,
      category,
      memo,
      deadline: deadlineDate === "" ? null : { date: deadlineDate, time: deadlineTime === "" ? null : deadlineTime },
    });
  };

  return (
    <FormFrame
      submitLabel={T.form.createSubmit}
      submitDisabled={title.trim() === "" || date === ""}
      busy={busy}
      error={error}
      onSubmit={() => void submit(save)}
      onCancel={onCancel}
    >
      <p className="tt-help">{T.form.createDesc}</p>
      <label className="tt-field">
        <span>{T.form.titleLabel}</span>
        <input
          type="text"
          value={title}
          required
          autoFocus
          onChange={(e) => {
            setTitle(e.target.value);
            // 제목이 바뀌면 같은 제목 확인을 처음부터 다시 한다.
            setDuplicates(null);
            setChoice(null);
          }}
        />
      </label>
      <label className="tt-field">
        <span>{T.form.firstDate}</span>
        <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="tt-field">
        <span>{T.form.category}</span>
        <input type="text" list={listId} value={category} onChange={(e) => setCategory(e.target.value)} />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <div className="tt-field">
        <span>{T.form.deadline}</span>
        <div className="tt-field-row">
          <input type="date" aria-label={T.form.deadline} value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          <input type="time" aria-label={T.form.deadlineTime} value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
        </div>
      </div>
      <label className="tt-field">
        <span>{T.form.memo}</span>
        <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      {duplicates !== null && duplicates.length > 0 && (
        <fieldset className="tt-callout">
          <legend>{T.form.duplicateTitle(title.trim())}</legend>
          <p>{T.form.duplicateAsk}</p>
          {duplicates.map((dup, i) => (
            <label key={`${dup.sourcePath}:${dup.line}`} className="tt-choice">
              <input type="radio" name="duplicate-choice" checked={choice === i} onChange={() => setChoice(i)} />
              <span>{T.form.changeExisting(formatMonthDay(date), dup.sourcePath, formatMonthDay(dup.firstPlanned ?? date))}</span>
            </label>
          ))}
          <label className="tt-choice">
            <input type="radio" name="duplicate-choice" checked={choice === "new"} onChange={() => setChoice("new")} />
            <span>{T.form.createNew(monthNoteFileName(date))}</span>
          </label>
        </fieldset>
      )}
    </FormFrame>
  );
}
