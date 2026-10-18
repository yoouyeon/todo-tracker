import type { Deadline } from "../data/types";

/** 처음 계획한 날부터 이 일수 이상 지나면 오래 밀린 일이다. */
export const STALE_DAYS = 7;
/** 마감까지 이 일수 이내(오늘 포함)면 임박이다. */
export const DEADLINE_SOON_DAYS = 3;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MS_PER_DAY = 86_400_000;

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** 1970-01-01부터 센 날 수. 시간대와 무관하게 달력 기준으로 비교하려고 UTC로 계산한다. */
export function dayNumber(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`날짜 형식이 올바르지 않음: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY;
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `to`가 `from`보다 며칠 뒤인지. 앞이면 음수 */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** `YYYY-MM-DD`에서 월 파일 이름의 `YYYY-MM` */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 사용자의 현지 시간대 기준 오늘 날짜 */
export function formatLocalDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatLocalTime(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** 처음 계획한 날부터 오늘까지 지난 일수 */
export function ageInDays(firstPlanned: string, today: string): number {
  return daysBetween(firstPlanned, today);
}

export function isStale(firstPlanned: string, today: string): boolean {
  return ageInDays(firstPlanned, today) >= STALE_DAYS;
}

export type Bucket = "past" | "today" | "upcoming";

/** 현재 계획 날짜로 `지난 계획`, `오늘`, `예정`을 나눈다. */
export function bucketOf(currentPlanned: string, today: string): Bucket {
  if (currentPlanned < today) return "past";
  return currentPlanned === today ? "today" : "upcoming";
}

export type DeadlineState = "overdue" | "soon" | "later";

/**
 * 시간이 있으면 그 시각이 지나야, 날짜만 있으면 그 날이 끝나야 지난 마감이다.
 * 지나지 않았고 3일 이내(오늘 포함)면 임박이다.
 */
export function deadlineState(deadline: Deadline, today: string, nowTime: string): DeadlineState {
  const diff = daysBetween(today, deadline.date);
  if (diff < 0) return "overdue";
  if (diff === 0 && deadline.time !== null && deadline.time < nowTime) return "overdue";
  return diff <= DEADLINE_SOON_DAYS ? "soon" : "later";
}
