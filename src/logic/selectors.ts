import { toOneLine } from "../data/editMonthNote";
import type { ParsedMonthNote, TaskRecord } from "../data/types";
import { ageInDays, bucketOf, deadlineState, isStale, monthOf, type Bucket, type DeadlineState } from "./dates";
import { deadlineLabel } from "./format";

export interface Clock {
  /** YYYY-MM-DD */
  today: string;
  /** HH:mm */
  time: string;
}

export type RecordStatusFilter = "all" | "done" | "cancelled";

export interface Filters {
  /** 마감이 지났거나 임박한 진행 중 항목만 */
  deadlineOnly: boolean;
  /** 빈 문자열이면 모든 분류 */
  category: string;
  query: string;
  recordStatus: RecordStatusFilter;
  /** `YYYY-MM`. 빈 문자열이면 모든 달 */
  recordMonth: string;
}

export const NO_FILTERS: Filters = { deadlineOnly: false, category: "", query: "", recordStatus: "all", recordMonth: "" };

export interface TaskItem {
  /** 화면에서 펼침 상태를 기억하는 데 쓰는 값. 파일 경로, 제목, 첫 계획 날짜, 같은 값 안의 순번으로 만든다. */
  key: string;
  task: TaskRecord;
  /** 처음 계획한 날. 문제가 있어 읽을 수 없는 항목이면 null */
  first: string | null;
  /** 현재 계획 날짜. 이력 중 가장 최근 날짜 */
  current: string | null;
  /** 처음 계획한 날부터 오늘까지 지난 일수 */
  age: number;
  /** 진행 중이고 오래 밀렸는지 */
  stale: boolean;
  /** 진행 중 항목의 묶음 */
  bucket: Bucket | null;
  deadline: { state: DeadlineState; label: string } | null;
  /** 월 파일 순서와 파일 안의 순서를 합친 원래 순번 */
  order: number;
}

export interface Counts {
  past: number;
  today: number;
  upcoming: number;
  /** 오래 밀린 일 */
  stale: number;
  /** 마감이 지났거나 임박한 진행 중 항목 */
  deadlineAlert: number;
  records: number;
  done: number;
  cancelled: number;
  doneToday: number;
}

export interface Board {
  past: TaskItem[];
  today: TaskItem[];
  upcoming: TaskItem[];
  /** 오늘 완료한 항목. `오늘` 묶음 끝에 취소선으로 남긴다. */
  doneToday: TaskItem[];
  records: TaskItem[];
  /** 문제가 있어 읽기 전용으로만 보여 주는 항목 */
  problems: TaskItem[];
  /** 필터와 상관없는 전체 개수. 요약 카드에 쓴다. */
  counts: Counts;
  categories: string[];
  /** 기록의 월 필터 선택지. 최근 달이 먼저 */
  recordMonths: string[];
  /** 항목 밖의 파일 단위 문제. `파일 경로: 내용` */
  fileIssues: string[];
}

/**
 * 제목이 완전히 같은 진행 중 항목. 비슷한 이름은 찾지 않고, 자동으로 합치지도 않는다.
 * 새 할 일을 만들 때 기존 항목에 날짜를 더할지 새로 만들지 사용자가 고르게 하는 데 쓴다.
 */
export function findOpenDuplicates(monthNotes: ParsedMonthNote[], title: string): TaskRecord[] {
  const wanted = toOneLine(title);
  if (wanted === "") return [];
  return monthNotes.flatMap((monthNote) => monthNote.tasks).filter((t) => t.problems.length === 0 && t.status === "open" && t.title === wanted);
}

