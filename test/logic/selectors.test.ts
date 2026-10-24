import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import { buildBoard, findOpenDuplicates, NO_FILTERS, type Board, type Clock, type Filters } from "../../src/logic/selectors";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const monthNotes = [parseMonthNote("할일/2026-10.md", fixture("2026-10.md")), parseMonthNote("할일/2026-09.md", fixture("2026-09.md"))];
const clock: Clock = { today: "2026-10-18", time: "19:00" };
const board = (filters: Partial<Filters> = {}, c: Clock = clock) => buildBoard(monthNotes, c, { ...NO_FILTERS, ...filters });
const titles = (items: Board["past"]) => items.map((i) => i.task.title);

describe("buildBoard: 묶음", () => {
  const b = board();

  it("현재 계획 날짜로 지난 계획·오늘·예정에 나눈다", () => {
    expect(titles(b.past)).toEqual(["겨울옷 꺼내기", "여행 사진 정리"]);
    expect(titles(b.today)).toEqual(["보고서 초안 제출", "알고리즘 2문제"]);
    expect(titles(b.upcoming)).toEqual(["독서 모임 발제문 쓰기", "부모님 선물 주문"]);
  });

  it("지난달 파일에 남은 진행 중 항목도 모은다", () => {
    const winter = b.past.find((i) => i.task.title === "겨울옷 꺼내기");
    expect(winter?.task.sourcePath).toBe("할일/2026-09.md");
    expect(winter?.first).toBe("2026-09-28");
    expect(winter?.current).toBe("2026-10-05");
  });

  it("진행 중 항목을 한 묶음에만 놓는다", () => {
    const all = [...b.past, ...b.today, ...b.upcoming].map((i) => i.key);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(6);
  });

  it("오늘 완료한 항목은 오늘 묶음과 따로 모은다", () => {
    expect(titles(b.doneToday)).toEqual(["아침 스트레칭"]);
    expect(titles(b.today)).not.toContain("아침 스트레칭");
  });

  it("문제가 있는 항목은 어느 묶음에도 넣지 않고 따로 모은다", () => {
    expect(titles(b.problems)).toEqual(["형식이 틀린 날짜", "알 수 없는 기호", "하기로 한 날이 없는 항목"]);
    const placed = [...b.past, ...b.today, ...b.upcoming, ...b.records].map((i) => i.task.title);
    for (const t of titles(b.problems)) expect(placed).not.toContain(t);
  });
});

describe("buildBoard: 오래 밀린 일과 정렬", () => {
  const b = board();

  it("처음 계획한 날부터 7일 이상 지난 항목을 표시한다", () => {
    expect(b.past.map((i) => [i.task.title, i.age, i.stale])).toEqual([
      ["겨울옷 꺼내기", 20, true],
      ["여행 사진 정리", 9, true],
    ]);
  });

  it("오래 밀린 일은 지난 계획과 오늘에만 붙이고, 아직 계획한 날이 오지 않은 예정 항목에는 붙이지 않는다", () => {
    const october = parseMonthNote(
      "할일/2026-10.md",
      "---\n월: 2026-10\n미완료: true\n---\n\n" +
        "- [ ] 지난 계획으로 미룬 일\n  - 처음 하기로 한 날: 2026-10-01\n  - 하기로 한 날: 2026-10-10\n" +
        "- [ ] 오늘로 다시 잡은 일\n  - 처음 하기로 한 날: 2026-10-01\n  - 하기로 한 날: 2026-10-18\n" +
        "- [ ] 다음 달로 미룬 일\n  - 처음 하기로 한 날: 2026-10-01\n  - 하기로 한 날: 2026-11-05\n",
    );
    const result = buildBoard([october], clock, NO_FILTERS);
    const staleOf = (items: Board["past"]) => items.map((i) => [i.task.title, i.age, i.stale]);
    expect(staleOf(result.past)).toEqual([["지난 계획으로 미룬 일", 17, true]]);
    expect(staleOf(result.today)).toEqual([["오늘로 다시 잡은 일", 17, true]]);
    expect(staleOf(result.upcoming)).toEqual([["다음 달로 미룬 일", 17, false]]);
    // 지난 계획 카드의 숫자는 지난 계획 안의 것만 센다.
    expect(result.counts.stale).toBe(1);
  });

  it("현재 계획 날짜가 아니라 처음 계획한 날로 센다", () => {
    // 겨울옷은 현재 계획 날짜가 10/5지만 처음 날짜 9/28 기준으로 20일째다.
    const winter = b.past[0];
    expect(winter?.current).toBe("2026-10-05");
    expect(winter?.age).toBe(20);
  });

  it("지난 계획은 오래 밀린 일부터 오래된 순으로, 그 뒤에 마감, 현재 계획 날짜 순이다", () => {
    const october = parseMonthNote(
      "할일/2026-10.md",
      "---\n월: 2026-10\n미완료: true\n---\n\n" +
        "- [ ] 마감 지난 일\n  - 하기로 한 날: 2026-10-16\n  - 마감일: 2026-10-17\n" +
        "- [ ] 마감 없는 어제 일\n  - 하기로 한 날: 2026-10-17\n" +
        "- [ ] 마감 임박한 그제 일\n  - 하기로 한 날: 2026-10-15\n  - 마감일: 2026-10-20\n" +
        "- [ ] 마감 여유 있는 그제 일\n  - 하기로 한 날: 2026-10-15\n  - 마감일: 2026-11-30\n",
    );
    const september = parseMonthNote("할일/2026-09.md", fixture("2026-09.md"));
    const result = buildBoard([october, september], clock, NO_FILTERS);
    expect(titles(result.past)).toEqual([
      "겨울옷 꺼내기",
      "마감 지난 일",
      "마감 임박한 그제 일",
      "마감 여유 있는 그제 일",
      "마감 없는 어제 일",
    ]);
  });

  it("오늘 묶음은 마감이 지난 것, 임박한 것 순으로 앞에 둔다", () => {
    expect(b.today[0]?.deadline).toEqual({ state: "overdue", label: "마감 지남" });
  });

  it("예정은 현재 계획 날짜 순이다", () => {
    expect(b.upcoming.map((i) => i.current)).toEqual(["2026-10-19", "2026-10-22"]);
  });
});

