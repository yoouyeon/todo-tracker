import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ledgerMonthOfPath, parseLedger } from "../../src/data/parseLedger";
import type { TaskRecord } from "../../src/data/types";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const OCT = fixture("2026-10.md");
const SEP = fixture("2026-09.md");

function byTitle(tasks: TaskRecord[], title: string): TaskRecord[] {
  return tasks.filter((t) => t.title === title);
}
function only(tasks: TaskRecord[], title: string): TaskRecord {
  const found = byTitle(tasks, title);
  if (found.length !== 1) throw new Error(`"${title}" 항목이 ${found.length}개`);
  return found[0] as TaskRecord;
}
const codes = (t: TaskRecord) => t.problems.map((p) => p.code);

describe("ledgerMonthOfPath", () => {
  it("월 장부 파일 이름에서 월을 꺼낸다", () => {
    expect(ledgerMonthOfPath("할일/2026-10.md")).toBe("2026-10");
    expect(ledgerMonthOfPath("2026-01.md")).toBe("2026-01");
  });

  it("월 장부 파일이 아니면 null이다", () => {
    expect(ledgerMonthOfPath("할일/AGENTS.md")).toBeNull();
    expect(ledgerMonthOfPath("할일/2026-13.md")).toBeNull();
    expect(ledgerMonthOfPath("할일/2026-10.txt")).toBeNull();
    expect(ledgerMonthOfPath("할일/메모 2026-10.md")).toBeNull();
  });
});

describe("parseLedger: 기본 형식", () => {
  const ledger = parseLedger("할일/2026-10.md", OCT);

  it("frontmatter를 읽고 파일 문제가 없다", () => {
    expect(ledger.frontmatter).toEqual({ month: "2026-10", hasOpen: true });
    expect(ledger.issues).toEqual([]);
  });

  it("최상위 체크리스트를 모두 항목으로 읽는다", () => {
    expect(ledger.tasks).toHaveLength(12);
    expect(ledger.tasks.every((t) => t.sourcePath === "할일/2026-10.md")).toBe(true);
  });

  it("체크박스 기호로 상태를 정한다", () => {
    expect(only(ledger.tasks, "아침 스트레칭").status).toBe("done");
    expect(only(ledger.tasks, "헬스장 1일권 구매").status).toBe("cancelled");
    expect(only(ledger.tasks, "여행 사진 정리").status).toBe("open");
  });

  it("계획 날짜 이력을 오래된 순서 그대로 읽는다", () => {
    expect(only(ledger.tasks, "여행 사진 정리").plannedDates).toEqual(["2026-10-09", "2026-10-12"]);
    expect(only(ledger.tasks, "보고서 초안 제출").plannedDates).toEqual(["2026-10-14", "2026-10-18"]);
  });

  it("완료·취소 날짜와 이유를 읽는다", () => {
    const done = only(ledger.tasks, "아침 스트레칭");
    expect(done.completedOn).toBe("2026-10-18");
    expect(done.cancelledOn).toBeNull();
    const cancelled = only(ledger.tasks, "헬스장 1일권 구매");
    expect(cancelled.cancelledOn).toBe("2026-10-12");
    expect(cancelled.cancelReason).toBe("집 근처에 새 헬스장이 생겨서 필요 없어짐");
  });

  it("마감일을 시각 유무와 함께 읽는다", () => {
    expect(only(ledger.tasks, "보고서 초안 제출").deadline).toEqual({ date: "2026-10-17", time: "18:00" });
    expect(only(ledger.tasks, "부모님 선물 주문").deadline).toEqual({ date: "2026-10-28", time: null });
    expect(only(ledger.tasks, "여행 사진 정리").deadline).toBeNull();
  });

  it("분류와 메모를 읽는다", () => {
    const task = only(ledger.tasks, "여행 사진 정리");
    expect(task.category).toBe("개인");
    expect(task.memo).toBe("계획 날짜는 아직 미정");
  });

  it("메모 값 안의 콜론과 쉼표를 그대로 둔다", () => {
    expect(only(ledger.tasks, "강의 3강 듣기").memo).toBe("10:30에 시작, 2강 복습 포함");
  });
});

describe("parseLedger: 같은 이름과 다른 이름", () => {
  const ledger = parseLedger("할일/2026-10.md", OCT);

  it("같은 이름의 항목을 합치지 않고 따로 둔다", () => {
    const same = byTitle(ledger.tasks, "알고리즘 2문제");
    expect(same.map((t) => t.status)).toEqual(["open", "done"]);
    expect(same[0]?.plannedDates).toEqual(["2026-10-17", "2026-10-18"]);
    expect(same[1]?.plannedDates).toEqual(["2026-10-10"]);
  });

  it("다른 이름은 쉼표가 들어 있어도 쪼개지 않고 원문 그대로 둔다", () => {
    expect(only(ledger.tasks, "강의 3강 듣기").aliasText).toBe("강의 듣기 part 3, 강의 part 3, 4, 강의 part 3, 4, 5");
    expect(only(ledger.tasks, "아침 스트레칭").aliasText).toBeNull();
  });
});

