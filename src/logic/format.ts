import type { Deadline } from "../data/types";
import { dayNumber, daysBetween, monthOf, type DeadlineState } from "./dates";

const WEEKDAYS = "일월화수목금토";

export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(dayNumber(date) * 86_400_000).getUTCDay()] ?? "";
}

/** `2026-10-05` → `10/5` */
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** `2026-10-18` → `10월 18일 (일)` */
export function formatLongDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일 (${weekdayOf(date)})`;
}

/** `2026-10-18` → `2026-10.md`. 새 항목이 들어갈 월 파일 이름 */
export function ledgerFileName(date: string): string {
  return `${monthOf(date)}.md`;
}

/** 마감 칩에 쓰는 짧은 글. 지난 마감은 날짜를 빼고, 상세 정보에서 날짜를 보여 준다. */
export function deadlineLabel(deadline: Deadline, state: DeadlineState, today: string): string {
  if (state === "overdue") return "마감 지남";
  const diff = daysBetween(today, deadline.date);
  const when = diff === 0 ? "오늘" : diff === 1 ? "내일" : formatMonthDay(deadline.date);
  return `${when} 마감`;
}