describe("buildBoard: 마감", () => {
  it("오늘 지난 시각은 지남, 아직 안 지난 시각과 날짜만 있는 마감은 임박이다", () => {
    const evening = board({}, { today: "2026-10-17", time: "20:00" });
    const report = evening.past.concat(evening.today, evening.upcoming).find((i) => i.task.title === "보고서 초안 제출");
    expect(report?.deadline?.state).toBe("overdue");
    const morning = board({}, { today: "2026-10-17", time: "09:00" });
    const early = morning.past.concat(morning.today, morning.upcoming).find((i) => i.task.title === "보고서 초안 제출");
    expect(early?.deadline?.state).toBe("soon");
    expect(early?.deadline?.label).toBe("오늘 마감");
  });

  it("마감 필터는 지났거나 임박한 진행 중 항목만 남긴다", () => {
    const b = board({ deadlineOnly: true });
    expect(titles(b.past)).toEqual([]);
    expect(titles(b.today)).toEqual(["보고서 초안 제출"]);
    expect(titles(b.upcoming)).toEqual([]);
    expect(b.doneToday).toEqual([]);
  });

  it("마감 필터를 켜도 요약 개수는 그대로다", () => {
    expect(board({ deadlineOnly: true }).counts).toEqual(board().counts);
  });
});

describe("buildBoard: 분류와 검색", () => {
  it("분류로 거른다", () => {
    const b = board({ category: "공부" });
    expect(titles(b.today)).toEqual(["보고서 초안 제출", "알고리즘 2문제"]);
    expect(titles(b.upcoming)).toEqual(["독서 모임 발제문 쓰기"]);
    expect(titles(b.past)).toEqual([]);
  });

  it("제목으로 검색한다", () => {
    expect(titles(board({ query: "사진" }).past)).toEqual(["여행 사진 정리"]);
    expect(titles(board({ query: "  알고리즘 " }).today)).toEqual(["알고리즘 2문제"]);
  });

  it("다른 이름으로도 검색한다", () => {
    expect(titles(board({ query: "강의 part 3, 4" }).records)).toEqual(["강의 3강 듣기"]);
    expect(titles(board({ query: "사진 정리" }).past)).toEqual(["여행 사진 정리"]);
  });

  it("분류 목록을 가나다 순으로 돌려준다", () => {
    expect(board().categories).toEqual(["개인", "공부", "생활"]);
  });
});

