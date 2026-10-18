import { describe, expect, it } from "vitest";
import { deadlineLabel, formatLongDate, formatMonthDay, ledgerFileName, weekdayOf } from "../../src/logic/format";

describe("날짜 표기", () => {
  it("요일을 구한다", () => {
    expect(weekdayOf("2026-10-18")).toBe("일");
    expect(weekdayOf("2026-10-19")).toBe("월");
    expect(weekdayOf("2028-02-29")).toBe("화");
  });

  it("월/일을 앞의 0 없이 쓴다", () => {
    expect(formatMonthDay("2026-10-05")).toBe("10/5");
    expect(formatMonthDay("2026-01-31")).toBe("1/31");
  });

  it("긴 날짜에 요일을 붙인다", () => {
    expect(formatLongDate("2026-10-18")).toBe("10월 18일 (일)");
  });

  it("날짜가 들어갈 월 파일 이름을 만든다", () => {
    expect(ledgerFileName("2026-11-02")).toBe("2026-11.md");
  });
});

describe("deadlineLabel", () => {
  const today = "2026-10-18";

  it("지난 마감은 날짜 없이 `마감 지남`이다", () => {
    expect(deadlineLabel({ date: "2026-10-17", time: "18:00" }, "overdue", today)).toBe("마감 지남");
  });

  it("오늘·내일은 말로, 그 밖에는 날짜로 쓴다", () => {
    expect(deadlineLabel({ date: "2026-10-18", time: null }, "soon", today)).toBe("오늘 마감");
    expect(deadlineLabel({ date: "2026-10-19", time: null }, "soon", today)).toBe("내일 마감");
    expect(deadlineLabel({ date: "2026-10-20", time: null }, "soon", today)).toBe("10/20 마감");
    expect(deadlineLabel({ date: "2026-10-28", time: null }, "later", today)).toBe("10/28 마감");
  });
});
