import { describe, expect, it } from "vitest";
import {
  addDays,
  ageInDays,
  bucketOf,
  dayNumber,
  daysBetween,
  deadlineState,
  formatLocalDate,
  formatLocalTime,
  isStale,
  isValidDate,
  isValidTime,
  monthOf,
} from "../../src/logic/dates";

describe("isValidDate", () => {
  it("실제 달력에 있는 날짜만 통과시킨다", () => {
    expect(isValidDate("2026-10-18")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-00-10")).toBe(false);
  });

  it("YYYY-MM-DD 형식이 아니면 거부한다", () => {
    expect(isValidDate("10/24")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate("2026-10-18 17:00")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("isValidTime", () => {
  it("00:00부터 23:59까지만 통과시킨다", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("9:30")).toBe(false);
  });
});

describe("날짜 계산", () => {
  it("달과 해를 넘어도 달력 기준으로 센다", () => {
    expect(daysBetween("2026-09-28", "2026-10-05")).toBe(7);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-10-18", "2026-10-15")).toBe(-3);
  });

  it("날짜를 더하고 뺀다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(dayNumber("1970-01-02")).toBe(1);
  });

  it("월 파일 이름에 쓰는 YYYY-MM을 꺼낸다", () => {
    expect(monthOf("2026-10-18")).toBe("2026-10");
  });

  it("현지 시간대의 날짜와 시각을 만든다", () => {
    const now = new Date(2026, 9, 5, 9, 7);
    expect(formatLocalDate(now)).toBe("2026-10-05");
    expect(formatLocalTime(now)).toBe("09:07");
  });
});

describe("오래 밀린 일", () => {
  it("처음 계획한 날부터 7일 이상 지났을 때부터다", () => {
    expect(isStale("2026-10-12", "2026-10-18")).toBe(false);
    expect(isStale("2026-10-11", "2026-10-18")).toBe(true);
    expect(isStale("2026-10-18", "2026-10-18")).toBe(false);
  });

  it("월을 넘겨도 달력 기준으로 센다", () => {
    expect(isStale("2026-09-28", "2026-10-04")).toBe(false);
    expect(isStale("2026-09-28", "2026-10-05")).toBe(true);
  });

  it("지난 일수를 돌려준다", () => {
    expect(ageInDays("2026-10-05", "2026-10-18")).toBe(13);
  });
});

describe("bucketOf", () => {
  it("현재 계획 날짜로 지난 계획, 오늘, 예정을 나눈다", () => {
    expect(bucketOf("2026-10-17", "2026-10-18")).toBe("past");
    expect(bucketOf("2026-10-18", "2026-10-18")).toBe("today");
    expect(bucketOf("2026-10-19", "2026-10-18")).toBe("upcoming");
  });
});

describe("deadlineState", () => {
  const today = "2026-10-18";
  const nowTime = "19:00";

  it("지난 날짜의 마감은 지남이다", () => {
    expect(deadlineState({ date: "2026-10-17", time: null }, today, nowTime)).toBe("overdue");
    expect(deadlineState({ date: "2026-10-17", time: "23:59" }, today, nowTime)).toBe("overdue");
  });

  it("오늘 마감은 시각이 지나야 지남이다", () => {
    expect(deadlineState({ date: today, time: "18:59" }, today, nowTime)).toBe("overdue");
    expect(deadlineState({ date: today, time: "19:00" }, today, nowTime)).toBe("soon");
    expect(deadlineState({ date: today, time: "23:59" }, today, nowTime)).toBe("soon");
  });

  it("날짜만 있는 오늘 마감은 그 날이 끝나야 지남이다", () => {
    expect(deadlineState({ date: today, time: null }, today, nowTime)).toBe("soon");
  });

  it("3일 이내는 임박, 그 뒤는 여유다", () => {
    expect(deadlineState({ date: "2026-10-21", time: null }, today, nowTime)).toBe("soon");
    expect(deadlineState({ date: "2026-10-22", time: null }, today, nowTime)).toBe("later");
  });
});
