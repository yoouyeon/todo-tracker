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
export type ProblemCode = "checkbox" | "title" | "planned" | "date" | "duplicateField";

export interface TaskProblem {
  code: ProblemCode;
  message: string;
}

export interface TaskRecord {
  sourcePath: string;
  /** 헤더 줄의 줄 번호(0부터). 노트를 열 때 이동하는 데 쓴다. */
  line: number;
  /** 파일 본문 안의 문자 위치. 헤더 줄 시작부터 마지막 속성 줄 끝까지(줄바꿈 제외) */
  sourceRange: { start: number; end: number };
  sourceText: string;
  title: string;
  /** 체크박스 기호가 올바르지 않으면 problems에 `checkbox`가 있고 값은 "open"이다. */
  status: TaskStatus;
  /** 처음 하기로 한 날. `처음 하기로 한 날` 속성이 없으면 `planned`와 같다. 읽을 수 없으면 null */
  firstPlanned: string | null;
  /** 지금 하기로 한 날(`하기로 한 날`). 읽을 수 없으면 null */
  planned: string | null;
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

export interface MonthNoteFrontmatter {
  month: string | null;
  hasOpen: boolean | null;
}

export interface ParsedMonthNote {
  path: string;
  frontmatter: MonthNoteFrontmatter | null;
  tasks: TaskRecord[];
  /** 파일 전체에 관한 문제. 항목 문제는 각 항목의 problems에 있다. */
  issues: string[];
}