describe("buildBoard: 기록", () => {
  it("완료·취소 항목을 처리한 날이 최근인 순서로 놓는다", () => {
    expect(titles(board().records)).toEqual(["아침 스트레칭", "강의 3강 듣기", "헬스장 1일권 구매", "알고리즘 2문제", "이사 준비 목록 쓰기"]);
  });

  it("같은 이름의 완료 항목과 진행 중 항목을 합치지 않는다", () => {
    const b = board();
    expect(titles(b.records).filter((t) => t === "알고리즘 2문제")).toHaveLength(1);
    expect(titles(b.today).filter((t) => t === "알고리즘 2문제")).toHaveLength(1);
  });

  it("상태로 거른다", () => {
    expect(titles(board({ recordStatus: "cancelled" }).records)).toEqual(["헬스장 1일권 구매"]);
    expect(board({ recordStatus: "done" }).records).toHaveLength(4);
  });

  it("월로 거른다", () => {
    expect(titles(board({ recordMonth: "2026-09" }).records)).toEqual(["이사 준비 목록 쓰기"]);
    expect(board({ recordMonth: "2026-10" }).records).toHaveLength(4);
  });

  it("월 선택지는 최근 달이 먼저다", () => {
    expect(board().recordMonths).toEqual(["2026-10", "2026-09"]);
  });
});

describe("findOpenDuplicates", () => {
  it("제목이 완전히 같은 진행 중 항목을 찾는다", () => {
    const found = findOpenDuplicates(monthNotes, "알고리즘 2문제");
    expect(found.map((t) => t.status)).toEqual(["open"]);
    expect([found[0]?.firstPlanned, found[0]?.planned]).toEqual(["2026-10-17", "2026-10-18"]);
  });

  it("끝난 항목과 읽을 수 없는 항목은 찾지 않는다", () => {
    expect(findOpenDuplicates(monthNotes, "아침 스트레칭")).toEqual([]);
    expect(findOpenDuplicates(monthNotes, "알 수 없는 기호")).toEqual([]);
  });

  it("비슷한 이름은 같다고 보지 않는다", () => {
    expect(findOpenDuplicates(monthNotes, "알고리즘")).toEqual([]);
    expect(findOpenDuplicates(monthNotes, "알고리즘 3문제")).toEqual([]);
  });

  it("입력의 줄바꿈과 연속 공백은 저장될 때처럼 정리해서 비교한다", () => {
    expect(findOpenDuplicates(monthNotes, "  알고리즘   2문제 ")).toHaveLength(1);
    expect(findOpenDuplicates(monthNotes, "   ")).toEqual([]);
  });
});

describe("buildBoard: 개수", () => {
  it("요약 카드에 쓰는 개수를 센다", () => {
    expect(board().counts).toEqual({
      past: 2,
      today: 2,
      upcoming: 2,
      stale: 2,
      deadlineAlert: 1,
      records: 5,
      done: 4,
      cancelled: 1,
      doneToday: 1,
    });
  });

  it("날짜가 바뀌면 같은 데이터로 묶음을 다시 나눈다", () => {
    const tomorrow = board({}, { today: "2026-10-19", time: "08:00" });
    expect(titles(tomorrow.today)).toEqual(["독서 모임 발제문 쓰기"]);
    expect(titles(tomorrow.past)).toEqual(["겨울옷 꺼내기", "여행 사진 정리", "보고서 초안 제출", "알고리즘 2문제"]);
    expect(tomorrow.counts.doneToday).toBe(0);
  });

  it("항목이 같은 이름과 날짜여도 key가 겹치지 않는다", () => {
    const dup = parseMonthNote(
      "할일/2026-10.md",
      "---\n월: 2026-10\n미완료: true\n---\n\n- [ ] 운동\n  - 하기로 한 날: 2026-10-07\n\n- [ ] 운동\n  - 하기로 한 날: 2026-10-07\n",
    );
    const b = buildBoard([dup], clock, NO_FILTERS);
    expect(b.past).toHaveLength(2);
    expect(new Set(b.past.map((i) => i.key)).size).toBe(2);
  });

  it("파일 단위 문제를 경로와 함께 모은다", () => {
    const wrongMonth = parseMonthNote("할일/2026-11.md", fixture("2026-10.md"));
    const b = buildBoard([wrongMonth], clock, NO_FILTERS);
    expect(b.fileIssues).toContain("할일/2026-11.md: frontmatter 월(2026-10)이 파일 이름(2026-11)과 다름");
  });
});
