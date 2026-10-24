import { describe, expect, it } from "vitest";
import { TaskActions, type MonthNoteWriter } from "../../src/data/actions";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import type { TaskRecord } from "../../src/data/types";

const OCT = [
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
  "",
  "- [ ] 보고서 제출",
  "  - 하기로 한 날: 2026-10-14",
  "  - 마감일: 2026-10-17 18:00",
  "",
].join("\n");

/** 파일 내용을 메모리에 들고 있는 가짜 writer. 실제로 내용이 바뀐 쓰기만 `writes`에 남긴다. */
class FakeWriter implements MonthNoteWriter {
  files = new Map<string, string>();
  writes: string[] = [];
  onCreate: ((path: string) => void) | null = null;

  constructor(files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) this.files.set(path, content);
  }
  async process(path: string, fn: (content: string) => string): Promise<boolean> {
    const content = this.files.get(path);
    if (content === undefined) return false;
    const next = fn(content);
    if (next !== content) {
      this.files.set(path, next);
      this.writes.push(path);
    }
    return true;
  }
  async create(path: string, content: string): Promise<void> {
    this.onCreate?.(path);
    if (this.files.has(path)) throw new Error("File already exists.");
    this.files.set(path, content);
    this.writes.push(path);
  }
}

const setup = (files: Record<string, string> = { "할일/2026-10.md": OCT }, folder = "할일") => {
  const writer = new FakeWriter(files);
  return { writer, actions: new TaskActions(writer, () => folder) };
};
const taskOf = (writer: FakeWriter, path: string, title: string): TaskRecord => {
  const task = parseMonthNote(path, writer.files.get(path) ?? "").tasks.find((t) => t.title === title);
  if (!task) throw new Error(`"${title}" 항목이 없음`);
  return task;
};

describe("TaskActions: 기존 항목 고치기", () => {
  it("완료를 최신 내용에 적용해서 쓴다", async () => {
    const { writer, actions } = setup();
    const task = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    expect(await actions.complete(task, "2026-10-18")).toEqual({ ok: true });
    const after = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    expect([after.status, after.completedOn]).toEqual(["done", "2026-10-18"]);
    expect(taskOf(writer, "할일/2026-10.md", "보고서 제출").status).toBe("open");
    expect(writer.writes).toEqual(["할일/2026-10.md"]);
  });

  it("화면에 보이던 시점 이후 노트가 바뀌었으면 쓰지 않고 이유를 알린다", async () => {
    const { writer, actions } = setup();
    const stale = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    // 사용자가 노트에서 같은 항목의 분류를 먼저 고쳤다.
    writer.files.set("할일/2026-10.md", OCT.replace("분류: 생활", "분류: 병원"));
    const result = await actions.complete(stale, "2026-10-18");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("바뀌어서 저장하지 않았어요");
    expect(writer.writes).toEqual([]);
    expect(writer.files.get("할일/2026-10.md")).toBe(OCT.replace("분류: 생활", "분류: 병원"));
  });

  it("충돌이 나도 다른 항목을 대신 고치지 않는다", async () => {
    const { writer, actions } = setup();
    const stale = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    const edited = OCT.replace("- [ ] 치과 예약 잡기", "- [ ] 치과 예약 다시 잡기");
    writer.files.set("할일/2026-10.md", edited);
    await actions.cancel(stale, "2026-10-18", "필요 없음");
    expect(writer.files.get("할일/2026-10.md")).toBe(edited);
  });

  it("취소, 날짜 바꾸기, 상세 편집도 같은 경로로 쓴다", async () => {
    const { writer, actions } = setup();
    const path = "할일/2026-10.md";

    expect((await actions.changeDate(taskOf(writer, path, "보고서 제출"), "2026-10-18")).ok).toBe(true);
    const moved = taskOf(writer, path, "보고서 제출");
    expect([moved.firstPlanned, moved.planned]).toEqual(["2026-10-14", "2026-10-18"]);

    expect((await actions.update(taskOf(writer, path, "보고서 제출"), { category: "공부", memo: "초안만" })).ok).toBe(true);
    const updated = taskOf(writer, path, "보고서 제출");
    expect([updated.category, updated.memo]).toEqual(["공부", "초안만"]);

    expect((await actions.cancel(taskOf(writer, path, "치과 예약 잡기"), "2026-10-18", "병원이 닫음")).ok).toBe(true);
    expect(taskOf(writer, path, "치과 예약 잡기").status).toBe("cancelled");
  });

  it("편집 규칙에 어긋나는 요청은 쓰지 않고 이유를 돌려준다", async () => {
    const { writer, actions } = setup();
    const task = taskOf(writer, "할일/2026-10.md", "보고서 제출");
    const result = await actions.changeDate(task, "2026-10-14");
    expect(result.ok === false && result.message).toContain("이미 10/14");
    const noReason = await actions.cancel(task, "2026-10-18", "   ");
    expect(noReason.ok === false && noReason.message).toContain("이유");
    expect(writer.writes).toEqual([]);
  });

  it("노트가 사라졌으면 이유를 알린다", async () => {
    const { writer, actions } = setup();
    const task = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    writer.files.clear();
    const result = await actions.complete(task, "2026-10-18");
    expect(result.ok === false && result.message).toContain("노트를 찾을 수 없어요");
  });

  it("쓰는 중 오류가 나면 이유를 알린다", async () => {
    const { writer, actions } = setup();
    const task = taskOf(writer, "할일/2026-10.md", "치과 예약 잡기");
    writer.process = async () => {
      throw new Error("디스크가 가득 찼어요");
    };
    const result = await actions.complete(task, "2026-10-18");
    expect(result.ok === false && result.message).toBe("저장하지 못했어요: 디스크가 가득 찼어요");
  });
});

