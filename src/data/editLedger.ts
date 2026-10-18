import { isValidDate, isValidTime, monthOf } from "../logic/dates";
import { formatMonthDay } from "../logic/format";
import {
  FIELD,
  FIELD_ORDER,
  INDENTED_RE,
  KNOWN_FIELDS,
  PROPERTY_RE,
  detectEol,
  indentOf,
  splitLines,
  type FieldKey,
  type Line,
} from "./ledgerSyntax";
import { hasOpenTask, parseLedger } from "./parseLedger";
import type { Deadline, TaskRecord } from "./types";

/**
 * 월 장부 파일의 내용을 받아 새 내용을 돌려주는 순수 함수들.
 * 파일 전체를 다시 쓰지 않고 바뀌는 줄만 고친다. 다른 항목, 모르는 속성 줄, 줄바꿈(CRLF/LF)은 그대로 둔다.
 */

export type EditErrorCode = "conflict" | "readonly" | "invalid";

export interface EditError {
  code: EditErrorCode;
  message: string;
}

export type EditResult = { ok: true; content: string } | { ok: false; error: EditError };

const ok = (content: string): EditResult => ({ ok: true, content });
const fail = (code: EditErrorCode, message: string): EditResult => ({ ok: false, error: { code, message } });

export const MESSAGES = {
  conflict: "노트에서 이 항목이 바뀌어서 저장하지 않았어요. 화면이 갱신된 뒤 다시 시도해 주세요.",
  ambiguous: "같은 내용의 항목이 여러 개라 어느 쪽인지 알 수 없어서 저장하지 않았어요. 노트에서 직접 고쳐 주세요.",
  unreadable: "형식을 읽을 수 없는 항목이라 고칠 수 없어요. 노트에서 직접 고쳐 주세요.",
  notOpen: "진행 중인 항목만 고칠 수 있어요.",
  badDate: "날짜 형식이 올바르지 않아요.",
  badTime: "시각 형식이 올바르지 않아요.",
  noTitle: "제목을 입력해 주세요.",
  noReason: "이유를 입력해 주세요.",
  deadlineNeedsDate: "마감 시각만 있을 수 없어요. 마감 날짜를 함께 입력해 주세요.",
} as const;

/** 화면에서 항목을 가리키는 값. 저장할 때 최신 본문에서 같은 항목을 다시 찾는 데 쓴다. */
export type TaskTarget = Pick<TaskRecord, "sourceText" | "line">;

export interface TaskPatch {
  /** 값이 없으면(undefined) 그대로 두고, null이면 지운다. */
  deadline?: Deadline | null;
  category?: string | null;
  memo?: string | null;
}

export interface NewTaskInput {
  title: string;
  /** 처음 하기로 한 날. 이 날짜의 월 파일에 들어간다. */
  date: string;
  category?: string | null;
  deadline?: Deadline | null;
  memo?: string | null;
}

/** 속성 줄은 한 줄이라 줄바꿈과 연속 공백을 공백 하나로 줄인다. */
export const toOneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/** 새 계획 날짜를 더할 수 있는지. 안 되면 이유를 돌려준다. */
export function plannedDateError(task: Pick<TaskRecord, "plannedDates">, date: string): string | null {
  if (!isValidDate(date)) return MESSAGES.badDate;
  const latest = task.plannedDates[task.plannedDates.length - 1];
  if (latest === undefined) return MESSAGES.unreadable;
  if (task.plannedDates.includes(date)) return "이미 계획한 날짜예요.";
  if (date < latest) return `현재 계획 날짜(${formatMonthDay(latest)})보다 뒤의 날짜만 추가할 수 있어요.`;
  return null;
}

// ── 대상 찾기 ──────────────────────────────────────────────

type Located = { ok: true; task: TaskRecord } | { ok: false; error: EditError };

/** 최신 본문을 다시 파싱해서 화면에서 고른 항목과 같은 항목을 찾는다. 확신할 수 없으면 찾지 않는다. */
function locate(content: string, path: string, target: TaskTarget): Located {
  const { tasks } = parseLedger(path, content);
  const same = tasks.filter((t) => t.sourceText === target.sourceText);
  const hit = same.length === 1 ? same[0] : same.filter((t) => t.line === target.line).length === 1 ? same.find((t) => t.line === target.line) : undefined;
  if (hit) return { ok: true, task: hit };
  return { ok: false, error: { code: "conflict", message: same.length > 1 ? MESSAGES.ambiguous : MESSAGES.conflict } };
}

/** 항목을 찾고, 읽을 수 있고 진행 중인지까지 확인한다. */
function locateOpen(content: string, path: string, target: TaskTarget): Located {
  const found = locate(content, path, target);
  if (!found.ok) return found;
  if (found.task.problems.length > 0) return { ok: false, error: { code: "readonly", message: MESSAGES.unreadable } };
  if (found.task.status !== "open") return { ok: false, error: { code: "readonly", message: MESSAGES.notOpen } };
  return found;
}

