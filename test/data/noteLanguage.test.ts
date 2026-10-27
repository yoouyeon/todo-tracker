import { afterEach, describe, expect, it } from "vitest";
import {
  cancelTask,
  changePlannedDate,
  completeTask,
  convertMonthNote,
  insertTask,
  reopenTask,
  type EditResult,
} from "../../src/data/editMonthNote";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import { readSettings } from "../../src/settings/settings";
import { setUiLanguage, t } from "../../src/i18n";
import { formatLongDate } from "../../src/logic/format";

const PATH = "Todos/2026-10.md";

const EN = [
  "---",
  "month: 2026-10",
  "open: true",
  "---",
  "",
  "- [ ] Book dentist",
  "  - first planned: 2026-10-04",
  "  - planned: 2026-10-06",
  "  - deadline: 2026-10-09 18:00",
  "  - category: life",
  "  - memo: weekday evening",
  "",
].join("\n");

const content = (result: EditResult): string => {
  if (!result.ok) throw new Error(result.error.message);
  return result.content;
};

const first = (text: string) => {
  const task = parseMonthNote(PATH, text).tasks[0];
  if (!task) throw new Error("no task");
  return task;
};

describe("영어 필드 이름 읽기", () => {
  it("영어 필드 이름과 frontmatter 키를 읽는다", () => {
    const note = parseMonthNote(PATH, EN);
    expect(note.issues).toEqual([]);
    expect(note.frontmatter).toEqual({ month: "2026-10", hasOpen: true });
    const task = first(EN);
    expect(task.problems).toEqual([]);
    expect(task.firstPlanned).toBe("2026-10-04");
    expect(task.planned).toBe("2026-10-06");
    expect(task.deadline).toEqual({ date: "2026-10-09", time: "18:00" });
    expect(task.category).toBe("life");
    expect(task.memo).toBe("weekday evening");
  });

  it("한 항목 안에 두 언어가 섞여 있어도 읽는다", () => {
    const task = first(["- [ ] 섞인 항목", "  - planned: 2026-10-06", "  - 분류: 생활"].join("\n"));
    expect(task.problems).toEqual([]);
    expect(task.planned).toBe("2026-10-06");
    expect(task.category).toBe("생활");
  });

  it("같은 필드를 두 언어로 한 번씩 적으면 중복으로 본다", () => {
    const task = first(["- [ ] 중복", "  - planned: 2026-10-06", "  - 하기로 한 날: 2026-10-07"].join("\n"));
    expect(task.problems.map((p) => p.code)).toEqual(["duplicateField"]);
  });

  it("필드 이름은 대소문자를 구분한다", () => {
    const task = first(["- [ ] 대문자", "  - Planned: 2026-10-06"].join("\n"));
    expect(task.unrecognizedLines).toEqual(["  - Planned: 2026-10-06"]);
    expect(task.problems.map((p) => p.code)).toEqual(["planned"]);
  });

  it("없는 필드를 알릴 때 항목이 쓰는 언어의 이름을 쓴다", () => {
    const task = first(["- [ ] 날짜 없음", "  - category: life"].join("\n"));
    expect(task.problems[0]?.message).toContain("planned");
    expect(task.problems[0]?.message).not.toContain("하기로 한 날");
  });
});

describe("영어로 쓰기", () => {
  it("새로 넣는 줄은 설정한 언어로, 이미 있는 줄은 적힌 이름 그대로 쓴다", () => {
    const ko = ["- [ ] 섞어 쓰기", "  - 하기로 한 날: 2026-10-06", ""].join("\n");
    const target = first(ko);
    const moved = content(changePlannedDate(ko, PATH, target, "2026-10-08", "en"));
    expect(moved).toBe(["- [ ] 섞어 쓰기", "  - first planned: 2026-10-06", "  - 하기로 한 날: 2026-10-08", ""].join("\n"));
  });

  it("완료와 되돌리기에서 frontmatter 키를 영어로 맞춘다", () => {
    const done = content(completeTask(EN, PATH, first(EN), "2026-10-06", "en"));
    expect(done).toContain("open: false");
    expect(done).toContain("  - completed: 2026-10-06");
    const reopened = content(reopenTask(done, PATH, first(done), "en"));
    expect(reopened).toBe(EN);
  });

  it("취소한 날과 이유를 영어로 쓴다", () => {
    const cancelled = content(cancelTask(EN, PATH, first(EN), "2026-10-07", "moved", "en"));
    expect(cancelled).toContain("  - cancelled: 2026-10-07\n  - reason: moved\n  - category: life");
  });

  it("새 월 노트를 영어로 만든다", () => {
    const created = content(insertTask(null, PATH, { title: "New", date: "2026-10-20", category: "work" }, "en"));
    expect(created).toBe(["---", "month: 2026-10", "open: true", "---", "", "# 2026-10 todos", "", "- [ ] New", "  - planned: 2026-10-20", "  - category: work", ""].join("\n"));
  });

  it("frontmatter에 open 키가 없으면 month 키와 같은 언어로 넣는다", () => {
    const note = ["---", "month: 2026-10", "---", "", "- [ ] A", "  - planned: 2026-10-06", ""].join("\n");
    const done = content(completeTask(note, PATH, first(note), "2026-10-06", "ko"));
    expect(done.split("\n").slice(0, 4)).toEqual(["---", "month: 2026-10", "open: false", "---"]);
  });
});