describe("TaskActions.addTask", () => {
  it("첫 계획 날짜의 월 파일이 있으면 순서에 맞춰 넣는다", async () => {
    const { writer, actions } = setup();
    expect(await actions.addTask({ title: "새 일", date: "2026-10-10", category: "생활" })).toEqual({ ok: true });
    const titles = parseMonthNote("할일/2026-10.md", writer.files.get("할일/2026-10.md") ?? "").tasks.map((t) => t.title);
    expect(titles).toEqual(["치과 예약 잡기", "새 일", "보고서 제출"]);
  });

  it("월 파일이 없으면 월과 미완료가 있는 새 월 노트를 만든다", async () => {
    const { writer, actions } = setup();
    expect(await actions.addTask({ title: "연말 정리", date: "2026-12-30" })).toEqual({ ok: true });
    const created = writer.files.get("할일/2026-12.md") ?? "";
    expect(created.startsWith("---\n월: 2026-12\n미완료: true\n---")).toBe(true);
    expect(parseMonthNote("할일/2026-12.md", created).tasks.map((t) => t.title)).toEqual(["연말 정리"]);
    expect(writer.files.get("할일/2026-10.md")).toBe(OCT);
  });

  it("계획이 다음 달로 넘어가는 항목도 첫 계획 날짜의 월 파일에 넣는다", async () => {
    const { writer, actions } = setup();
    await actions.addTask({ title: "월말 일", date: "2026-10-31" });
    expect(writer.files.has("할일/2026-11.md")).toBe(false);
    expect(taskOf(writer, "할일/2026-10.md", "월말 일").planned).toBe("2026-10-31");
  });

  it("설정 폴더를 정리해서 경로를 만든다", async () => {
    const nested = setup({}, " /업무/할일/ ");
    await nested.actions.addTask({ title: "일", date: "2026-10-18" });
    expect([...nested.writer.files.keys()]).toEqual(["업무/할일/2026-10.md"]);

    const root = setup({}, "");
    await root.actions.addTask({ title: "일", date: "2026-10-18" });
    expect([...root.writer.files.keys()]).toEqual(["2026-10.md"]);
  });

  it("만드는 사이 같은 파일이 생기면 그 파일에 한 번 더 시도해서 넣는다", async () => {
    const { writer, actions } = setup({});
    writer.onCreate = (path) => {
      writer.onCreate = null;
      writer.files.set(path, OCT);
    };
    expect(await actions.addTask({ title: "새 일", date: "2026-10-10" })).toEqual({ ok: true });
    const titles = parseMonthNote("할일/2026-10.md", writer.files.get("할일/2026-10.md") ?? "").tasks.map((t) => t.title);
    expect(titles).toEqual(["치과 예약 잡기", "새 일", "보고서 제출"]);
  });

  it("제목이나 날짜가 올바르지 않으면 파일을 만들지 않는다", async () => {
    const { writer, actions } = setup({});
    expect((await actions.addTask({ title: "", date: "2026-10-18" })).ok).toBe(false);
    expect((await actions.addTask({ title: "일", date: "내일" })).ok).toBe(false);
    expect(writer.files.size).toBe(0);
  });
});
