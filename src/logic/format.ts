import type { Deadline } from "../data/types";
import { t, uiLanguage } from "../i18n";
import { dayNumber, daysBetween, monthOf, type DeadlineState } from "./dates";

const utcDate = (date: string) => new Date(dayNumber(date) * 86_400_000);

/** 요일 약칭. 한국어 `화`, 영어 `Tue` */
export function weekdayOf(date: string): string {
  return new Intl.DateTimeFormat(uiLanguage(), { timeZone: "UTC", weekday: "short" }).format(utcDate(date));
}

/** `2026-10-05` → `10/5` */
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** `2026-10-18` → `10월 18일 (일)`, 영어로는 `Sun, Oct 18` */
export function formatLongDate(date: string): string {
  const lang = uiLanguage();
  // 한국어는 `10월`처럼 달 이름을 다 써야 자연스럽고, 영어는 `Oct`처럼 줄여야 짧다.
  const month = lang === "ko" ? "long" : "short";
  return new Intl.DateTimeFormat(lang, { timeZone: "UTC", month, day: "numeric", weekday: "short" }).format(utcDate(date));
}

/** `2026-10-18` → `2026-10.md`. 새 항목이 들어갈 월 파일 이름 */
export function monthNoteFileName(date: string): string {
  return `${monthOf(date)}.md`;
}

/** 마감 칩에 쓰는 짧은 글. 지난 마감은 날짜를 빼고, 상세 정보에서 날짜를 보여 준다. */
export function deadlineLabel(deadline: Deadline, state: DeadlineState, today: string): string {
  if (state === "overdue") return t("date.deadlineOverdue");
  const diff = daysBetween(today, deadline.date);
  const when = diff === 0 ? t("date.today") : diff === 1 ? t("date.tomorrow") : formatMonthDay(deadline.date);
  return t("date.deadlineOn", { when });
}