// ── 줄 단위 편집 ───────────────────────────────────────────

interface Block {
  lines: Line[];
  header: number;
  last: number;
  indent: string;
}

/** `headerLine`에서 시작하는 항목 블록. 헤더 줄 뒤에 들여쓴 줄이 이어지는 데까지다. */
function readBlock(content: string, headerLine: number): Block {
  const lines = splitLines(content);
  let last = headerLine;
  while (lines[last + 1] && INDENTED_RE.test(lines[last + 1]?.text ?? "")) last += 1;
  const first = lines[headerLine + 1];
  const indent = first && INDENTED_RE.test(first.text) ? indentOf(first.text) : "  ";
  return { lines, header: headerLine, last, indent };
}

/** 블록 안에서 같은 깊이의 알려진 속성 줄의 이름. 아니면 null */
function propertyKey(block: Block, index: number): FieldKey | null {
  const line = block.lines[index];
  if (!line || indentOf(line.text) !== block.indent) return null;
  const key = PROPERTY_RE.exec(line.text)?.[1]?.trim();
  return key !== undefined && KNOWN_FIELDS.has(key) ? (key as FieldKey) : null;
}

function findProperty(block: Block, key: FieldKey): number {
  for (let i = block.header + 1; i <= block.last; i += 1) if (propertyKey(block, i) === key) return i;
  return -1;
}

/** `key`보다 앞서야 하는 속성 줄 중 마지막 줄. 없으면 헤더 줄. 그 줄에 딸린 하위 줄은 건너뛴다. */
function anchorIndex(block: Block, key: FieldKey): number {
  const rank = FIELD_ORDER.indexOf(key);
  let anchor = block.header;
  for (let i = block.header + 1; i <= block.last; i += 1) {
    const other = propertyKey(block, i);
    if (other !== null && FIELD_ORDER.indexOf(other) < rank) anchor = i;
  }
  if (anchor !== block.header) {
    while (anchor < block.last && indentOf(block.lines[anchor + 1]?.text ?? "").length > block.indent.length) anchor += 1;
  }
  return anchor;
}

function removeLine(content: string, lines: Line[], index: number): string {
  const line = lines[index];
  if (!line) return content;
  const next = lines[index + 1];
  if (next) return content.slice(0, line.start) + content.slice(next.start);
  // 마지막 줄이면 앞 줄과의 줄바꿈까지 함께 지운다.
  const prev = lines[index - 1];
  return prev ? content.slice(0, prev.end) + content.slice(line.end) : content.slice(0, line.start);
}

/** 속성 줄의 값을 바꾸거나 넣거나(value가 문자열) 지운다(value가 null). */
function setProperty(content: string, headerLine: number, key: FieldKey, value: string | null): string {
  const block = readBlock(content, headerLine);
  const index = findProperty(block, key);
  if (value === null) return index === -1 ? content : removeLine(content, block.lines, index);

  const text = `${block.indent}- ${key}: ${value}`;
  const existing = index === -1 ? undefined : block.lines[index];
  if (existing) return content.slice(0, existing.start) + text + content.slice(existing.end);

  const anchor = block.lines[anchorIndex(block, key)];
  if (!anchor) return content;
  return content.slice(0, anchor.end) + detectEol(content) + text + content.slice(anchor.end);
}

/** 체크박스 기호를 바꾼다. 헤더 줄이 `- [x]` 꼴일 때만 호출한다. */
function setCheckbox(content: string, headerLine: number, symbol: " " | "x" | "-"): string {
  const line = splitLines(content)[headerLine];
  if (!line) return content;
  return content.slice(0, line.start + 3) + symbol + content.slice(line.start + 4);
}

// ── frontmatter ───────────────────────────────────────────

/** frontmatter `미완료`를 본문 기준으로 맞춘다. frontmatter가 없으면 만들지 않는다. */
export function syncOpenFlag(content: string, path: string): string {
  const ledger = parseLedger(path, content);
  if (!ledger.frontmatter) return content;
  const hasOpen = hasOpenTask(ledger.tasks);
  if (ledger.frontmatter.hasOpen === hasOpen) return content;

  const lines = splitLines(content);
  const close = lines.findIndex((line, i) => i > 0 && line.text === "---");
  const keyIndex = (key: string) => lines.findIndex((line, i) => i > 0 && i < close && line.text.startsWith(`${key}:`));
  const text = `미완료: ${hasOpen}`;
  const flag = lines[keyIndex("미완료")];
  if (flag) return content.slice(0, flag.start) + text + content.slice(flag.end);
  const month = lines[keyIndex("월")];
  const anchor = month ?? lines[close - 1];
  if (!anchor) return content;
  return content.slice(0, anchor.end) + detectEol(content) + text + content.slice(anchor.end);
}

// ── 항목 수정 ──────────────────────────────────────────────

const deadlineText = (deadline: Deadline) => (deadline.time ? `${deadline.date} ${deadline.time}` : deadline.date);

