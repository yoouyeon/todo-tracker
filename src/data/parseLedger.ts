import { isValidDate, isValidTime } from "../logic/dates";
import type { Deadline, LedgerFrontmatter, ParsedLedger, ProblemCode, TaskProblem, TaskRecord, TaskStatus } from "./types";

interface Line {
  /** 줄 끝의 \r을 뺀 내용 */
  text: string;
  start: number;
  /** 줄바꿈과 \r을 뺀 끝 위치 */
  end: number;
}

const TASK_HEADER_RE = /^- \[([^\]]*)\][ \t]*(.*)$/;
const PROPERTY_RE = /^[ \t]+- ([^:]+?):[ \t]*(.*)$/;
const INDENTED_RE = /^[ \t]+\S/;
const DEADLINE_RE = /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?$/;
const LEDGER_FILE_RE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.md$/;

const FIELD = {
  planned: "하기로 한 날",
  completed: "완료한 날",
  cancelled: "취소한 날",
  reason: "이유",
  category: "분류",
  alias: "다른 이름",
  deadline: "마감일",
  memo: "메모",
} as const;

const KNOWN_FIELDS: ReadonlySet<string> = new Set(Object.values(FIELD));

/** `할일/2026-10.md` 같은 경로에서 `2026-10`을 꺼낸다. 월 장부 파일 이름이 아니면 null */
export function ledgerMonthOfPath(path: string): string | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return LEDGER_FILE_RE.exec(name)?.[1] ?? null;
}

function splitLines(content: string): Line[] {
  const lines: Line[] = [];
  let pos = 0;
  for (;;) {
    const nl = content.indexOf("\n", pos);
    const lineEnd = nl === -1 ? content.length : nl;
    const raw = content.slice(pos, lineEnd);
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    lines.push({ text, start: pos, end: pos + text.length });
    if (nl === -1) break;
    pos = nl + 1;
  }
  return lines;
}

/** 파일 첫 줄이 `---`이면 닫는 `---`까지를 frontmatter로 본다. 본문 시작 줄 번호도 돌려준다. */
function parseFrontmatter(lines: Line[], issues: string[]): { frontmatter: LedgerFrontmatter | null; bodyStart: number } {
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
  const indentOf = (text: string) => /^[ \t]*/.exec(text)?.[0] ?? "";
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
      problem("duplicateField", `${key}가 두 번 이상 나옴`);
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
    if (!problems.some((p) => p.code === "plannedDates")) problem("plannedDates", `${FIELD.planned}가 없음`);
  } else if (task.plannedDates.some((d, i) => i > 0 && d <= (task.plannedDates[i - 1] ?? ""))) {
    problem("plannedDates", `${FIELD.planned}가 오래된 순서가 아니거나 같은 날짜가 겹침`);
  }

  return task;
}

/** 월 파일 본문에서 frontmatter와 최상위 체크리스트 항목을 읽는다. 잘못된 항목도 버리지 않는다. */
export function parseLedger(path: string, content: string): ParsedLedger {
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

  const fileMonth = ledgerMonthOfPath(path);
  if (frontmatter) {
    if (frontmatter.month === null) issues.push("frontmatter에 월이 없음");
    else if (fileMonth !== null && frontmatter.month !== fileMonth) {
      issues.push(`frontmatter 월(${frontmatter.month})이 파일 이름(${fileMonth})과 다름`);
    }
    const hasOpen = tasks.some((t) => t.status === "open" && !t.problems.some((p) => p.code === "checkbox"));
    if (frontmatter.hasOpen !== null && frontmatter.hasOpen !== hasOpen) {
      issues.push(`frontmatter 미완료(${frontmatter.hasOpen})가 본문(${hasOpen})과 다름`);
    }
  } else if (tasks.length > 0) {
    issues.push("frontmatter가 없음");
  }

  return { path, frontmatter, tasks, issues };
}