export function buildItems(monthNotes: ParsedMonthNote[], clock: Clock): TaskItem[] {
  const items: TaskItem[] = [];
  const seen = new Map<string, number>();
  const sorted = [...monthNotes].sort((a, b) => a.path.localeCompare(b.path));
  for (const monthNote of sorted) {
    for (const task of monthNote.tasks) {
      const valid = task.problems.length === 0;
      const first = valid ? (task.plannedDates[0] ?? null) : null;
      const current = valid ? (task.plannedDates[task.plannedDates.length - 1] ?? null) : null;
      const base = `${task.sourcePath}|${task.title}|${first ?? ""}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);

      const open = valid && task.status === "open";
      let deadline: TaskItem["deadline"] = null;
      if (open && task.deadline) {
        const state = deadlineState(task.deadline, clock.today, clock.time);
        deadline = { state, label: deadlineLabel(task.deadline, state, clock.today) };
      }
      items.push({
        key: `${base}|${n}`,
        task,
        first,
        current,
        age: first ? ageInDays(first, clock.today) : 0,
        stale: open && first !== null && isStale(first, clock.today),
        bucket: open && current ? bucketOf(current, clock.today) : null,
        deadline,
        order: items.length,
      });
    }
  }
  return items;
}

const isAlert = (item: TaskItem) => item.deadline?.state === "overdue" || item.deadline?.state === "soon";
const alertRank = (item: TaskItem) => (item.deadline?.state === "overdue" ? 0 : item.deadline?.state === "soon" ? 1 : 2);
const byCurrent = (a: TaskItem, b: TaskItem) => (a.current ?? "").localeCompare(b.current ?? "");

function matches(item: TaskItem, filters: Filters): boolean {
  if (filters.category !== "" && item.task.category !== filters.category) return false;
  const query = filters.query.trim().toLowerCase();
  if (query === "") return true;
  return item.task.title.toLowerCase().includes(query) || (item.task.aliasText ?? "").toLowerCase().includes(query);
}

/** 기록에서 정렬에 쓰는 처리한 날짜. 완료·취소 날짜가 없으면 가장 뒤로 간다. */
const processedOn = (item: TaskItem) => item.task.completedOn ?? item.task.cancelledOn ?? "";

export function buildBoard(monthNotes: ParsedMonthNote[], clock: Clock, filters: Filters = NO_FILTERS): Board {
  const items = buildItems(monthNotes, clock);
  const valid = items.filter((i) => i.task.problems.length === 0);
  const open = valid.filter((i) => i.task.status === "open");
  const closed = valid.filter((i) => i.task.status !== "open");
  const doneTodayAll = valid.filter((i) => i.task.status === "done" && i.task.completedOn === clock.today);

  const counts: Counts = {
    past: open.filter((i) => i.bucket === "past").length,
    today: open.filter((i) => i.bucket === "today").length,
    upcoming: open.filter((i) => i.bucket === "upcoming").length,
    stale: open.filter((i) => i.stale).length,
    deadlineAlert: open.filter(isAlert).length,
    records: closed.length,
    done: closed.filter((i) => i.task.status === "done").length,
    cancelled: closed.filter((i) => i.task.status === "cancelled").length,
    doneToday: doneTodayAll.length,
  };

  const shown = open.filter((i) => matches(i, filters) && (!filters.deadlineOnly || isAlert(i)));
  const inBucket = (bucket: Bucket) => shown.filter((i) => i.bucket === bucket);

  // 지난 계획: 오래 밀린 일(오래된 것부터) → 마감이 지났거나 임박한 일 → 현재 계획 날짜 순
  const past = inBucket("past").sort(
    (a, b) =>
      Number(b.stale) - Number(a.stale) ||
      (a.stale && b.stale ? b.age - a.age : 0) ||
      alertRank(a) - alertRank(b) ||
      byCurrent(a, b) ||
      a.order - b.order,
  );
  const today = inBucket("today").sort((a, b) => alertRank(a) - alertRank(b) || a.order - b.order);
  const upcoming = inBucket("upcoming").sort((a, b) => byCurrent(a, b) || a.order - b.order);
  // 마감 필터를 켜면 이미 끝난 일은 보여 주지 않는다.
  const doneToday = filters.deadlineOnly ? [] : doneTodayAll.filter((i) => matches(i, filters));

  const records = closed
    .filter((i) => filters.recordStatus === "all" || i.task.status === filters.recordStatus)
    .filter((i) => filters.recordMonth === "" || (i.first !== null && monthOf(i.first) === filters.recordMonth))
    .filter((i) => matches(i, filters))
    .sort((a, b) => processedOn(b).localeCompare(processedOn(a)) || b.order - a.order);

  const categories = [...new Set(valid.map((i) => i.task.category).filter((c): c is string => c !== null))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
  const recordMonths = [...new Set(closed.map((i) => (i.first ? monthOf(i.first) : "")).filter(Boolean))].sort().reverse();

  return {
    past,
    today,
    upcoming,
    doneToday,
    records,
    problems: items.filter((i) => i.task.problems.length > 0),
    counts,
    categories,
    recordMonths,
    fileIssues: monthNotes.flatMap((l) => l.issues.map((issue) => `${l.path}: ${issue}`)),
  };
}
