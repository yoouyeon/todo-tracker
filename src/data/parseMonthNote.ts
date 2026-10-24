import { isValidDate, isValidTime } from "../logic/dates";
import { FIELD, INDENTED_RE, KNOWN_FIELDS, PROPERTY_RE, TASK_HEADER_RE, indentOf, splitLines, type Line } from "./monthNoteSyntax";
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
    issues.push("frontmatter를 닫는 `---`가 없음");
    return { frontmatter: null, bodyStart: 0 };
  }
  const values = new Map<string, string>();
  for (const line of lines.slice(1, close)) {
    const idx = line.text.indexOf(":");
    if (idx > 0) values.set(line.text.slice(0, idx).trim(), line.text.slice(idx + 1).trim());
  }
  const month = values.get("월") ?? null;
  const flag = values.get("미완료")?.toLowerCase();
  let hasOpen: boolean | null = null;
  if (flag === "true") hasOpen = true;
  else if (flag === "false") hasOpen = false;
  else if (flag !== undefined) issues.push(`frontmatter 미완료 값이 true/false가 아님: ${flag}`);
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

function parseTaskBlock(path: string, content: string, lines: Line[], first: number, last: number): TaskRecord {
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
  else if (symbol !== " ") problem("checkbox", `체크박스 기호를 알 수 없음: [${symbol}]`);
  if (title === "") problem("title", "제목이 비어 있음");

  const task: TaskRecord = {
    sourcePath: path,
    line: first,
    sourceRange: { start: header.start, end: lastLine.end },
    sourceText: content.slice(header.start, lastLine.end),
    title,
    status,
    plannedDates: [],
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

  const seen = new Set<string>();
  let plannedSeen = false;
  const singleDate = (key: string, value: string): string | null => {
    if (value === "") return null;
    if (isValidDate(value)) return value;
    problem("date", `${key} 형식 오류: ${value}`);
    return null;
  };

  // 첫 속성 줄의 들여쓰기를 기준으로 삼는다. 더 깊게 들여쓴 줄은 하위 목록이므로 속성으로 보지 않는다.
  const baseIndent = indentOf(lines[first + 1]?.text ?? "");

  for (const line of lines.slice(first + 1, last + 1)) {
    const prop = indentOf(line.text) === baseIndent ? PROPERTY_RE.exec(line.text) : null;
    const key = prop?.[1]?.trim();
    const value = prop?.[2]?.trim() ?? "";
    if (!prop || key === undefined || !KNOWN_FIELDS.has(key)) {
      task.unrecognizedLines.push(line.text);
      continue;
    }
    if (seen.has(key)) {
      problem("duplicateField", `${key} 속성이 두 번 이상 나옴`);
      continue;
    }
    seen.add(key);

    switch (key) {
      case FIELD.planned: {
        plannedSeen = true;
        for (const token of value.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (isValidDate(token)) task.plannedDates.push(token);
          else problem("date", `${key} 형식 오류: ${token}`);
        }
        break;
      }
      case FIELD.completed: task.completedOn = singleDate(key, value); break;
      case FIELD.cancelled: task.cancelledOn = singleDate(key, value); break;
      case FIELD.reason: task.cancelReason = value || null; break;
      case FIELD.category: task.category = value || null; break;
      case FIELD.alias: task.aliasText = value || null; break;
      case FIELD.memo: task.memo = value || null; break;
      case FIELD.deadline: {
        if (value === "") break;
        const deadline = parseDeadline(value);
        if (deadline) task.deadline = deadline;
        else problem("date", `${key} 형식 오류: ${value}`);
        break;
      }
    }
  }

  if (!plannedSeen || task.plannedDates.length === 0) {
    if (!problems.some((p) => p.code === "plannedDates")) problem("plannedDates", `${FIELD.planned} 없음`);
  } else if (task.plannedDates.some((d, i) => i > 0 && d <= (task.plannedDates[i - 1] ?? ""))) {
    problem("plannedDates", `${FIELD.planned}의 날짜가 오래된 순서가 아니거나 겹침`);
  }

  return task;
}

/** frontmatter `미완료`의 기준. 체크박스 기호가 올바른 `[ ]` 항목이 하나라도 있으면 true */
export function hasOpenTask(tasks: TaskRecord[]): boolean {
  return tasks.some((t) => t.status === "open" && !t.problems.some((p) => p.code === "checkbox"));
}

/** 월 파일 본문에서 frontmatter와 최상위 체크리스트 항목을 읽는다. 잘못된 항목도 버리지 않는다. */
export function parseMonthNote(path: string, content: string): ParsedMonthNote {
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
    tasks.push(parseTaskBlock(path, content, lines, i, last));
    i = last + 1;
  }

  const fileMonth = monthOfNotePath(path);
  if (frontmatter) {
    if (frontmatter.month === null) issues.push("frontmatter에 월이 없음");
    else if (fileMonth !== null && frontmatter.month !== fileMonth) {
      issues.push(`frontmatter 월(${frontmatter.month})이 파일 이름(${fileMonth})과 다름`);
    }
    const hasOpen = hasOpenTask(tasks);
    if (frontmatter.hasOpen !== null && frontmatter.hasOpen !== hasOpen) {
      issues.push(`frontmatter 미완료(${frontmatter.hasOpen})가 본문(${hasOpen})과 다름`);
    }
  } else if (tasks.length > 0) {
    issues.push("frontmatter가 없음");
  }

  return { path, frontmatter, tasks, issues };
}