describe("convertMonthNote", () => {
  it("영어 노트를 한국어로, 다시 영어로 바꾸면 처음과 같다", () => {
    const ko = convertMonthNote(EN, PATH, "ko");
    expect(ko).toBe(
      [
        "---",
        "월: 2026-10",
        "미완료: true",
        "---",
        "",
        "- [ ] Book dentist",
        "  - 처음 하기로 한 날: 2026-10-04",
        "  - 하기로 한 날: 2026-10-06",
        "  - 마감일: 2026-10-09 18:00",
        "  - 분류: life",
        "  - 메모: weekday evening",
        "",
      ].join("\n"),
    );
    expect(convertMonthNote(ko, PATH, "en")).toBe(EN);
  });

  it("모르는 줄, 하위 목록, 본문, 줄바꿈은 그대로 둔다", () => {
    const note = ["# planned: 제목", "- [ ] A", "  - 하기로 한 날: 2026-10-06", "  - 담당: 나", "    - 메모: 하위", "본문 - 메모: x", ""].join("\r\n");
    expect(convertMonthNote(note, PATH, "en")).toBe(
      ["# planned: 제목", "- [ ] A", "  - planned: 2026-10-06", "  - 담당: 나", "    - 메모: 하위", "본문 - 메모: x", ""].join("\r\n"),
    );
  });

  it("바꿀 것이 없으면 같은 내용을 돌려준다", () => {
    expect(convertMonthNote(EN, PATH, "en")).toBe(EN);
  });
});

describe("readSettings", () => {
  it("저장된 값이 없으면 Obsidian 언어로 정한다", () => {
    expect(readSettings(null, "ko")).toEqual({ folder: "할일", noteLanguage: "ko" });
    expect(readSettings(undefined, "en")).toEqual({ folder: "Todos", noteLanguage: "en" });
    expect(readSettings({}, "ja")).toEqual({ folder: "Todos", noteLanguage: "en" });
  });

  it("폴더만 저장된 예전 설정은 한국어 노트로 본다", () => {
    expect(readSettings({ folder: "할일" }, "en")).toEqual({ folder: "할일", noteLanguage: "ko" });
  });

  it("저장된 노트 언어를 따르고 잘못된 값은 무시한다", () => {
    expect(readSettings({ folder: "", noteLanguage: "en" }, "ko")).toEqual({ folder: "", noteLanguage: "en" });
    expect(readSettings({ noteLanguage: "fr" }, "ko")).toEqual({ folder: "할일", noteLanguage: "ko" });
  });
});

describe("setUiLanguage", () => {
  afterEach(() => setUiLanguage("ko"));

  it("한국어가 아니면 영어 문구를 쓴다", () => {
    setUiLanguage("de");
    expect(t("viewName")).toBe("Todos");
    expect(formatLongDate("2026-10-27")).toBe("Tue, Oct 27");
    expect(t("ageLine", { count: 1 })).toBe("1 day since first planned");
    expect(t("ageLine", { count: 8 })).toBe("8 days since first planned");
    setUiLanguage("ko");
    expect(t("viewName")).toBe("할 일");
    expect(formatLongDate("2026-10-27")).toBe("10월 27일 (화)");
    expect(t("ageLine", { count: 1 })).toBe("처음 계획부터 1일");
  });
});
