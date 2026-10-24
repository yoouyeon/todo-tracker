import { describe, expect, it } from "vitest";
import {
  cancelTask,
  changeCancellation,
  changeCompletedDate,
  changePlannedDate,
  completeTask,
  insertTask,
  plannedDateError,
  reopenTask,
  syncOpenFlag,
  updateTask,
  type EditResult,
  type TaskTarget,
} from "../../src/data/editMonthNote";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import type { TaskRecord } from "../../src/data/types";

const PATH = "할일/2026-10.md";

const BASE = [
  "---",
  "월: 2026-10",
  "미완료: true",
  "---",
  "",
  "# 2026-10 할 일",
  "",
  "- [ ] 치과 예약 잡기",
  "  - 하기로 한 날: 2026-10-06",
  "  - 분류: 생활",
  "  - 메모: 평일 저녁",
  "",
  "- [x] 끝난 일",
  "  - 하기로 한 날: 2026-10-10",
  "  - 완료한 날: 2026-10-10",
  "  - 분류: 개인",
  "",
  "- [ ] 보고서 제출",
  "  - 처음 하기로 한 날: 2026-10-14",
  "  - 하기로 한 날: 2026-10-18",
  "  - 마감일: 2026-10-17 18:00",
  "  - 분류: 공부",
  "  - 링크: https://example.com",
  "  - 우선순위: 높음",
  "    - 하위: 깊게 들여쓴 줄",
  "",
  "- [ ] 마지막 일",
  "  - 하기로 한 날: 2026-10-20",
].join("\n");

const tasksOf = (content: string, path = PATH) => parseMonthNote(path, content).tasks;
const find = (content: string, title: string, nth = 0): TaskRecord => {
  const task = tasksOf(content).filter((t) => t.title === title)[nth];
  if (!task) throw new Error(`"${title}" 항목이 없음`);
  return task;
};
const target = (content: string, title: string, nth = 0): TaskTarget => find(content, title, nth);
const okContent = (result: EditResult): string => {
  if (!result.ok) throw new Error(`실패: ${result.error.message}`);
  return result.content;
};
const failure = (result: EditResult) => {
  if (result.ok) throw new Error("실패해야 하는데 성공함");
  return result.error;
};
/** frontmatter와 대상 항목을 뺀 나머지. 이 부분은 편집 전후로 같아야 한다. */
const rest = (content: string, title: string) => content.replace(find(content, title).sourceText, "<대상>");
const body = (content: string) => content.slice(content.indexOf("---", 4) + 3);
const block = (content: string, title: string) => find(content, title).sourceText.split("\n");

