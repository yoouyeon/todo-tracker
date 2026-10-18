export type TaskStatus = "open" | "done" | "cancelled";

export interface Deadline {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm. 날짜만 있으면 null */
  time: string | null;
}

/**
 * 항목을 믿고 수정해도 되는지 판단하는 문제 종류.
 * 문제가 하나라도 있는 항목은 읽기 전용으로 보여 준다.
 */
export type ProblemCode = "checkbox" | "title" | "plannedDates" | "date" | "duplicateField";

export interface TaskProblem {
  code: ProblemCode;
  message: string;
}

export interface TaskRecord {
  sourcePath: string;
  /** 파일 본문 안의 문자 위치. 헤더 줄 시작부터 마지막 속성 줄 끝까지(줄바꿈 제외) */
  sourceRange: { start: number; end: number };
  sourceText: string;
  title: string;
  /** 체크박스 기호가 올바르지 않으면 problems에 `checkbox`가 있고 값은 "open"이다. */
  status: TaskStatus;
  /** 오래된 순서. 잘못된 날짜는 빠진다. */
  plannedDates: string[];
  deadline: Deadline | null;
  completedOn: string | null;
  cancelledOn: string | null;
  cancelReason: string | null;
  category: string | null;
  /** `다른 이름`의 원문. 이름 안에 쉼표가 들어갈 수 있어서 쪼개지 않는다. */
  aliasText: string | null;
  memo: string | null;
  /** 플러그인이 모르는 속성 줄과 들여쓰기가 깊은 줄. 들여쓰기를 포함한 원문 */
  unrecognizedLines: string[];
  problems: TaskProblem[];
}

export interface LedgerFrontmatter {
  month: string | null;
  hasOpen: boolean | null;
}

export interface ParsedLedger {
  path: string;
  frontmatter: LedgerFrontmatter | null;
  tasks: TaskRecord[];
  /** 파일 전체에 관한 문제. 항목 문제는 각 항목의 problems에 있다. */
  issues: string[];
}
