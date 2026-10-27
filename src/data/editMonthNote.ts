import { isValidDate, isValidTime, monthOf } from "../logic/dates";
import { formatMonthDay } from "../logic/format";
import { t } from "../i18n";
import {
  FIELD_NAMES,
  FIELD_ORDER,
  FRONTMATTER_KEYS,
  INDENTED_RE,
  PROPERTY_RE,
  detectEol,
  fieldOf,
  frontmatterKeys,
  indentOf,
  monthHeading,
  splitLines,
  type FieldId,
  type FrontmatterId,
  type Line,
  type NoteLanguage,
} from "./monthNoteSyntax";
import { hasOpenTask, parseMonthNote } from "./parseMonthNote";
import type { Deadline, TaskRecord } from "./types";

/**
 * 월 노트의 내용을 받아 새 내용을 돌려주는 순수 함수들.
 * 파일 전체를 다시 쓰지 않고 바뀌는 줄만 고친다. 다른 항목, 모르는 속성 줄, 줄바꿈(CRLF/LF)은 그대로 둔다.
 * 이미 있는 속성 줄은 적힌 필드 이름을 그대로 두고 값만 바꾸며, 새로 넣는 줄만 `lang`의 필드 이름으로 쓴다.
 */

export type EditErrorCode = "conflict" | "readonly" | "invalid";

export interface EditError {
  code: EditErrorCode;
  message: string;
}

export type EditResult = { ok: true; content: string } | { ok: false; error: EditError };

const ok = (content: string): EditResult => ({ ok: true, content });
const fail = (code: EditErrorCode, message: string): EditResult => ({ ok: false, error: { code, message } });

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

/** 하기로 한 날을 이 날짜로 바꿀 수 있는지. 안 되면 이유를 돌려준다. */
export function plannedDateError(task: Pick<TaskRecord, "planned">, date: string): string | null {
  if (!isValidDate(date)) return t("edit.badDate");
  if (task.planned === null) return t("edit.unreadable");
  if (date === task.planned) return t("edit.samePlanned", { date: formatMonthDay(date) });
  return null;
}

// ── 대상 찾기 ──────────────────────────────────────────────

type Located = { ok: true; task: TaskRecord } | { ok: false; error: EditError };

/** 최신 본문을 다시 파싱해서 화면에서 고른 항목과 같은 항목을 찾는다. 확신할 수 없으면 찾지 않는다. */
function locate(content: string, path: string, target: TaskTarget): Located {
  const { tasks } = parseMonthNote(path, content);
  const same = tasks.filter((t) => t.sourceText === target.sourceText);
  const hit = same.length === 1 ? same[0] : same.filter((t) => t.line === target.line).length === 1 ? same.find((t) => t.line === target.line) : undefined;
  if (hit) return { ok: true, task: hit };
  return { ok: false, error: { code: "conflict", message: same.length > 1 ? t("edit.ambiguous") : t("edit.conflict") } };
}

