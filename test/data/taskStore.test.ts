import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TaskStore, type MonthNoteFile, type MonthNoteVault } from "../../src/data/taskStore";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const OCT = fixture("2026-10.md");
const SEP = fixture("2026-09.md");

/** 파일 내용을 메모리에 들고 있는 가짜 vault. `delays`로 읽기가 끝나는 시점을 늦출 수 있다. */
class FakeVault implements MonthNoteVault {
  files = new Map<string, string>();
  gates = new Map<string, Promise<void>[]>();

  constructor(files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) this.files.set(path, content);
  }
  listFolderFiles(folder: string): MonthNoteFile[] {
    const inFolder = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "") === folder;
    return [...this.files.keys()].filter(inFolder).map((path) => ({ path }));
  }
  async read(file: MonthNoteFile): Promise<string> {
    const content = this.files.get(file.path);
    const gate = this.gates.get(file.path)?.shift();
    if (gate) await gate;
    if (content === undefined) throw new Error("파일이 없음");
    return content;
  }
}

const titles = (store: TaskStore) => store.getSnapshot().monthNotes.flatMap((l) => l.tasks.map((t) => t.title));

describe("TaskStore.scan", () => {
  it("설정 폴더의 월 노트만 읽는다", async () => {
    const vault = new FakeVault({
      "할일/2026-10.md": OCT,
      "할일/2026-09.md": SEP,
      "할일/AGENTS.md": "# 지침\n\n- [ ] 이건 월 노트가 아님\n",
      "회고/2026-10.md": OCT,
    });
    const store = new TaskStore(vault, () => "할일");
    expect(store.getSnapshot().loaded).toBe(false);

    await store.scan();

    const snapshot = store.getSnapshot();
    expect(snapshot.loaded).toBe(true);
    expect(snapshot.folder).toBe("할일");
    expect(snapshot.monthNotes.map((l) => l.path)).toEqual(["할일/2026-09.md", "할일/2026-10.md"]);
  });

  it("월 노트가 하나도 없어도 읽기를 마친 것으로 본다", async () => {
    const store = new TaskStore(new FakeVault({}), () => "할일");
    await store.scan();
    expect(store.getSnapshot().loaded).toBe(true);
    expect(store.getSnapshot().monthNotes).toEqual([]);
  });

  it("폴더 설정이 바뀌면 다시 훑어서 다른 폴더를 읽는다", async () => {
    const vault = new FakeVault({ "할일/2026-10.md": OCT, "업무/2026-09.md": SEP });
    let folder = "할일";
    const store = new TaskStore(vault, () => folder);
    await store.scan();
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-10.md"]);

    folder = "업무";
    await store.scan();
    expect(store.getSnapshot().folder).toBe("업무");
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["업무/2026-09.md"]);
  });
});

describe("TaskStore: 파일 변경", () => {
  const setup = async () => {
    const vault = new FakeVault({ "할일/2026-10.md": OCT, "할일/2026-09.md": SEP });
    const store = new TaskStore(vault, () => "할일");
    await store.scan();
    return { vault, store };
  };

  it("수정된 파일만 다시 읽고 구독자에게 알린다", async () => {
    const { vault, store } = await setup();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    const sep = before.monthNotes.find((l) => l.path === "할일/2026-09.md");

    vault.files.set("할일/2026-10.md", "---\n월: 2026-10\n미완료: true\n---\n\n- [ ] 새로 쓴 항목\n  - 하기로 한 날: 2026-10-18\n");
    await store.refresh({ path: "할일/2026-10.md" });

    const after = store.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(after).not.toBe(before);
    expect(titles(store)).toContain("새로 쓴 항목");
    expect(titles(store)).not.toContain("여행 사진 정리");
    // 건드리지 않은 파일은 같은 파싱 결과를 그대로 쓴다.
    expect(after.monthNotes.find((l) => l.path === "할일/2026-09.md")).toBe(sep);
  });

  it("새 월 파일이 만들어지면 목록에 더한다", async () => {
    const { vault, store } = await setup();
    vault.files.set("할일/2026-11.md", "---\n월: 2026-11\n미완료: true\n---\n\n- [ ] 11월 일\n  - 하기로 한 날: 2026-11-02\n");
    await store.refresh({ path: "할일/2026-11.md" });
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-09.md", "할일/2026-10.md", "할일/2026-11.md"]);
  });

  it("월 노트가 아닌 파일의 변경은 무시한다", async () => {
    const { vault, store } = await setup();
    const listener = vi.fn();
    store.subscribe(listener);
    vault.files.set("할일/AGENTS.md", "- [ ] 월 노트가 아님");
    await store.refresh({ path: "할일/AGENTS.md" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("삭제된 파일은 목록에서 뺀다", async () => {
    const { store } = await setup();
    store.remove("할일/2026-09.md");
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-10.md"]);
  });

  it("이름이 바뀌면 옛 경로를 빼고 새 경로를 읽는다", async () => {
    const { vault, store } = await setup();
    vault.files.set("할일/2026-08.md", vault.files.get("할일/2026-09.md") ?? "");
    vault.files.delete("할일/2026-09.md");
    await store.rename({ path: "할일/2026-08.md" }, "할일/2026-09.md");
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-08.md", "할일/2026-10.md"]);
  });

  it("월 노트 이름에서 다른 이름으로 바뀌면 목록에서 뺀다", async () => {
    const { vault, store } = await setup();
    vault.files.set("할일/보관.md", vault.files.get("할일/2026-09.md") ?? "");
    vault.files.delete("할일/2026-09.md");
    await store.rename({ path: "할일/보관.md" }, "할일/2026-09.md");
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-10.md"]);
  });

  it("읽는 동안 파일이 또 바뀌면 가장 마지막에 시작한 읽기를 쓴다", async () => {
    const { vault, store } = await setup();
    const path = "할일/2026-10.md";
    const header = "---\n월: 2026-10\n미완료: true\n---\n\n";
    let release: () => void = () => {};
    // 첫 번째 읽기는 느리게, 두 번째 읽기는 바로 끝나게 한다.
    vault.gates.set(path, [new Promise<void>((resolve) => { release = resolve; })]);
    vault.files.set(path, `${header}- [ ] 옛 내용\n  - 하기로 한 날: 2026-10-01\n`);
    const slow = store.refresh({ path });

    vault.files.set(path, `${header}- [ ] 새 내용\n  - 하기로 한 날: 2026-10-02\n`);
    await store.refresh({ path });
    release();
    await slow;

    const monthNote = store.getSnapshot().monthNotes.find((l) => l.path === path);
    expect(monthNote?.tasks.map((t) => t.title)).toEqual(["새 내용"]);
  });

  it("읽는 동안 파일이 지워지면 결과를 반영하지 않는다", async () => {
    const { vault, store } = await setup();
    const path = "할일/2026-09.md";
    let release: () => void = () => {};
    vault.gates.set(path, [new Promise<void>((resolve) => { release = resolve; })]);
    const pending = store.refresh({ path });
    store.remove(path);
    release();
    await pending;
    expect(store.getSnapshot().monthNotes.map((l) => l.path)).toEqual(["할일/2026-10.md"]);
  });

  it("구독을 해제하면 더는 알리지 않는다", async () => {
    const { vault, store } = await setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    vault.files.set("할일/2026-10.md", OCT);
    await store.refresh({ path: "할일/2026-10.md" });
    expect(listener).not.toHaveBeenCalled();
  });
});
