import { isValidDate, monthOf } from "../logic/dates";
import {
  MESSAGES,
  cancelTask,
  changeCompletedDate,
  changePlannedDate,
  completeTask,
  insertTask,
  reopenTask,
  updateTask,
  type EditResult,
  type NewTaskInput,
  type TaskPatch,
} from "./editMonthNote";
import { normalizeFolder } from "./paths";
import type { TaskRecord } from "./types";

/** 파일에 쓰는 일을 맡는 얇은 경계. 실제로는 `Vault.process()`와 `Vault.create()`를 쓴다. */
export interface MonthNoteWriter {
  /** 파일이 있으면 최신 내용을 넘겨 돌려받은 내용으로 바꾸고 true. 파일이 없으면 false */
  process(path: string, fn: (content: string) => string): Promise<boolean>;
  /** 파일을 새로 만든다. 이미 있으면 던진다. */
  create(path: string, content: string): Promise<void>;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

const OK: ActionResult = { ok: true };
const fail = (message: string): ActionResult => ({ ok: false, message });
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * 화면의 수정 요청을 받아 월 파일에 반영한다.
 * 쓰는 순간의 최신 내용에서 대상 항목을 다시 찾고, 확신할 수 없으면 아무것도 쓰지 않는다.
 * 실패해도 다른 항목을 대신 고치거나 자동으로 다시 시도하지 않는다.
 */
export class TaskActions {
  constructor(
    private readonly writer: MonthNoteWriter,
    private readonly getFolder: () => string,
  ) {}

  complete(task: TaskRecord, date: string): Promise<ActionResult> {
    return this.editExisting(task, (content) => completeTask(content, task.sourcePath, task, date));
  }

  /** 완료한 항목의 완료한 날을 바꾼다. */
  changeCompletedDate(task: TaskRecord, date: string): Promise<ActionResult> {
    return this.editExisting(task, (content) => changeCompletedDate(content, task.sourcePath, task, date));
  }

  /** 완료를 되돌린다. `task`는 완료된 상태의 항목이다. */
  reopen(task: TaskRecord): Promise<ActionResult> {
    return this.editExisting(task, (content) => reopenTask(content, task.sourcePath, task));
  }

  cancel(task: TaskRecord, date: string, reason: string): Promise<ActionResult> {
    return this.editExisting(task, (content) => cancelTask(content, task.sourcePath, task, date, reason));
  }

  changeDate(task: TaskRecord, date: string): Promise<ActionResult> {
    return this.editExisting(task, (content) => changePlannedDate(content, task.sourcePath, task, date));
  }

  update(task: TaskRecord, patch: TaskPatch): Promise<ActionResult> {
    return this.editExisting(task, (content) => updateTask(content, task.sourcePath, task, patch));
  }

  /** 첫 계획 날짜의 월 파일에 새 항목을 넣는다. 파일이 없으면 새 월 노트를 만든다. */
  async addTask(input: NewTaskInput): Promise<ActionResult> {
    if (!isValidDate(input.date)) return fail(MESSAGES.badDate);
    const folder = normalizeFolder(this.getFolder());
    const path = `${folder === "" ? "" : `${folder}/`}${monthOf(input.date)}.md`;
    const insert = (content: string) => insertTask(content, path, input);

    const existing = await this.run(path, insert);
    if (existing !== "missing") return existing;

    const created = insertTask(null, path, input);
    if (!created.ok) return fail(created.error.message);
    try {
      await this.writer.create(path, created.content);
      return OK;
    } catch (error) {
      // 그 사이 같은 파일이 만들어졌을 수 있다. 이 경우에만 한 번 더 시도한다.
      const retry = await this.run(path, insert);
      return retry === "missing" ? fail(`노트를 만들지 못했어요: ${describe(error)}`) : retry;
    }
  }

  private async editExisting(task: TaskRecord, edit: (content: string) => EditResult): Promise<ActionResult> {
    const result = await this.run(task.sourcePath, edit);
    return result === "missing" ? fail(`노트를 찾을 수 없어요: ${task.sourcePath}`) : result;
  }

  private async run(path: string, edit: (content: string) => EditResult): Promise<ActionResult | "missing"> {
    const state: { error: string | null } = { error: null };
    let found: boolean;
    try {
      found = await this.writer.process(path, (content) => {
        const result = edit(content);
        if (result.ok) return result.content;
        // 고칠 수 없으면 내용을 그대로 돌려줘서 아무것도 쓰지 않는다.
        state.error = result.error.message;
        return content;
      });
    } catch (error) {
      return fail(`저장하지 못했어요: ${describe(error)}`);
    }
    if (!found) return "missing";
    return state.error === null ? OK : fail(state.error);
  }
}
