import { describe, expect, it } from "vitest";
import { isMonthNotePath, normalizeFolder } from "../../src/data/paths";

describe("normalizeFolder", () => {
  it("앞뒤 공백과 슬래시를 뺀다", () => {
    expect(normalizeFolder("할일")).toBe("할일");
    expect(normalizeFolder(" /할일/ ")).toBe("할일");
    expect(normalizeFolder("업무/할일//")).toBe("업무/할일");
  });

  it("빈 값은 vault 루트다", () => {
    expect(normalizeFolder("")).toBe("");
    expect(normalizeFolder(" / ")).toBe("");
  });
});

describe("isMonthNotePath", () => {
  it("설정 폴더 바로 아래의 월 노트만 통과시킨다", () => {
    expect(isMonthNotePath("할일/2026-10.md", "할일")).toBe(true);
    expect(isMonthNotePath("할일/2026-10.md", "/할일/")).toBe(true);
  });

  it("AGENTS.md 같은 다른 파일은 읽지 않는다", () => {
    expect(isMonthNotePath("할일/AGENTS.md", "할일")).toBe(false);
    expect(isMonthNotePath("할일/2026-10 메모.md", "할일")).toBe(false);
  });

  it("다른 폴더와 하위 폴더의 파일은 읽지 않는다", () => {
    expect(isMonthNotePath("회고/2026-10.md", "할일")).toBe(false);
    expect(isMonthNotePath("할일/보관/2026-09.md", "할일")).toBe(false);
    expect(isMonthNotePath("2026-10.md", "할일")).toBe(false);
  });

  it("폴더가 비어 있으면 vault 루트의 파일을 본다", () => {
    expect(isMonthNotePath("2026-10.md", "")).toBe(true);
    expect(isMonthNotePath("할일/2026-10.md", "")).toBe(false);
  });
});
