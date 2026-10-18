import { describe, expect, it } from "vitest";
import { nextNewTaskStep } from "../../src/ui/newTaskFlow";

describe("nextNewTaskStep", () => {
  it("같은 제목이 없으면 바로 만든다", () => {
    expect(nextNewTaskStep(0, false, null)).toEqual({ kind: "create" });
    expect(nextNewTaskStep(0, false, "new")).toEqual({ kind: "create" });
  });

  it("같은 제목이 있으면 처음에는 고르게 한다", () => {
    expect(nextNewTaskStep(1, false, null)).toEqual({ kind: "ask" });
    expect(nextNewTaskStep(2, false, null)).toEqual({ kind: "ask" });
  });

  it("물었는데 고르지 않았으면 자동으로 정하지 않고 다시 고르게 한다", () => {
    expect(nextNewTaskStep(1, true, null)).toEqual({ kind: "choose" });
  });

  it("새로 만들기를 고르면 만든다", () => {
    expect(nextNewTaskStep(1, true, "new")).toEqual({ kind: "create" });
  });

  it("기존 항목을 고르면 그 항목에 날짜를 더한다", () => {
    expect(nextNewTaskStep(2, true, 1)).toEqual({ kind: "add-date", index: 1 });
  });

  it("목록에 없는 위치를 골랐으면 다시 고르게 한다", () => {
    expect(nextNewTaskStep(1, true, 3)).toEqual({ kind: "choose" });
  });
});
