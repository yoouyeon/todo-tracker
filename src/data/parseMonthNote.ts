import { isValidDate, isValidTime } from "../logic/dates";
import { t } from "../i18n";
import {
  FIELD_NAMES,
  INDENTED_RE,
  PROPERTY_RE,
  TASK_HEADER_RE,
  fieldOf,
  frontmatterKeys,
  indentOf,
  splitLines,
  type FieldId,
  type Line,
  type NoteLanguage,
} from "./monthNoteSyntax";
import type { Deadline, MonthNoteFrontmatter, ParsedMonthNote, ProblemCode, TaskProblem, TaskRecord, TaskStatus } from "./types";

const DEADLINE_RE = /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?$/;
const MONTH_NOTE_FILE_RE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.md$/;

/** `할일/2026-10.md` 같은 경로에서 `2026-10`을 꺼낸다. 월 노트 파일 이름이 아니면 null */
export function monthOfNotePath(path: string): string | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return MONTH_NOTE_FILE_RE.exec(name)?.[1] ?? null;
}

/** 파일 첫 줄이 `---`이면 닫는 `---`까지를 frontmatter로 본다. 본문 시작 줄 번호도 돌려준다. */
function parseFrontmatter(lines: Line[], issues: string[]): { frontmatter: MonthNoteFrontmatter | null; bodyStart: number } {
  if (lines[0]?.text !== "---") return { frontmatter: null, bodyStart: 0 };
  const close = lines.findIndex((line, i) => i > 0 && line.text === "---");
  if (close === -1) {
    issues.push(t("parse.unclosedFrontmatter"));
    return { frontmatter: null, bodyStart: 0 };
  }
  const values = new Map<string, string>();
  for (const line of lines.slice(1, close)) {
    const idx = line.text.indexOf(":");
    if (idx > 0) values.set(line.text.slice(0, idx).trim(), line.text.slice(idx + 1).trim());
  }
  const pick = (keys: string[]) => keys.map((key) => [key, values.get(key)] as const).find(([, value]) => value !== undefined);
  const month = pick(frontmatterKeys("month"))?.[1] ?? null;
  const [flagKey, flagValue] = pick(frontmatterKeys("hasOpen")) ?? [];
  const flag = flagValue?.toLowerCase();
  let hasOpen: boolean | null = null;
  if (flag === "true") hasOpen = true;
  else if (flag === "false") hasOpen = false;
  else if (flag !== undefined) issues.push(t("parse.badOpenFlag", { key: flagKey ?? "", value: flag }));
  return { frontmatter: { month, hasOpen }, bodyStart: close + 1 };
}

function parseDeadline(value: string): Deadline | null {
  const m = DEADLINE_RE.exec(value);
  const date = m?.[1];
  if (!m || !date || !isValidDate(date)) return null;
  const time = m[2] ?? null;
  if (time !== null && !isValidTime(time)) return null;
  return { date, time };
}