describe("parseLedger: 원문 위치", () => {
  const ledger = parseLedger("할일/2026-10.md", OCT);

  it("sourceRange가 sourceText와 같은 구간을 가리킨다", () => {
    for (const task of ledger.tasks) {
      expect(OCT.slice(task.sourceRange.start, task.sourceRange.end)).toBe(task.sourceText);
      expect(task.sourceText.startsWith("- [")).toBe(true);
    }
  });

  it("line이 항목 헤더 줄의 번호(0부터)를 가리킨다", () => {
    const lines = OCT.split("\n");
    for (const task of ledger.tasks) {
      expect(lines[task.line]).toBe(task.sourceText.split("\n")[0]);
    }
    expect(only(ledger.tasks, "여행 사진 정리").line).toBe(7);
  });

  it("항목 끝의 빈 줄과 줄바꿈을 포함하지 않는다", () => {
    const task = only(ledger.tasks, "아침 스트레칭");
    expect(task.sourceText).toBe(["- [x] 아침 스트레칭", "  - 하기로 한 날: 2026-10-18", "  - 완료한 날: 2026-10-18", "  - 분류: 생활"].join("\n"));
  });

  it("CRLF 파일도 같은 항목으로 읽고 위치가 맞는다", () => {
    const crlf = OCT.replace(/\n/g, "\r\n");
    const parsed = parseLedger("할일/2026-10.md", crlf);
    expect(parsed.tasks.map((t) => [t.title, t.status])).toEqual(ledger.tasks.map((t) => [t.title, t.status]));
    for (const task of parsed.tasks) {
      expect(crlf.slice(task.sourceRange.start, task.sourceRange.end)).toBe(task.sourceText);
      expect(task.sourceText.endsWith("\r")).toBe(false);
    }
    expect(parsed.frontmatter).toEqual({ month: "2026-10", hasOpen: true });
  });
});

describe("parseLedger: 모르는 속성 보존", () => {
  const ledger = parseLedger("할일/2026-10.md", OCT);
  const task = only(ledger.tasks, "독서 모임 발제문 쓰기");

  it("모르는 속성 줄과 더 깊게 들여쓴 줄을 들여쓰기까지 그대로 담는다", () => {
    expect(task.unrecognizedLines).toEqual([
      "  - 링크: https://example.com/notes",
      "  - 우선순위: 높음",
      "    - 하위 설명: 들여쓰기가 더 깊은 줄",
      "    - 메모: 하위 목록의 메모는 속성이 아님",
    ]);
  });

  it("하위 목록의 `메모`를 메모 속성으로 읽지 않는다", () => {
    expect(task.memo).toBeNull();
    expect(task.problems).toEqual([]);
  });

  it("알려진 속성은 모르는 줄과 상관없이 읽는다", () => {
    expect(task.category).toBe("공부");
    expect(task.plannedDates).toEqual(["2026-10-19"]);
  });
});

describe("parseLedger: 잘못된 항목", () => {
  const ledger = parseLedger("할일/2026-10.md", OCT);

  it("형식이 틀려도 항목을 숨기지 않고 문제를 기록한다", () => {
    const task = only(ledger.tasks, "형식이 틀린 날짜");
    expect(task.plannedDates).toEqual([]);
    expect(task.deadline).toBeNull();
    expect(codes(task)).toEqual(["date", "date", "date", "plannedDates"]);
    expect(task.problems[0]?.message).toContain("10/24");
    expect(task.problems[1]?.message).toContain("2026-02-30");
  });

  it("알 수 없는 체크박스 기호는 문제로 기록하고 진행 중으로 둔다", () => {
    const task = only(ledger.tasks, "알 수 없는 기호");
    expect(codes(task)).toEqual(["checkbox"]);
    expect(task.status).toBe("open");
    expect(task.plannedDates).toEqual(["2026-10-20"]);
  });

  it("하기로 한 날이 없으면 문제로 기록한다", () => {
    const task = only(ledger.tasks, "하기로 한 날이 없는 항목");
    expect(codes(task)).toEqual(["plannedDates"]);
    expect(task.problems[0]?.message).toBe("하기로 한 날 없음");
  });

  it("정상 항목에는 문제가 없다", () => {
    const clean = ledger.tasks.filter((t) => !["형식이 틀린 날짜", "알 수 없는 기호", "하기로 한 날이 없는 항목"].includes(t.title));
    expect(clean).toHaveLength(9);
    expect(clean.every((t) => t.problems.length === 0)).toBe(true);
  });
});

