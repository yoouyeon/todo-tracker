import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import type { MonthNoteSnapshot, MonthNoteSource } from "../../src/data/taskStore";
import type { TaskRecord } from "../../src/data/types";
import type { AppHost } from "../../src/ui/host";

// jsdom 환경에서는 import.meta.url이 파일 경로가 아니라서 프로젝트 루트(Vitest 실행 위치) 기준으로 읽는다.
const fixture = (name: string) => readFileSync(resolve(process.cwd(), "test/fixtures", name), "utf8");

/** 2026-10-18 19:00. 테스트 노트의 날짜들이 이 시각을 기준으로 맞춰져 있다. */
export const NOW = () => new Date(2026, 9, 18, 19, 0);
export const TODAY = "2026-10-18";
export const TOMORROW = "2026-10-19";

export const loaded: MonthNoteSnapshot = {
  loaded: true,
  folder: "할일",
  monthNotes: [parseMonthNote("할일/2026-09.md", fixture("2026-09.md")), parseMonthNote("할일/2026-10.md", fixture("2026-10.md"))],
};

/** 항목을 찾는다. 같은 제목이 여럿이면 `nth`번째 */
export function taskOf(title: string, nth = 0): TaskRecord {
  const task = loaded.monthNotes.flatMap((l) => l.tasks).filter((t) => t.title === title)[nth];
  if (!task) throw new Error(`"${title}" 항목이 없음`);
  return task;
}

/** 호출을 기록하는 가짜 host */
export function createHostStub() {
  return {
    openNote: vi.fn(),
    newTask: vi.fn(),
    complete: vi.fn(),
    completeOn: vi.fn(),
    cancel: vi.fn(),
    pickDate: vi.fn(),
    edit: vi.fn(),
    showMenu: vi.fn(),
  } satisfies AppHost;
}

/** 내용을 바꿔서 구독자에게 알릴 수 있는 가짜 저장소 */
export function createSource(initial: MonthNoteSnapshot = loaded): MonthNoteSource & { set(next: MonthNoteSnapshot): void } {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(next) {
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
  };
}