function parseTaskBlock(path: string, content: string, lines: Line[], first: number, last: number, lang: NoteLanguage): TaskRecord {
  const header = lines[first];
  const lastLine = lines[last];
  if (!header || !lastLine) throw new Error("항목 범위가 올바르지 않음");
  const m = TASK_HEADER_RE.exec(header.text);
  const symbol = m?.[1] ?? "";
  const title = (m?.[2] ?? "").trim();

  const problems: TaskProblem[] = [];
  const problem = (code: ProblemCode, message: string) => problems.push({ code, message });

  let status: TaskStatus = "open";
  if (symbol === "x" || symbol === "X") status = "done";
  else if (symbol === "-") status = "cancelled";
  else if (symbol !== " ") problem("checkbox", t("parse.badCheckbox", { symbol }));
  if (title === "") problem("title", t("parse.noTitle"));

  const task: TaskRecord = {
    sourcePath: path,
    line: first,
    sourceRange: { start: header.start, end: lastLine.end },
    sourceText: content.slice(header.start, lastLine.end),
    title,
    status,
    firstPlanned: null,
    planned: null,
    deadline: null,
    completedOn: null,
    cancelledOn: null,
    cancelReason: null,
    category: null,
    aliasText: null,
    memo: null,
    unrecognizedLines: [],
    problems,
  };

  const seen = new Set<FieldId>();
  // 문제 문구에 적는 필드 이름은 이 항목이 쓰는 언어를 따른다. 알려진 속성이 없으면 설정한 언어
  let itemLang = lang;
  const singleDate = (key: string, value: string): string | null => {
    if (value === "") return null;
    if (isValidDate(value)) return value;
    problem("date", t("parse.badDate", { key, value }));
    return null;
  };

  // 첫 속성 줄의 들여쓰기를 기준으로 삼는다. 더 깊게 들여쓴 줄은 하위 목록이므로 속성으로 보지 않는다.
  const baseIndent = indentOf(lines[first + 1]?.text ?? "");

  for (const line of lines.slice(first + 1, last + 1)) {
    const prop = indentOf(line.text) === baseIndent ? PROPERTY_RE.exec(line.text) : null;
    const key = prop?.[1]?.trim();
    const value = prop?.[2]?.trim() ?? "";
    const field = key === undefined ? null : fieldOf(key);
    if (!prop || key === undefined || field === null) {
      task.unrecognizedLines.push(line.text);
      continue;
    }
    if (seen.size === 0) itemLang = field.lang;
    // 같은 필드를 두 언어로 한 번씩 적은 것도 두 번 적은 것으로 본다.
    if (seen.has(field.id)) {
      problem("duplicateField", t("parse.duplicate", { key }));
      continue;
    }
    seen.add(field.id);

    switch (field.id) {
      case "planned": {
        // 날짜를 쉼표로 이어 적던 예전 형식은 어느 날짜가 처음이고 어느 날짜가 지금인지 고쳐 적게 한다.
        if (value.includes(",")) problem("planned", t("parse.plannedList", { key, first: FIELD_NAMES[field.lang].firstPlanned }));
        else task.planned = singleDate(key, value);
        break;
      }
      case "firstPlanned": task.firstPlanned = singleDate(key, value); break;
      case "completed": task.completedOn = singleDate(key, value); break;
      case "cancelled": task.cancelledOn = singleDate(key, value); break;
      case "reason": task.cancelReason = value || null; break;
      case "category": task.category = value || null; break;
      case "alias": task.aliasText = value || null; break;
      case "memo": task.memo = value || null; break;
      case "deadline": {
        if (value === "") break;
        const deadline = parseDeadline(value);
        if (deadline) task.deadline = deadline;
        else problem("date", t("parse.badDate", { key, value }));
        break;
      }
    }
  }

  if (task.planned === null && !problems.some((p) => p.code === "planned")) problem("planned", t("parse.missing", { key: FIELD_NAMES[itemLang].planned }));
  // 처음 날짜를 따로 적지 않았으면 한 번도 바꾸지 않은 것이므로 지금 날짜가 처음 날짜다.
  if (!seen.has("firstPlanned")) task.firstPlanned = task.planned;

  return task;
}

/** frontmatter `미완료`(`open`)의 기준. 체크박스 기호가 올바른 `[ ]` 항목이 하나라도 있으면 true */
export function hasOpenTask(tasks: TaskRecord[]): boolean {
  return tasks.some((t) => t.status === "open" && !t.problems.some((p) => p.code === "checkbox"));
}

/**
 * 월 파일 본문에서 frontmatter와 최상위 체크리스트 항목을 읽는다. 잘못된 항목도 버리지 않는다.
 * 필드 이름은 두 언어를 모두 읽는다. `lang`은 속성이 하나도 없는 항목의 문제 문구에만 쓴다.
 */
export function parseMonthNote(path: string, content: string, lang: NoteLanguage = "ko"): ParsedMonthNote {
  const issues: string[] = [];
  const lines = splitLines(content);
  const { frontmatter, bodyStart } = parseFrontmatter(lines, issues);

  const tasks: TaskRecord[] = [];
  let i = bodyStart;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || !TASK_HEADER_RE.test(line.text)) {
      i += 1;
      continue;
    }
    let last = i;
    while (lines[last + 1] && INDENTED_RE.test(lines[last + 1]?.text ?? "")) last += 1;
    tasks.push(parseTaskBlock(path, content, lines, i, last, lang));
    i = last + 1;
  }

  const fileMonth = monthOfNotePath(path);
  if (frontmatter) {
    if (frontmatter.month === null) issues.push(t("parse.noMonth"));
    else if (fileMonth !== null && frontmatter.month !== fileMonth) {
      issues.push(t("parse.monthMismatch", { month: frontmatter.month, file: fileMonth }));
    }
    const hasOpen = hasOpenTask(tasks);
    if (frontmatter.hasOpen !== null && frontmatter.hasOpen !== hasOpen) {
      issues.push(t("parse.openMismatch", { flag: frontmatter.hasOpen, body: hasOpen }));
    }
  } else if (tasks.length > 0) {
    issues.push(t("parse.noFrontmatter"));
  }

  return { path, frontmatter, tasks, issues };
}