describe("parseLedger: 계획 날짜 검증", () => {
  const parse = (body: string) => parseLedger("할일/2026-10.md", `---\n월: 2026-10\n미완료: true\n---\n\n${body}\n`).tasks;

  it("날짜가 오래된 순서가 아니면 문제로 기록한다", () => {
    const [task] = parse("- [ ] 순서 뒤바뀜\n  - 하기로 한 날: 2026-10-12, 2026-10-05");
    expect(codes(task as TaskRecord)).toEqual(["plannedDates"]);
  });

  it("같은 날짜가 겹치면 문제로 기록한다", () => {
    const [task] = parse("- [ ] 날짜 중복\n  - 하기로 한 날: 2026-10-05, 2026-10-05");
    expect(codes(task as TaskRecord)).toEqual(["plannedDates"]);
  });

  it("같은 속성이 두 번 나오면 첫 값을 쓰고 문제로 기록한다", () => {
    const [task] = parse("- [ ] 분류 두 번\n  - 하기로 한 날: 2026-10-05\n  - 분류: 개인\n  - 분류: 공부");
    expect(task?.category).toBe("개인");
    expect(codes(task as TaskRecord)).toEqual(["duplicateField"]);
  });

  it("제목이 비어 있으면 문제로 기록한다", () => {
    const [task] = parse("- [ ]\n  - 하기로 한 날: 2026-10-05");
    expect(task?.title).toBe("");
    expect(codes(task as TaskRecord)).toEqual(["title"]);
  });

  it("빈 값의 속성은 없는 것으로 읽는다", () => {
    const [task] = parse("- [ ] 빈 값\n  - 하기로 한 날: 2026-10-05\n  - 분류:\n  - 메모:");
    expect(task?.category).toBeNull();
    expect(task?.memo).toBeNull();
    expect(task?.problems).toEqual([]);
  });
});

describe("parseLedger: 파일 단위 문제", () => {
  it("frontmatter 월이 파일 이름과 다르면 알린다", () => {
    const ledger = parseLedger("할일/2026-11.md", OCT);
    expect(ledger.issues).toContain("frontmatter 월(2026-10)이 파일 이름(2026-11)과 다름");
  });

  it("미완료 값이 본문과 다르면 알린다", () => {
    const content = OCT.replace("미완료: true", "미완료: false");
    expect(parseLedger("할일/2026-10.md", content).issues).toContain("frontmatter 미완료(false)가 본문(true)과 다름");
  });

  it("진행 중 항목이 없으면 미완료는 false가 맞다", () => {
    const content = "---\n월: 2026-10\n미완료: false\n---\n\n- [x] 끝난 일\n  - 하기로 한 날: 2026-10-05\n  - 완료한 날: 2026-10-05\n";
    expect(parseLedger("할일/2026-10.md", content).issues).toEqual([]);
  });

  it("frontmatter가 없으면 알리고 본문은 읽는다", () => {
    const ledger = parseLedger("할일/2026-10.md", "- [ ] 할 일\n  - 하기로 한 날: 2026-10-05\n");
    expect(ledger.frontmatter).toBeNull();
    expect(ledger.issues).toContain("frontmatter가 없음");
    expect(ledger.tasks).toHaveLength(1);
  });

  it("월 파일 이름이 아닌 경로면 월 비교를 하지 않는다", () => {
    expect(parseLedger("할일/임시.md", OCT).issues).toEqual([]);
  });

  it("항목이 없는 빈 파일도 읽는다", () => {
    const ledger = parseLedger("할일/2026-10.md", "");
    expect(ledger.tasks).toEqual([]);
    expect(ledger.frontmatter).toBeNull();
    expect(ledger.issues).toEqual([]);
  });
});

describe("parseLedger: 지난달 파일", () => {
  const ledger = parseLedger("할일/2026-09.md", SEP);

  it("지난달 파일에 남은 진행 중 항목의 이력은 다음 달 날짜까지 이어진다", () => {
    const task = only(ledger.tasks, "겨울옷 꺼내기");
    expect(task.status).toBe("open");
    expect(task.plannedDates).toEqual(["2026-09-28", "2026-10-05"]);
    expect(task.sourcePath).toBe("할일/2026-09.md");
    expect(ledger.issues).toEqual([]);
  });
});