describe("completeTask", () => {
  it("체크박스를 x로 바꾸고 `완료한 날`을 하기로 한 날 바로 뒤에 넣는다", () => {
    const result = okContent(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    expect(block(result, "치과 예약 잡기")).toEqual([
      "- [x] 치과 예약 잡기",
      "  - 하기로 한 날: 2026-10-06",
      "  - 완료한 날: 2026-10-18",
      "  - 분류: 생활",
      "  - 메모: 평일 저녁",
    ]);
  });

  it("마감일이 있으면 마감일 뒤에 넣는다", () => {
    const result = okContent(completeTask(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-18"));
    expect(block(result, "보고서 제출").slice(0, 6)).toEqual([
      "- [x] 보고서 제출",
      "  - 처음 하기로 한 날: 2026-10-14",
      "  - 하기로 한 날: 2026-10-18",
      "  - 마감일: 2026-10-17 18:00",
      "  - 완료한 날: 2026-10-18",
      "  - 분류: 공부",
    ]);
  });

  it("모르는 속성 줄과 깊게 들여쓴 줄을 그대로 남긴다", () => {
    const result = okContent(completeTask(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-18"));
    expect(find(result, "보고서 제출").unrecognizedLines).toEqual(find(BASE, "보고서 제출").unrecognizedLines);
    expect(block(result, "보고서 제출").slice(-3)).toEqual(["  - 링크: https://example.com", "  - 우선순위: 높음", "    - 하위: 깊게 들여쓴 줄"]);
  });

  it("다른 항목과 본문은 한 글자도 바꾸지 않는다", () => {
    const result = okContent(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    expect(rest(result, "치과 예약 잡기")).toBe(rest(BASE, "치과 예약 잡기"));
  });

  it("진행 중 항목이 남아 있으면 미완료를 true로 둔다", () => {
    const result = okContent(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    expect(parseMonthNote(PATH, result).frontmatter?.hasOpen).toBe(true);
    expect(result.split("\n")[2]).toBe("미완료: true");
  });

  it("마지막 진행 중 항목을 끝내면 미완료를 false로 바꾼다", () => {
    const single = ["---", "월: 2026-10", "미완료: true", "---", "", "- [ ] 하나뿐", "  - 하기로 한 날: 2026-10-18", ""].join("\n");
    const result = okContent(completeTask(single, PATH, target(single, "하나뿐"), "2026-10-18"));
    expect(result.split("\n")[2]).toBe("미완료: false");
    expect(parseMonthNote(PATH, result).issues).toEqual([]);
  });

  it("이미 끝났거나 읽을 수 없는 항목은 고치지 않는다", () => {
    const done = failure(completeTask(BASE, PATH, target(BASE, "끝난 일"), "2026-10-18"));
    expect(done.code).toBe("readonly");
    const broken = BASE.replace("2026-10-20", "내일");
    const unreadable = failure(completeTask(broken, PATH, target(broken, "마지막 일"), "2026-10-18"));
    expect(unreadable.code).toBe("readonly");
  });

  it("날짜 형식이 틀리면 고치지 않는다", () => {
    expect(failure(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "10/18")).code).toBe("invalid");
    expect(failure(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-02-30")).code).toBe("invalid");
  });

  it("마지막 줄에 줄바꿈이 없는 파일의 마지막 항목도 고친다", () => {
    expect(BASE.endsWith("\n")).toBe(false);
    const result = okContent(completeTask(BASE, PATH, target(BASE, "마지막 일"), "2026-10-20"));
    expect(result.endsWith("  - 완료한 날: 2026-10-20")).toBe(true);
    expect(result.endsWith("\n")).toBe(false);
  });
});

describe("대상 항목 확인", () => {
  it("노트에서 항목 내용이 바뀌었으면 쓰지 않는다", () => {
    const stale = target(BASE, "치과 예약 잡기");
    const edited = BASE.replace("메모: 평일 저녁", "메모: 주말도 가능");
    const error = failure(completeTask(edited, PATH, stale, "2026-10-18"));
    expect(error.code).toBe("conflict");
    expect(error.message).toContain("바뀌어서 저장하지 않았어요");
  });

  it("항목이 지워졌으면 쓰지 않는다", () => {
    const stale = target(BASE, "마지막 일");
    const removed = BASE.slice(0, BASE.indexOf("- [ ] 마지막 일")).trimEnd();
    expect(failure(completeTask(removed, PATH, stale, "2026-10-18")).code).toBe("conflict");
  });

  it("내용이 같고 위치만 달라졌으면 같은 항목으로 본다", () => {
    const stale = target(BASE, "치과 예약 잡기");
    const shifted = BASE.replace("# 2026-10 할 일\n", "# 2026-10 할 일\n\n새로 쓴 안내 문장\n");
    const result = okContent(completeTask(shifted, PATH, stale, "2026-10-18"));
    expect(find(result, "치과 예약 잡기").status).toBe("done");
  });

  it("내용이 같은 항목이 여럿이면 위치까지 같은 것만 고른다", () => {
    const twin = ["- [ ] 운동", "  - 하기로 한 날: 2026-10-07"].join("\n");
    const content = ["---", "월: 2026-10", "미완료: true", "---", "", twin, "", twin, ""].join("\n");
    const second = target(content, "운동", 1);

    const result = okContent(completeTask(content, PATH, second, "2026-10-18"));
    expect(tasksOf(result).map((t) => t.status)).toEqual(["open", "done"]);

    // 위에 줄이 늘어나 위치가 어긋나면 어느 쪽인지 알 수 없으므로 쓰지 않는다.
    const shifted = content.replace("---\n\n- [ ]", "---\n\n안내\n\n- [ ]");
    const error = failure(completeTask(shifted, PATH, second, "2026-10-18"));
    expect(error.code).toBe("conflict");
    expect(error.message).toContain("어느 쪽인지");
  });
});

describe("changeCompletedDate", () => {
  it("완료한 날 줄만 바꾸고 다른 내용은 그대로 둔다", () => {
    const result = okContent(changeCompletedDate(BASE, PATH, target(BASE, "끝난 일"), "2026-10-12"));
    expect(block(result, "끝난 일")).toEqual(["- [x] 끝난 일", "  - 하기로 한 날: 2026-10-10", "  - 완료한 날: 2026-10-12", "  - 분류: 개인"]);
    expect(rest(result, "끝난 일")).toBe(rest(BASE, "끝난 일"));
  });

  it("지금과 같은 날짜나 틀린 형식으로는 바꾸지 않는다", () => {
    expect(failure(changeCompletedDate(BASE, PATH, target(BASE, "끝난 일"), "2026-10-10")).message).toContain("이미 10/10");
    expect(failure(changeCompletedDate(BASE, PATH, target(BASE, "끝난 일"), "어제")).code).toBe("invalid");
  });

  it("완료한 항목이 아니면 바꾸지 않는다", () => {
    expect(failure(changeCompletedDate(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-12")).code).toBe("readonly");
  });
});

describe("changeCancellation", () => {
  const CANCELLED = okContent(cancelTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18", "병원이 문을 닫음"));

  it("취소한 날과 이유를 바꾸고 다른 내용은 그대로 둔다", () => {
    const result = okContent(changeCancellation(CANCELLED, PATH, target(CANCELLED, "치과 예약 잡기"), "2026-10-17", "다른 병원으로 옮김"));
    expect(block(result, "치과 예약 잡기")).toEqual([
      "- [-] 치과 예약 잡기",
      "  - 하기로 한 날: 2026-10-06",
      "  - 취소한 날: 2026-10-17",
      "  - 이유: 다른 병원으로 옮김",
      "  - 분류: 생활",
      "  - 메모: 평일 저녁",
    ]);
    expect(rest(result, "치과 예약 잡기")).toBe(rest(CANCELLED, "치과 예약 잡기"));
  });

  it("이유를 비우면 이유 줄을 지운다", () => {
    const result = okContent(changeCancellation(CANCELLED, PATH, target(CANCELLED, "치과 예약 잡기"), "2026-10-18", "  "));
    expect(block(result, "치과 예약 잡기")).not.toContain("  - 이유: 병원이 문을 닫음");
    expect(find(result, "치과 예약 잡기").cancelReason).toBeNull();
  });

  it("바뀐 내용이 없거나 날짜 형식이 틀리면 바꾸지 않는다", () => {
    const t = target(CANCELLED, "치과 예약 잡기");
    expect(failure(changeCancellation(CANCELLED, PATH, t, "2026-10-18", " 병원이 문을 닫음 ")).message).toContain("바뀐 내용이 없어요");
    expect(failure(changeCancellation(CANCELLED, PATH, t, "어제", "")).code).toBe("invalid");
  });

  it("취소한 항목이 아니면 바꾸지 않는다", () => {
    expect(failure(changeCancellation(BASE, PATH, target(BASE, "끝난 일"), "2026-10-12", "")).code).toBe("readonly");
  });
});

describe("reopenTask", () => {
  it("완료를 되돌리면 완료하기 전 내용과 같아진다", () => {
    const done = okContent(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    const reopened = okContent(reopenTask(done, PATH, target(done, "치과 예약 잡기")));
    expect(reopened).toBe(BASE);
  });

  it("마지막 진행 중 항목을 되돌리면 frontmatter 미완료도 true로 돌아간다", () => {
    const single = ["---", "월: 2026-10", "미완료: true", "---", "", "- [ ] 하나뿐", "  - 하기로 한 날: 2026-10-18", ""].join("\n");
    const done = okContent(completeTask(single, PATH, target(single, "하나뿐"), "2026-10-18"));
    expect(parseMonthNote(PATH, done).frontmatter?.hasOpen).toBe(false);
    expect(okContent(reopenTask(done, PATH, target(done, "하나뿐")))).toBe(single);
  });

  it("취소를 되돌리면 취소한 날과 이유 줄이 지워져 취소하기 전 내용과 같아진다", () => {
    const cancelled = okContent(cancelTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18", "병원이 문을 닫음"));
    expect(okContent(reopenTask(cancelled, PATH, target(cancelled, "치과 예약 잡기")))).toBe(BASE);
  });

  it("진행 중인 항목은 되돌리지 않는다", () => {
    const error = failure(reopenTask(BASE, PATH, target(BASE, "치과 예약 잡기")));
    expect(error.code).toBe("readonly");
    expect(error.message).toContain("완료하거나 취소한 항목에서만");
  });

  it("완료한 뒤 노트에서 항목이 바뀌었으면 되돌리지 않는다", () => {
    const done = okContent(completeTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    const staleTarget = target(done, "치과 예약 잡기");
    const edited = done.replace("  - 메모: 평일 저녁", "  - 메모: 주말");
    expect(failure(reopenTask(edited, PATH, staleTarget)).code).toBe("conflict");
  });
});

describe("cancelTask", () => {
  it("체크박스를 -로 바꾸고 `취소한 날`과 `이유`를 하기로 한 날 뒤에 넣는다", () => {
    const result = okContent(cancelTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18", "병원이 문을 닫음"));
    expect(block(result, "치과 예약 잡기")).toEqual([
      "- [-] 치과 예약 잡기",
      "  - 하기로 한 날: 2026-10-06",
      "  - 취소한 날: 2026-10-18",
      "  - 이유: 병원이 문을 닫음",
      "  - 분류: 생활",
      "  - 메모: 평일 저녁",
    ]);
    const task = find(result, "치과 예약 잡기");
    expect([task.status, task.cancelledOn, task.cancelReason]).toEqual(["cancelled", "2026-10-18", "병원이 문을 닫음"]);
  });

  it("이유의 줄바꿈과 연속 공백을 공백 하나로 줄인다", () => {
    const result = okContent(cancelTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18", "  더는\n\n필요   없음 "));
    expect(find(result, "치과 예약 잡기").cancelReason).toBe("더는 필요 없음");
  });

  it("이유가 비어 있으면 `이유` 줄 없이 취소한다", () => {
    const result = okContent(cancelTask(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18", "  \n "));
    expect(block(result, "치과 예약 잡기")).toEqual([
      "- [-] 치과 예약 잡기",
      "  - 하기로 한 날: 2026-10-06",
      "  - 취소한 날: 2026-10-18",
      "  - 분류: 생활",
      "  - 메모: 평일 저녁",
    ]);
    const task = find(result, "치과 예약 잡기");
    expect([task.status, task.cancelReason]).toEqual(["cancelled", null]);
  });

  it("다른 항목과 모르는 줄은 그대로다", () => {
    const result = okContent(cancelTask(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-18", "필요 없어짐"));
    expect(rest(result, "보고서 제출")).toBe(rest(BASE, "보고서 제출"));
    expect(find(result, "보고서 제출").unrecognizedLines).toHaveLength(3);
  });
});

describe("changePlannedDate", () => {
  it("처음 바꿀 때는 원래 날짜를 `처음 하기로 한 날`로 남기고 하기로 한 날을 바꾼다", () => {
    const result = okContent(changePlannedDate(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    expect(block(result, "치과 예약 잡기").slice(0, 3)).toEqual(["- [ ] 치과 예약 잡기", "  - 처음 하기로 한 날: 2026-10-06", "  - 하기로 한 날: 2026-10-18"]);
    const task = find(result, "치과 예약 잡기");
    expect([task.firstPlanned, task.planned, task.problems]).toEqual(["2026-10-06", "2026-10-18", []]);
  });

  it("이미 바꾼 적이 있으면 처음 날짜는 그대로 두고 하기로 한 날만 바꾼다", () => {
    const result = okContent(changePlannedDate(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-25"));
    expect(block(result, "보고서 제출").slice(1, 3)).toEqual(["  - 처음 하기로 한 날: 2026-10-14", "  - 하기로 한 날: 2026-10-25"]);
  });

  it("앞선 날짜로도 바꿀 수 있다", () => {
    const result = okContent(changePlannedDate(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-01"));
    const task = find(result, "보고서 제출");
    expect([task.firstPlanned, task.planned, task.problems]).toEqual(["2026-10-14", "2026-10-01", []]);
  });

  it("다른 항목과 본문은 한 글자도 바꾸지 않는다", () => {
    const result = okContent(changePlannedDate(BASE, PATH, target(BASE, "치과 예약 잡기"), "2026-10-18"));
    expect(rest(result, "치과 예약 잡기")).toBe(rest(BASE, "치과 예약 잡기"));
  });

  it("지금 하기로 한 날과 같은 날짜로는 바꾸지 않는다", () => {
    const error = failure(changePlannedDate(BASE, PATH, target(BASE, "보고서 제출"), "2026-10-18"));
    expect(error.code).toBe("invalid");
    expect(error.message).toContain("이미 10/18");
  });

  it("날짜 형식이 틀리면 바꾸지 않는다", () => {
    expect(failure(changePlannedDate(BASE, PATH, target(BASE, "보고서 제출"), "내일")).code).toBe("invalid");
  });

  it("끝난 항목은 바꾸지 않는다", () => {
    expect(failure(changePlannedDate(BASE, PATH, target(BASE, "끝난 일"), "2026-10-30")).code).toBe("readonly");
  });
});

describe("plannedDateError", () => {
  const task = { planned: "2026-10-18" };
  it("지금 하기로 한 날과 같은 날짜와 틀린 형식만 막는다", () => {
    expect(plannedDateError(task, "2026-10-19")).toBeNull();
    expect(plannedDateError(task, "2026-10-01")).toBeNull();
    expect(plannedDateError(task, "2026-10-18")).toContain("이미");
    expect(plannedDateError(task, "x")).toContain("형식");
  });
});

describe("updateTask", () => {
  it("메모가 없던 항목에 메모를 분류 뒤에 넣는다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { memo: "초안만 먼저" }));
    expect(block(result, "보고서 제출")).toEqual([
      "- [ ] 보고서 제출",
      "  - 처음 하기로 한 날: 2026-10-14",
      "  - 하기로 한 날: 2026-10-18",
      "  - 마감일: 2026-10-17 18:00",
      "  - 분류: 공부",
      "  - 메모: 초안만 먼저",
      "  - 링크: https://example.com",
      "  - 우선순위: 높음",
      "    - 하위: 깊게 들여쓴 줄",
    ]);
  });

  it("있던 값은 그 줄에서 바꾼다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "치과 예약 잡기"), { category: "병원", memo: "주말도 가능" }));
    expect(block(result, "치과 예약 잡기")).toEqual(["- [ ] 치과 예약 잡기", "  - 하기로 한 날: 2026-10-06", "  - 분류: 병원", "  - 메모: 주말도 가능"]);
  });

  it("비우면 그 줄을 지운다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "치과 예약 잡기"), { category: "", memo: null }));
    expect(block(result, "치과 예약 잡기")).toEqual(["- [ ] 치과 예약 잡기", "  - 하기로 한 날: 2026-10-06"]);
    const task = find(result, "치과 예약 잡기");
    expect([task.category, task.memo]).toEqual([null, null]);
  });

  it("마감일이 없던 항목에 마감일을 하기로 한 날 뒤에 넣는다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "치과 예약 잡기"), { deadline: { date: "2026-10-25", time: "09:30" } }));
    expect(block(result, "치과 예약 잡기").slice(0, 4)).toEqual(["- [ ] 치과 예약 잡기", "  - 하기로 한 날: 2026-10-06", "  - 마감일: 2026-10-25 09:30", "  - 분류: 생활"]);
  });

  it("마감일을 날짜만으로 바꾸거나 지울 수 있다", () => {
    const dateOnly = okContent(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { deadline: { date: "2026-10-30", time: null } }));
    expect(find(dateOnly, "보고서 제출").deadline).toEqual({ date: "2026-10-30", time: null });
    const cleared = okContent(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { deadline: null }));
    expect(find(cleared, "보고서 제출").deadline).toBeNull();
    expect(block(cleared, "보고서 제출")).not.toContain("  - 마감일: 2026-10-17 18:00");
  });

  it("마감일 형식이 틀리면 고치지 않는다", () => {
    expect(failure(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { deadline: { date: "2026-10-30", time: "25:00" } })).code).toBe("invalid");
    expect(failure(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { deadline: { date: "내일", time: null } })).code).toBe("invalid");
  });

  it("바꾼 것이 없으면 내용을 그대로 돌려준다", () => {
    const result = okContent(
      updateTask(BASE, PATH, target(BASE, "보고서 제출"), { deadline: { date: "2026-10-17", time: "18:00" }, category: "공부", memo: null }),
    );
    expect(result).toBe(BASE);
  });

  it("메모의 줄바꿈은 공백으로 줄인다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "치과 예약 잡기"), { memo: "첫 줄\n둘째 줄" }));
    expect(find(result, "치과 예약 잡기").memo).toBe("첫 줄 둘째 줄");
  });

  it("건드리지 않은 속성과 다른 항목은 그대로다", () => {
    const result = okContent(updateTask(BASE, PATH, target(BASE, "보고서 제출"), { memo: "초안만 먼저" }));
    expect(rest(result, "보고서 제출")).toBe(rest(BASE, "보고서 제출"));
    expect([find(result, "보고서 제출").firstPlanned, find(result, "보고서 제출").planned]).toEqual(["2026-10-14", "2026-10-18"]);
  });

  it("마지막 줄에 줄바꿈이 없는 파일에서 마지막 줄을 지워도 앞 줄이 온전하다", () => {
    const withMemo = BASE.replace("  - 하기로 한 날: 2026-10-20", "  - 하기로 한 날: 2026-10-20\n  - 메모: 지울 메모");
    const result = okContent(updateTask(withMemo, PATH, target(withMemo, "마지막 일"), { memo: null }));
    expect(result).toBe(BASE);
  });

  it("끝난 항목은 고치지 않는다", () => {
    expect(failure(updateTask(BASE, PATH, target(BASE, "끝난 일"), { memo: "x" })).code).toBe("readonly");
  });
});

describe("insertTask", () => {
  it("파일이 없으면 월과 미완료가 있는 새 월 노트를 만든다", () => {
    const content = okContent(insertTask(null, "할일/2026-12.md", { title: "연말 정리", date: "2026-12-30" }));
    expect(content).toBe(["---", "월: 2026-12", "미완료: true", "---", "", "# 2026-12 할 일", "", "- [ ] 연말 정리", "  - 하기로 한 날: 2026-12-30", ""].join("\n"));
    expect(parseMonthNote("할일/2026-12.md", content).issues).toEqual([]);
  });

  it("첫 계획 날짜 순서에 맞는 자리에 넣는다", () => {
    const result = okContent(insertTask(BASE, PATH, { title: "중간 일", date: "2026-10-12" }));
    expect(tasksOf(result).map((t) => t.title)).toEqual(["치과 예약 잡기", "끝난 일", "중간 일", "보고서 제출", "마지막 일"]);
  });

  it("날짜 순서가 어긋난 파일에서는 첫 계획 날짜가 같거나 이른 마지막 항목 뒤에 넣는다", () => {
    const unsorted = ["---", "월: 2026-10", "미완료: true", "---", "", "- [ ] 나중", "  - 하기로 한 날: 2026-10-20", "", "- [ ] 먼저", "  - 하기로 한 날: 2026-10-05", ""].join("\n");
    const result = okContent(insertTask(unsorted, PATH, { title: "새 일", date: "2026-10-06" }));
    expect(tasksOf(result).map((t) => t.title)).toEqual(["나중", "먼저", "새 일"]);
  });

  it("같은 첫 계획 날짜의 묶음 마지막에 넣는다", () => {
    const twoSameDay = ["---", "월: 2026-10", "미완료: true", "---", "", "- [ ] 가", "  - 하기로 한 날: 2026-10-05", "", "- [ ] 나", "  - 하기로 한 날: 2026-10-05", "", "- [ ] 다", "  - 하기로 한 날: 2026-10-09", ""].join("\n");
    const result = okContent(insertTask(twoSameDay, PATH, { title: "새 일", date: "2026-10-05" }));
    expect(tasksOf(result).map((t) => t.title)).toEqual(["가", "나", "새 일", "다"]);
  });

  it("모든 항목보다 이른 날짜면 첫 항목 앞에 넣는다", () => {
    const result = okContent(insertTask(BASE, PATH, { title: "가장 이른 일", date: "2026-10-01" }));
    expect(tasksOf(result).map((t) => t.title)[0]).toBe("가장 이른 일");
    expect(result.startsWith("---\n월: 2026-10")).toBe(true);
    expect(result).toContain("# 2026-10 할 일\n\n- [ ] 가장 이른 일");
  });

  it("가장 늦은 날짜면 마지막에 넣고 끝의 줄바꿈 유무를 그대로 둔다", () => {
    const result = okContent(insertTask(BASE, PATH, { title: "마지막에 추가", date: "2026-10-31" }));
    expect(tasksOf(result).map((t) => t.title).at(-1)).toBe("마지막에 추가");
    expect(result.endsWith("\n")).toBe(false);
    const withNewline = okContent(insertTask(`${BASE}\n`, PATH, { title: "마지막에 추가", date: "2026-10-31" }));
    expect(withNewline.endsWith("\n")).toBe(true);
  });

  it("항목이 하나도 없는 파일에도 넣는다", () => {
    const empty = ["---", "월: 2026-10", "미완료: false", "---", "", "# 2026-10 할 일", ""].join("\n");
    const result = okContent(insertTask(empty, PATH, { title: "첫 항목", date: "2026-10-18" }));
    expect(tasksOf(result).map((t) => t.title)).toEqual(["첫 항목"]);
    expect(result.split("\n")[2]).toBe("미완료: true");
    expect(result.endsWith("\n")).toBe(true);
  });

  it("미완료가 false인 파일에 넣으면 true로 바꾼다", () => {
    const allDone = ["---", "월: 2026-08", "미완료: false", "---", "", "- [x] 끝", "  - 하기로 한 날: 2026-08-03", "  - 완료한 날: 2026-08-03", ""].join("\n");
    const result = okContent(insertTask(allDone, "할일/2026-08.md", { title: "새 일", date: "2026-08-20" }));
    expect(result.split("\n")[2]).toBe("미완료: true");
  });

  it("마감일, 분류, 메모를 정해진 순서로 넣는다", () => {
    const result = okContent(
      insertTask(BASE, PATH, { title: "전부 입력", date: "2026-10-12", category: " 공부 ", deadline: { date: "2026-10-30", time: "17:00" }, memo: "첫 줄\n둘째 줄" }),
    );
    expect(block(result, "전부 입력")).toEqual([
      "- [ ] 전부 입력",
      "  - 하기로 한 날: 2026-10-12",
      "  - 마감일: 2026-10-30 17:00",
      "  - 분류: 공부",
      "  - 메모: 첫 줄 둘째 줄",
    ]);
  });

  it("다른 항목은 한 글자도 바꾸지 않는다", () => {
    const result = okContent(insertTask(BASE, PATH, { title: "중간 일", date: "2026-10-12" }));
    expect(result.replace(find(result, "중간 일").sourceText + "\n\n", "")).toBe(BASE);
  });

  it("제목과 날짜와 마감일을 검증한다", () => {
    expect(failure(insertTask(BASE, PATH, { title: "  \n ", date: "2026-10-12" })).code).toBe("invalid");
    expect(failure(insertTask(BASE, PATH, { title: "할 일", date: "10/12" })).code).toBe("invalid");
    expect(failure(insertTask(BASE, PATH, { title: "할 일", date: "2026-10-12", deadline: { date: "2026-10-30", time: "99:99" } })).code).toBe("invalid");
    expect(failure(insertTask(null, PATH, { title: "", date: "2026-10-12" })).code).toBe("invalid");
  });

  it("제목의 줄바꿈은 공백으로 줄인다", () => {
    const result = okContent(insertTask(BASE, PATH, { title: "두 줄\n제목", date: "2026-10-12" }));
    expect(tasksOf(result).some((t) => t.title === "두 줄 제목")).toBe(true);
  });
});

describe("줄바꿈 유지", () => {
  const crlf = BASE.replace(/\n/g, "\r\n");
  const bareLf = /(?<!\r)\n/;

  it("CRLF 파일을 고쳐도 새로 넣는 줄까지 모두 CRLF다", () => {
    const completed = okContent(completeTask(crlf, PATH, target(crlf, "치과 예약 잡기"), "2026-10-18"));
    expect(bareLf.test(completed)).toBe(false);
    const cancelled = okContent(cancelTask(crlf, PATH, target(crlf, "치과 예약 잡기"), "2026-10-18", "필요 없음"));
    expect(bareLf.test(cancelled)).toBe(false);
    const updated = okContent(updateTask(crlf, PATH, target(crlf, "보고서 제출"), { memo: "메모" }));
    expect(bareLf.test(updated)).toBe(false);
    const inserted = okContent(insertTask(crlf, PATH, { title: "새 일", date: "2026-10-12", category: "생활" }));
    expect(bareLf.test(inserted)).toBe(false);
    expect(tasksOf(inserted).map((t) => t.title)).toContain("새 일");
  });

  it("CRLF 파일에서 속성 줄을 지워도 줄바꿈이 깨지지 않는다", () => {
    const result = okContent(updateTask(crlf, PATH, target(crlf, "치과 예약 잡기"), { memo: null }));
    expect(bareLf.test(result)).toBe(false);
    expect(block(result.replace(/\r\n/g, "\n"), "치과 예약 잡기")).toEqual(["- [ ] 치과 예약 잡기", "  - 하기로 한 날: 2026-10-06", "  - 분류: 생활"]);
  });

  it("CRLF 파일의 frontmatter 미완료도 CRLF로 고친다", () => {
    const single = ["---", "월: 2026-10", "미완료: true", "---", "", "- [ ] 하나뿐", "  - 하기로 한 날: 2026-10-18", ""].join("\r\n");
    const result = okContent(completeTask(single, PATH, target(single, "하나뿐"), "2026-10-18"));
    expect(result).toContain("미완료: false\r\n---");
    expect(bareLf.test(result)).toBe(false);
  });
});

describe("syncOpenFlag", () => {
  it("미완료 줄이 없으면 월 줄 뒤에 넣는다", () => {
    const content = ["---", "월: 2026-10", "---", "", "- [ ] 일", "  - 하기로 한 날: 2026-10-18", ""].join("\n");
    expect(syncOpenFlag(content, PATH).split("\n").slice(0, 4)).toEqual(["---", "월: 2026-10", "미완료: true", "---"]);
  });

  it("다른 frontmatter 필드는 건드리지 않는다", () => {
    const content = ["---", "월: 2026-10", "미완료: false", "태그: 할일", "---", "", "- [ ] 일", "  - 하기로 한 날: 2026-10-18", ""].join("\n");
    expect(syncOpenFlag(content, PATH).split("\n").slice(0, 5)).toEqual(["---", "월: 2026-10", "미완료: true", "태그: 할일", "---"]);
  });

  it("frontmatter가 없는 파일에는 만들지 않는다", () => {
    const content = "- [ ] 일\n  - 하기로 한 날: 2026-10-18\n";
    expect(syncOpenFlag(content, PATH)).toBe(content);
  });

  it("이미 맞으면 내용을 그대로 돌려준다", () => {
    expect(syncOpenFlag(BASE, PATH)).toBe(BASE);
  });
});