/** 항목을 찾고, 읽을 수 있고 진행 중인지까지 확인한다. */
function locateOpen(content: string, path: string, target: TaskTarget): Located {
  const found = locate(content, path, target);
  if (!found.ok) return found;
  if (found.task.problems.length > 0) return { ok: false, error: { code: "readonly", message: t("edit.unreadable") } };
  if (found.task.status !== "open") return { ok: false, error: { code: "readonly", message: t("edit.notOpen") } };
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

/** 블록 안에서 같은 깊이의 알려진 속성 줄이 어느 필드인지. 아니면 null */
function propertyKey(block: Block, index: number): FieldId | null {
  const line = block.lines[index];
  if (!line || indentOf(line.text) !== block.indent) return null;
  const key = PROPERTY_RE.exec(line.text)?.[1]?.trim();
  return key === undefined ? null : (fieldOf(key)?.id ?? null);
}

function findProperty(block: Block, key: FieldId): number {
  for (let i = block.header + 1; i <= block.last; i += 1) if (propertyKey(block, i) === key) return i;
  return -1;
}

/** `key`보다 앞서야 하는 속성 줄 중 마지막 줄. 없으면 헤더 줄. 그 줄에 딸린 하위 줄은 건너뛴다. */
function anchorIndex(block: Block, key: FieldId): number {
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
function setProperty(content: string, headerLine: number, key: FieldId, value: string | null, lang: NoteLanguage): string {
  const block = readBlock(content, headerLine);
  const index = findProperty(block, key);
  if (value === null) return index === -1 ? content : removeLine(content, block.lines, index);

  const existing = index === -1 ? undefined : block.lines[index];
  if (existing) {
    const name = PROPERTY_RE.exec(existing.text)?.[1]?.trim() ?? FIELD_NAMES[lang][key];
    return content.slice(0, existing.start) + `${block.indent}- ${name}: ${value}` + content.slice(existing.end);
  }
  const text = `${block.indent}- ${FIELD_NAMES[lang][key]}: ${value}`;

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

/** frontmatter에서 `id`에 해당하는 키 줄의 번호와 그 키. 없으면 null */
function findFrontmatterKey(lines: Line[], close: number, id: FrontmatterId): { index: number; key: string } | null {
  for (const key of frontmatterKeys(id)) {
    const index = lines.findIndex((line, i) => i > 0 && i < close && line.text.startsWith(`${key}:`));
    if (index !== -1) return { index, key };
  }
  return null;
}

/**
 * frontmatter `미완료`(`open`)를 본문 기준으로 맞춘다. frontmatter가 없으면 만들지 않는다.
 * 키가 없어서 새로 넣을 때는 `월`(`month`) 키와 같은 언어로, 그것도 없으면 `lang`으로 쓴다.
 */
export function syncOpenFlag(content: string, path: string, lang: NoteLanguage = "ko"): string {
  const monthNote = parseMonthNote(path, content, lang);
  if (!monthNote.frontmatter) return content;
  const hasOpen = hasOpenTask(monthNote.tasks);
  if (monthNote.frontmatter.hasOpen === hasOpen) return content;

  const lines = splitLines(content);
  const close = lines.findIndex((line, i) => i > 0 && line.text === "---");
  const flag = findFrontmatterKey(lines, close, "hasOpen");
  const flagLine = flag ? lines[flag.index] : undefined;
  if (flag && flagLine) return content.slice(0, flagLine.start) + `${flag.key}: ${hasOpen}` + content.slice(flagLine.end);
  const month = findFrontmatterKey(lines, close, "month");
  const keyLang: NoteLanguage = month ? (month.key === FRONTMATTER_KEYS.ko.month ? "ko" : "en") : lang;
  const text = `${FRONTMATTER_KEYS[keyLang].hasOpen}: ${hasOpen}`;
  const anchor = month ? lines[month.index] : lines[close - 1];
  if (!anchor) return content;
  return content.slice(0, anchor.end) + detectEol(content) + text + content.slice(anchor.end);
}

// ── 항목 수정 ──────────────────────────────────────────────

const deadlineText = (deadline: Deadline) => (deadline.time ? `${deadline.date} ${deadline.time}` : deadline.date);

function deadlineError(deadline: Deadline): string | null {
  if (!isValidDate(deadline.date)) return t("edit.badDate");
  if (deadline.time !== null && !isValidTime(deadline.time)) return t("edit.badTime");
  return null;
}

export function completeTask(content: string, path: string, target: TaskTarget, date: string, lang: NoteLanguage = "ko"): EditResult {
  if (!isValidDate(date)) return fail("invalid", t("edit.badDate"));
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { line } = found.task;
  let next = setCheckbox(content, line, "x");
  next = setProperty(next, line, "completed", date, lang);
  return ok(syncOpenFlag(next, path, lang));
}

/** 완료한 항목의 `완료한 날`을 바꾼다. */
export function changeCompletedDate(content: string, path: string, target: TaskTarget, date: string, lang: NoteLanguage = "ko"): EditResult {
  if (!isValidDate(date)) return fail("invalid", t("edit.badDate"));
  const found = locate(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;
  if (task.problems.length > 0) return fail("readonly", t("edit.unreadable"));
  if (task.status !== "done") return fail("readonly", t("edit.notDone"));
  if (task.completedOn === date) return fail("invalid", t("edit.sameCompleted", { date: formatMonthDay(date) }));
  return ok(setProperty(content, task.line, "completed", date, lang));
}

/**
 * 완료나 취소를 되돌린다. 체크박스를 [ ]로 바꾸고 완료했으면 `완료한 날`, 취소했으면 `취소한 날`과 `이유` 줄을 지운다.
 * `하기로 한 날`은 건드리지 않는다.
 */
export function reopenTask(content: string, path: string, target: TaskTarget, lang: NoteLanguage = "ko"): EditResult {
  const found = locate(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;
  if (task.problems.length > 0) return fail("readonly", t("edit.unreadable"));
  if (task.status === "open") return fail("readonly", t("edit.notClosed"));
  let next = setCheckbox(content, task.line, " ");
  if (task.status === "done") {
    next = setProperty(next, task.line, "completed", null, lang);
  } else {
    next = setProperty(next, task.line, "cancelled", null, lang);
    next = setProperty(next, task.line, "reason", null, lang);
  }
  return ok(syncOpenFlag(next, path, lang));
}

/** 취소한 항목의 `취소한 날`과 `이유`를 바꾼다. 이유를 비우면 `이유` 줄을 지운다. */
export function changeCancellation(content: string, path: string, target: TaskTarget, date: string, reason: string, lang: NoteLanguage = "ko"): EditResult {
  if (!isValidDate(date)) return fail("invalid", t("edit.badDate"));
  const found = locate(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;
  if (task.problems.length > 0) return fail("readonly", t("edit.unreadable"));
  if (task.status !== "cancelled") return fail("readonly", t("edit.notCancelled"));
  const why = toOneLine(reason);
  if (task.cancelledOn === date && (task.cancelReason ?? "") === why) return fail("invalid", t("edit.unchanged"));
  let next = setProperty(content, task.line, "cancelled", date, lang);
  next = setProperty(next, task.line, "reason", why === "" ? null : why, lang);
  return ok(next);
}

export function cancelTask(content: string, path: string, target: TaskTarget, date: string, reason: string, lang: NoteLanguage = "ko"): EditResult {
  if (!isValidDate(date)) return fail("invalid", t("edit.badDate"));
  const why = toOneLine(reason);
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { line } = found.task;
  let next = setCheckbox(content, line, "-");
  next = setProperty(next, line, "cancelled", date, lang);
  next = setProperty(next, line, "reason", why === "" ? null : why, lang);
  return ok(syncOpenFlag(next, path, lang));
}

/**
 * 하기로 한 날을 바꾼다. 처음 바꿀 때는 원래 날짜를 `처음 하기로 한 날`로 남긴다.
 * 이미 `처음 하기로 한 날`이 있으면 그 줄은 건드리지 않는다.
 */
export function changePlannedDate(content: string, path: string, target: TaskTarget, date: string, lang: NoteLanguage = "ko"): EditResult {
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;
  const error = plannedDateError(task, date);
  if (error) return fail("invalid", error);
  let next = content;
  if (findProperty(readBlock(next, task.line), "firstPlanned") === -1 && task.planned !== null) {
    next = setProperty(next, task.line, "firstPlanned", task.planned, lang);
  }
  return ok(setProperty(next, task.line, "planned", date, lang));
}

export function updateTask(content: string, path: string, target: TaskTarget, patch: TaskPatch, lang: NoteLanguage = "ko"): EditResult {
  if (patch.deadline) {
    const error = deadlineError(patch.deadline);
    if (error) return fail("invalid", error);
  }
  const found = locateOpen(content, path, target);
  if (!found.ok) return { ok: false, error: found.error };
  const { task } = found;

  let next = content;
  const apply = (key: FieldId, value: string | null) => {
    next = setProperty(next, task.line, key, value, lang);
  };

  if (patch.deadline !== undefined) {
    const before = task.deadline;
    const after = patch.deadline;
    const same = before === after || (before && after && before.date === after.date && before.time === after.time);
    if (!same) apply("deadline", after ? deadlineText(after) : null);
  }
  if (patch.category !== undefined) {
    const after = toOneLine(patch.category ?? "") || null;
    if (after !== task.category) apply("category", after);
  }
  if (patch.memo !== undefined) {
    const after = toOneLine(patch.memo ?? "") || null;
    if (after !== task.memo) apply("memo", after);
  }
  return ok(next);
}

// ── 새 항목 ────────────────────────────────────────────────

function taskLines(input: NewTaskInput, title: string, lang: NoteLanguage, indent = "  "): string[] {
  const name = FIELD_NAMES[lang];
  const lines = [`- [ ] ${title}`, `${indent}- ${name.planned}: ${input.date}`];
  if (input.deadline) lines.push(`${indent}- ${name.deadline}: ${deadlineText(input.deadline)}`);
  const category = toOneLine(input.category ?? "");
  if (category !== "") lines.push(`${indent}- ${name.category}: ${category}`);
  const memo = toOneLine(input.memo ?? "");
  if (memo !== "") lines.push(`${indent}- ${name.memo}: ${memo}`);
  return lines;
}

/**
 * 새 항목을 월 파일에 넣는다. `content`가 null이면 파일이 없는 것이므로 새 월 노트를 만든다.
 * 항목은 첫 계획 날짜 순서를 지켜서 넣고, 같은 날짜의 항목이 있으면 그 묶음의 마지막에 넣는다.
 */
export function insertTask(content: string | null, path: string, input: NewTaskInput, lang: NoteLanguage = "ko"): EditResult {
  const title = toOneLine(input.title);
  if (title === "") return fail("invalid", t("edit.noTitle"));
  if (!isValidDate(input.date)) return fail("invalid", t("edit.badDate"));
  if (input.deadline) {
    const error = deadlineError(input.deadline);
    if (error) return fail("invalid", error);
  }

  if (content === null) {
    const month = monthOf(input.date);
    const body = taskLines(input, title, lang).join("\n");
    const keys = FRONTMATTER_KEYS[lang];
    return ok(`---\n${keys.month}: ${month}\n${keys.hasOpen}: true\n---\n\n${monthHeading(month, lang)}\n\n${body}\n`);
  }

  const eol = detectEol(content);
  const item = taskLines(input, title, lang).join(eol);
  const monthNote = parseMonthNote(path, content, lang);

  let after: TaskRecord | null = null;
  for (const task of monthNote.tasks) {
    const first = task.firstPlanned;
    if (first !== null && first <= input.date) after = task;
  }
  const firstTask = monthNote.tasks[0];

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
  return ok(syncOpenFlag(next, path, lang));
}

// ── 언어 바꾸기 ────────────────────────────────────────────

/**
 * 항목의 알려진 속성 줄과 frontmatter 키를 `lang`의 이름으로 바꾼다. 값, 모르는 줄, 제목은 그대로 둔다.
 * 바꿀 것이 없으면 받은 내용을 그대로 돌려준다.
 */
export function convertMonthNote(content: string, path: string, lang: NoteLanguage): string {
  const lines = splitLines(content);
  const renames: { line: Line; text: string }[] = [];

  const close = lines[0]?.text === "---" ? lines.findIndex((line, i) => i > 0 && line.text === "---") : -1;
  for (const id of ["month", "hasOpen"] as const) {
    const found = findFrontmatterKey(lines, close, id);
    const line = found ? lines[found.index] : undefined;
    const name = FRONTMATTER_KEYS[lang][id];
    if (found && line && found.key !== name) renames.push({ line, text: name + line.text.slice(found.key.length) });
  }

  for (const task of parseMonthNote(path, content, lang).tasks) {
    const block = readBlock(content, task.line);
    for (let i = block.header + 1; i <= block.last; i += 1) {
      const id = propertyKey(block, i);
      const line = block.lines[i];
      if (id === null || !line) continue;
      const colon = line.text.indexOf(":");
      const name = FIELD_NAMES[lang][id];
      if (line.text.slice(block.indent.length + 2, colon).trim() !== name) {
        renames.push({ line, text: `${block.indent}- ${name}${line.text.slice(colon)}` });
      }
    }
  }

  // 뒤쪽 줄부터 바꿔야 앞쪽 줄의 위치가 어긋나지 않는다.
  renames.sort((a, b) => b.line.start - a.line.start);
  return renames.reduce((next, { line, text }) => next.slice(0, line.start) + text + next.slice(line.end), content);
}
