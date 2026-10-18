import { useEffect, useState } from "react";
import { formatLocalDate, formatLocalTime } from "../logic/dates";

const minuteKey = (date: Date) => `${formatLocalDate(date)} ${formatLocalTime(date)}`;

/**
 * 현재 시각. 분이 바뀔 때만 새 값을 돌려준다.
 * 자정을 넘기거나 오래 열어 둔 뒤 다시 돌아왔을 때 날짜 기반 표시가 갱신된다.
 */
export function useNow(getNow: () => Date): Date {
  const [now, setNow] = useState(getNow);
  useEffect(() => {
    const tick = () =>
      setNow((prev) => {
        const next = getNow();
        return minuteKey(next) === minuteKey(prev) ? prev : next;
      });
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [getNow]);
  return now;
}