function deadlineError(deadline: Deadline): string | null {
  if (!isValidDate(deadline.date)) return MESSAGES.badDate;
  if (deadline.time !== null && !isValidTime(deadline.time)) return MESSAGES.badTime;
  return null;
}

export function completeTask(content: string, path: string, target: TaskTarget, date: string): EditResult {
  if (!isValidDate(date)) return fail("invalid", MESSAGES.badDate);
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { line } = found.task;
  let next = setCheckbox(content, line, "x");
  next = setProperty(next, line, FIELD.completed, date);
  return ok(syncOpenFlag(next, path));
}

export function cancelTask(content: string, path: string, target: TaskTarget, date: string, reason: string): EditResult {
  if (!isValidDate(date)) return fail("invalid", MESSAGES.badDate);
  const why = toOneLine(reason);
  if (why === "") return fail("invalid", MESSAGES.noReason);
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { line } = found.task;
  let next = setCheckbox(content, line, "-");
  next = setProperty(next, line, FIELD.cancelled, date);
  next = setProperty(next, line, FIELD.reason, why);
  return ok(syncOpenFlag(next, path));
}

export function addPlannedDate(content: string, path: string, target: TaskTarget, date: string): EditResult {
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const error = plannedDateError(found.task, date);
  if (error) return fail("invalid", error);
  const dates = [...found.task.plannedDates, date].join(", ");
  return ok(syncOpenFlag(setProperty(content, found.task.line, FIELD.planned, dates), path));
}

export function updateTask(content: string, path: string, target: TaskTarget, patch: TaskPatch): EditResult {
  if (patch.deadline) {
    const error = deadlineError(patch.deadline);
    if (error) return fail("invalid", error);
  }
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;

  let next = content;
  const apply = (key: FieldKey, value: string | null) => {
    next = setProperty(next, task.line, key, value);
  };

  if (patch.deadline !== undefined) {
    const before = task.deadline;
    const after = patch.deadline;
    const same = before === after || (before && after && before.date === after.date && before.time === after.time);
    if (!same) apply(FIELD.deadline, after ? deadlineText(after) : null);
  }
  if (patch.category !== undefined) {
    const after = toOneLine(patch.category ?? "") || null;
    if (after !== task.category) apply(FIELD.category, after);
  }
  if (patch.memo !== undefined) {
    const after = toOneLine(patch.memo ?? "") || null;
    if (after !== task.memo) apply(FIELD.memo, after);
  }
  return ok(next);
}

// ── 새 항목 ────────────────────────────────────────────────

function taskLines(input: NewTaskInput, title: string, indent = "  "): string[] {
  const lines = [`- [ ] ${title}`, `${indent}- ${FIELD.planned}: ${input.date}`];
  if (input.deadline) lines.push(`${indent}- ${FIELD.deadline}: ${deadlineText(input.deadline)}`);
  const category = toOneLine(input.category ?? "");
  if (category !== "") lines.push(`${indent}- ${FIELD.category}: ${category}`);
  const memo = toOneLine(input.memo ?? "");
  if (memo !== "") lines.push(`${indent}- ${FIELD.memo}: ${memo}`);
  return lines;
}

/**
 * 새 항목을 월 파일에 넣는다. `content`가 null이면 파일이 없는 것이므로 기본 장부를 만든다.
 * 항목은 첫 계획 날짜 순서를 지켜서 넣고, 같은 날짜의 항목이 있으면 그 묶음의 마지막에 넣는다.
 */
export function insertTask(content: string | null, path: string, input: NewTaskInput): EditResult {
  const title = toOneLine(input.title);
  if (title === "") return fail("invalid", MESSAGES.noTitle);
  if (!isValidDate(input.date)) return fail("invalid", MESSAGES.badDate);
  if (input.deadline) {
    const error = deadlineError(input.deadline);
    if (error) return fail("invalid", error);
  }

  if (content === null) {
    const month = monthOf(input.date);
    const body = taskLines(input, title).join("\n");
    return ok(`---\n월: ${month}\n미완료: true\n---\n\n# ${month} 할 일\n\n${body}\n`);
  }

  const eol = detectEol(content);
  const item = taskLines(input, title).join(eol);
  const ledger = parseLedger(path, content);

  let after: TaskRecord | null = null;
  for (const task of ledger.tasks) {
    const first = task.plannedDates[0];
    if (first !== undefined && first <= input.date) after = task;
  }
  const firstTask = ledger.tasks[0];

  let next: string;
  if (after) {
    const end = after.sourceRange.end;
    next = content.slice(0, end) + eol + eol + item + content.slice(end);
  } else if (firstTask) {
    const start = firstTask.sourceRange.start;
    next = content.slice(0, start) + item + eol + eol + content.slice(start);
  } else {
    const body = content.replace(/\s+$/, "");
    next = (body === "" ? "" : body + eol + eol) + item + eol;
  }
  return ok(syncOpenFlag(next, path));
}
